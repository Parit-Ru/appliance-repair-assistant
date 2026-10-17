/**
 * drafts.service.ts — วงจรชีวิตของร่างผัง: อัปโหลด → LLM ร่าง → ตรวจ → แก้ → เผยแพร่/ปฏิเสธ
 *
 * หลักการ (ต้องไม่ถูกทำลายเมื่อแก้ไฟล์นี้):
 *   1. LLM ได้แค่ "ร่าง" · ผลทุกครั้งผ่าน parseLlmOutput (เข้ม) แล้วผ่าน validateManual (โค้ดล้วน) ก่อนถึงคน
 *   2. publish ตรวจซ้ำฝั่งเซิร์ฟเวอร์ทุกครั้งกับข้อมูลที่ล็อกใน transaction — ไม่เชื่อรายงานที่เก็บไว้หรือที่หน้าจอส่งมา
 *      error ≥ 1 = ปฏิเสธเด็ดขาด (ไม่มี override) · warning ≥ 1 ต้องได้ acknowledgedWarnings: true
 *   3. ข้อมูลที่ไม่ใช่เนื้อหาผัง (manual_id ยี่ห้อ รุ่น source page_range graph_id) เซิร์ฟเวอร์กำหนดเอง (draft-manual.ts)
 *   4. ร่างไม่อยู่ในตารางที่ผู้ใช้อ่าน — เห็นผ่าน /admin/drafts เท่านั้น จนกว่าจะ publish
 *
 * งาน LLM ทำเบื้องหลังในโปรเซสนี้ ทีละ 1 งาน (rate limit ของ Groq + Render free) หน้าจอถามสถานะเป็นช่วงๆ
 * ไม่ log ข้อความหน้าคู่มือหรือคำตอบของ LLM (log เฉพาะ id และสถานะ)
 */

import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';

import { SymptomSearchService } from '../symptom-search/symptom-search.service';
import { GraphRepository } from '../traversal/graph.repository';
import { DRAFT_LLM_CLIENT, DraftLlmError, PROMPT_VERSION } from './draft-llm.client';
import type { DraftLlmClient } from './draft-llm.client';
import { assembleManual, toDbRows } from './draft-manual';
import { DraftParseError, assignGraphIds, parseDraftGraphs, parseLlmOutput } from './draft-schema';
import type { DraftGraph, LlmGraph } from './draft-schema';
import type { DraftDetailDto, DraftSummaryDto, PublishResultDto, UploadFields } from './drafts.dto';
import {
  DraftBusyError,
  DraftIdConflictError,
  DraftInvalidError,
  DraftNotFoundError,
  DraftNotReadyError,
  InvalidDraftRequestError,
  PdfUnsupportedTypeError,
  PublishReloadError,
  WarningsNotAcknowledgedError,
} from './drafts.errors';
import { DraftsStore } from './drafts.store';
import type { DraftRecord, PreparedPublish } from './drafts.store';
import { validateManual } from './graph-validator';
import type { ValidationReport } from './graph-validator';
import { PDF_TEXT_EXTRACTOR } from './pdf-text';
import type { PageText, PdfTextExtractor } from './pdf-text';

/** จำนวนหน้าที่ส่ง LLM ต่อการเรียก 1 ครั้ง (ตัดสินใจไว้: 1–2 หน้า) */
export const PAGES_PER_LLM_CALL = 2;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (epoch: number | null): string | null => (epoch === null ? null : new Date(epoch * 1000).toISOString());

export function chunkPages(pages: PageText[], size: number = PAGES_PER_LLM_CALL): PageText[][] {
  const groups: PageText[][] = [];
  for (let i = 0; i < pages.length; i += size) groups.push(pages.slice(i, i + size));
  return groups;
}

@Injectable()
export class DraftsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DraftsService.name);
  /** มีงาน LLM กำลังทำในโปรเซสนี้ (ตั้ง/เช็กแบบ synchronous ก่อน await ใดๆ จึงไม่มี race ระหว่างสองคำขอ) */
  private busy = false;

  constructor(
    private readonly store: DraftsStore,
    private readonly graphRepository: GraphRepository,
    private readonly symptomSearch: SymptomSearchService,
    @Inject(PDF_TEXT_EXTRACTOR) private readonly extractor: PdfTextExtractor,
    @Optional() @Inject(DRAFT_LLM_CLIENT) private readonly llm: DraftLlmClient | null = null,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const interrupted = await this.store.failInterrupted();
      if (interrupted > 0) this.logger.warn(`ร่างที่ค้างสถานะ drafting ${interrupted} รายการ ถูกเปลี่ยนเป็น failed (เซิร์ฟเวอร์เริ่มใหม่)`);
    } catch (err) {
      // ตาราง graph_drafts ยังไม่มี (ยังไม่รัน migration 012) → ไม่ให้แอปทั้งตัวล้ม
      this.logger.error(`ตรวจร่างที่ค้างไม่สำเร็จ (รัน migration 012 แล้วหรือยัง?): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ============================================================
  // อัปโหลด + ร่าง
  // ============================================================

  /**
   * POST /admin/drafts — รับ PDF (ในหน่วยความจำ) → แยกข้อความช่วงหน้าที่เลือก → บันทึกร่างสถานะ drafting → ร่างต่อเบื้องหลัง
   * ไฟล์ PDF ไม่ถูกเก็บ: เก็บเฉพาะข้อความของช่วงหน้าที่เลือก
   */
  async createFromUpload(file: { buffer: Buffer } | undefined, fields: UploadFields, userId: string): Promise<{ id: string }> {
    if (!file || file.buffer.length === 0) throw new InvalidDraftRequestError('ต้องแนบไฟล์ PDF ในฟิลด์ file');
    // ตรวจจากไบต์จริง ไม่เชื่อ mimetype/นามสกุลที่ผู้ใช้ส่งมา (PDF ต้องมี %PDF- ภายใน 1 KB แรก)
    if (!file.buffer.subarray(0, 1024).includes('%PDF-')) throw new PdfUnsupportedTypeError();

    if (this.busy) throw new DraftBusyError();
    this.busy = true;
    try {
      if ((await this.store.countDrafting()) > 0) throw new DraftBusyError();
      if (this.graphRepository.listManuals().some((m) => m.manualId === fields.manualId)) {
        throw new DraftIdConflictError([`manual_id '${fields.manualId}' มีอยู่แล้ว (เผยแพร่ได้เฉพาะคู่มือใหม่)`]);
      }

      const extracted = await this.extractor.extract(new Uint8Array(file.buffer), fields.meta.page_from, fields.meta.page_to);

      const id = randomUUID();
      await this.store.insert({
        id,
        manualId: fields.manualId,
        meta: fields.meta,
        pages: extracted.pages,
        progressTotal: chunkPages(extracted.pages).length,
        llmModel: this.llm?.model ?? null,
        promptVersion: PROMPT_VERSION,
        createdBy: userId,
      });

      void this.runDrafting(id); // เบื้องหลัง · busy ถูกปล่อยเมื่อจบ
      return { id };
    } catch (err) {
      this.busy = false;
      throw err;
    }
  }

  /** POST /admin/drafts/:id/retry — ร่างที่ failed ลองใหม่ด้วยข้อความหน้าเดิม (ไม่ต้องอัปโหลดซ้ำ) */
  async retry(rawId: string): Promise<{ id: string }> {
    const id = this.requireId(rawId);
    if (this.busy) throw new DraftBusyError();
    this.busy = true;
    try {
      if ((await this.store.countDrafting()) > 0) throw new DraftBusyError();
      const draft = await this.requireDraft(id);
      if (draft.status !== 'failed') throw new DraftNotReadyError('retry', draft.status);
      if (!(await this.store.restart(id, this.llm?.model ?? null, PROMPT_VERSION))) throw new DraftNotReadyError('retry', draft.status);
      void this.runDrafting(id);
      return { id };
    } catch (err) {
      this.busy = false;
      throw err;
    }
  }

  /** งานเบื้องหลัง: เรียก LLM ทีละช่วงหน้า → parse เข้ม → ประกอบ → ตรวจ → บันทึก (ไม่โยน error ออกนอก) */
  private async runDrafting(id: string): Promise<void> {
    try {
      const draft = await this.requireDraft(id);
      if (!this.llm) {
        await this.store.markFailed(id, 'LLM_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่า LLM (GROQ_API_KEY และ AUTHORING_LLM_MODEL ใน .env)');
        return;
      }

      const collected: LlmGraph[] = [];
      const groups = chunkPages(draft.pages);
      for (let index = 0; index < groups.length; index += 1) {
        const raw = await this.llm.draft({ manualId: draft.manualId, meta: draft.meta, pages: groups[index] });
        collected.push(...parseLlmOutput(raw));
        await this.store.setProgress(id, index + 1);
      }

      if (collected.length === 0) {
        await this.store.markFailed(id, 'NO_GRAPHS_FOUND', 'LLM ไม่พบเนื้อหาการแก้ปัญหาในหน้าที่เลือก — ลองเลือกหน้าส่วน Troubleshooting');
        return;
      }

      const graphs = assignGraphIds(draft.manualId, collected);
      const report = this.validate(draft.manualId, draft.meta, graphs, draft.pages, id);
      await this.store.markReady(id, graphs, report);
      this.logger.log(`ร่าง ${id} พร้อมตรวจ: ${graphs.length} ผัง · error ${report.errors.length} · warning ${report.warnings.length}`);
    } catch (err) {
      const { code, message } = this.describeFailure(err);
      this.logger.warn(`ร่าง ${id} ล้มเหลว [${code}]`);
      await this.store.markFailed(id, code, message).catch(() => undefined);
    } finally {
      this.busy = false;
    }
  }

  private describeFailure(err: unknown): { code: string; message: string } {
    if (err instanceof DraftLlmError) return { code: err.code, message: err.message };
    if (err instanceof DraftParseError) return { code: 'LLM_PARSE_ERROR', message: err.message };
    return { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระหว่างร่างผัง' };
  }

  // ============================================================
  // อ่าน / แก้ / ปฏิเสธ
  // ============================================================

  async list(): Promise<{ items: DraftSummaryDto[] }> {
    const rows = await this.store.list();
    return {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        manualId: row.manualId,
        brand: row.meta.brand,
        modelPattern: row.meta.model_pattern,
        sourceManual: row.meta.source_manual,
        pageFrom: row.meta.page_from,
        pageTo: row.meta.page_to,
        graphCount: row.graphCount,
        progress: { done: row.progressDone, total: row.progressTotal },
        error: row.errorCode === null ? null : { code: row.errorCode, message: row.errorMessage ?? '' },
        validationCounts:
          row.errorCountInValidation === null && row.warningCountInValidation === null
            ? null
            : { errors: row.errorCountInValidation ?? 0, warnings: row.warningCountInValidation ?? 0 },
        createdAt: iso(row.createdAtEpoch) as string,
        updatedAt: iso(row.updatedAtEpoch) as string,
      })),
    };
  }

  async get(rawId: string): Promise<DraftDetailDto> {
    return this.toDetail(await this.requireDraft(this.requireId(rawId)));
  }

  /** PUT /admin/drafts/:id — ผู้ดูแลแก้ผัง (ready เท่านั้น) · ตรวจใหม่ทุกครั้ง ผลตรวจผู้ใช้แก้เองไม่ได้ */
  async update(rawId: string, graphsRaw: unknown): Promise<DraftDetailDto> {
    const id = this.requireId(rawId);
    const draft = await this.requireDraft(id);
    if (draft.status !== 'ready') throw new DraftNotReadyError('edit', draft.status);

    let graphs: DraftGraph[];
    try {
      graphs = parseDraftGraphs(graphsRaw);
    } catch (err) {
      if (err instanceof DraftParseError) throw new InvalidDraftRequestError(err.message);
      throw err;
    }

    const report = this.validate(draft.manualId, draft.meta, graphs, draft.pages, id);
    if (!(await this.store.saveEdit(id, graphs, report))) throw new DraftNotReadyError('edit', 'เปลี่ยนไปแล้ว');
    return this.get(id);
  }

  async reject(rawId: string, userId: string, reason: string | undefined): Promise<DraftDetailDto> {
    const id = this.requireId(rawId);
    const draft = await this.requireDraft(id);
    if (!(await this.store.reject(id, userId, reason))) throw new DraftNotReadyError('reject', draft.status);
    return this.get(id);
  }

  // ============================================================
  // เผยแพร่
  // ============================================================

  /**
   * POST /admin/drafts/:id/publish { acknowledgedWarnings }
   *
   * ตรวจซ้ำในฝั่งเซิร์ฟเวอร์กับข้อมูลที่ล็อกไว้ใน transaction (ไม่เชื่อรายงานที่เก็บไว้):
   *   error ≥ 1                         → DraftInvalidError (ไม่มี override)
   *   warning ≥ 1 และไม่มี flag         → WarningsNotAcknowledgedError
   *   id ชนของเดิม                       → DraftIdConflictError (ไม่เขียนทับ)
   * สำเร็จแล้ว: reload GraphRepository → เพิ่มผังเข้าดัชนีค้นหา (ล้มเหลวไม่ทำให้ publish ที่สำเร็จแล้วกลายเป็นล้ม)
   */
  async publish(rawId: string, userId: string, acknowledgedWarnings: boolean): Promise<PublishResultDto> {
    const id = this.requireId(rawId);

    const graphIds = await this.store.publish(id, userId, (draft): PreparedPublish => {
      if (!draft.graphs) throw new DraftNotReadyError('publish', draft.status);
      const graphs = parseDraftGraphs(draft.graphs); // ข้อมูลใน DB ก็ถูกตรวจรูปร่างซ้ำ (กันถูกแก้นอกระบบ)
      const manual = assembleManual(draft.manualId, draft.meta, graphs, draft.id);
      const report = validateManual(manual, { mode: 'draft', pages: this.pageMap(draft.pages) });

      if (report.errors.length > 0) throw new DraftInvalidError(report.errors.length);
      if (report.warnings.length > 0 && !acknowledgedWarnings) throw new WarningsNotAcknowledgedError(report.warnings.length);

      return { rows: toDbRows(manual), report, graphIds: graphs.map((g) => g.graph_id) };
    });

    try {
      await this.graphRepository.reload();
    } catch (err) {
      this.logger.error(`publish ${id} สำเร็จแต่ reload ผังไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
      throw new PublishReloadError();
    }

    const searchIndex = await this.symptomSearch.addGraphs(graphIds);
    this.logger.log(`เผยแพร่ร่าง ${id}: ${graphIds.length} ผัง · ดัชนีค้นหา ${searchIndex.indexed ? 'อัปเดตแล้ว' : 'ไม่ได้อัปเดต'}`);
    return {
      id,
      status: 'published',
      graphIds,
      searchIndex: { indexed: searchIndex.indexed, ...(searchIndex.reason !== undefined ? { reason: searchIndex.reason } : {}) },
    };
  }

  // ============================================================
  // ตัวช่วยภายใน
  // ============================================================

  private requireId(raw: string): string {
    if (!UUID_PATTERN.test(raw)) throw new DraftNotFoundError(raw);
    return raw.toLowerCase();
  }

  private async requireDraft(id: string): Promise<DraftRecord> {
    const draft = await this.store.findById(id);
    if (!draft) throw new DraftNotFoundError(id);
    return draft;
  }

  private pageMap(pages: PageText[]): Map<number, string> {
    return new Map(pages.map((p) => [p.page, p.text]));
  }

  private validate(manualId: string, meta: DraftRecord['meta'], graphs: DraftGraph[], pages: PageText[], draftId: string): ValidationReport {
    const manual = assembleManual(manualId, meta, graphs, draftId);
    const report = validateManual(manual, { mode: 'draft', pages: this.pageMap(pages) });

    // ชนกับผังที่ใช้งานอยู่แล้ว — แจ้งตั้งแต่ตอนตรวจ ไม่รอถึง publish (publish ตรวจซ้ำกับฐานข้อมูลอีกชั้น)
    for (const graph of graphs) {
      if (this.graphRepository.findById(graph.graph_id)) {
        report.errors.push({ code: 'E_ID_CONFLICT', message: `graph_id '${graph.graph_id}' ชนกับผังที่ใช้งานอยู่ (ไม่เขียนทับ)`, graphId: graph.graph_id });
      }
    }
    if (this.graphRepository.listManuals().some((m) => m.manualId === manualId)) {
      report.errors.push({ code: 'E_ID_CONFLICT', message: `manual_id '${manualId}' มีอยู่แล้ว (เผยแพร่ได้เฉพาะคู่มือใหม่)` });
    }
    return report;
  }

  private toDetail(draft: DraftRecord): DraftDetailDto {
    return {
      id: draft.id,
      status: draft.status,
      manualId: draft.manualId,
      brand: draft.meta.brand,
      modelPattern: draft.meta.model_pattern,
      sourceManual: draft.meta.source_manual,
      pageFrom: draft.meta.page_from,
      pageTo: draft.meta.page_to,
      graphCount: draft.graphs === null ? null : draft.graphs.length,
      progress: { done: draft.progressDone, total: draft.progressTotal },
      error: draft.errorCode === null ? null : { code: draft.errorCode, message: draft.errorMessage ?? '' },
      validationCounts: draft.validation === null ? null : { errors: draft.validation.errors.length, warnings: draft.validation.warnings.length },
      createdAt: iso(draft.createdAtEpoch) as string,
      updatedAt: iso(draft.updatedAtEpoch) as string,
      meta: draft.meta,
      pages: draft.pages,
      graphs: draft.graphs,
      validation: draft.validation,
      llm: { model: draft.llmModel, promptVersion: draft.promptVersion },
      reviewedAt: iso(draft.reviewedAtEpoch),
      publishedAt: iso(draft.publishedAtEpoch),
    };
  }
}
