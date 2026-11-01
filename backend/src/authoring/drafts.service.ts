import { randomUUID } from 'node:crypto';
import { isoFromEpoch, UUID_PATTERN } from '../common/helpers';
import { createLogger } from '../common/logger';
import { SymptomSearchService } from '../symptom-search/symptom-search.service';
import { FlowRepository } from '../execution/flow.repository';
import { DraftLlmError, PROMPT_VERSION } from './draft-llm.client';
import type { DraftLlmClient } from './draft-llm.client';
import { assembleManual, toDbRows } from './draft-manual';
import { DraftParseError, assignFlowIds, parseDraftFlows, parseLlmOutput } from './draft-schema';
import type { DraftFlow, LlmFlow } from './draft-schema';
import type { DraftDetailDto, DraftSummaryDto, PublishResultDto, UploadFields } from './drafts.dto';
import { draftBusy, draftIdConflict, draftInvalid, draftNotFound, draftNotReady, invalidDraftRequest, pdfUnsupportedType, publishReloadFailed, warningsNotAcknowledged } from './drafts.errors';
import { DraftsStore } from './drafts.store';
import type { DraftRecord, PreparedPublish } from './drafts.store';
import { validateManual } from './flow-validator';
import type { ValidationReport } from './flow-validator';
import type { PageText, PdfTextExtractor } from './pdf-text';

const PAGES_PER_LLM_CALL = 2;

const iso = (epoch: number | null): string | null => (epoch === null ? null : isoFromEpoch(epoch));

function chunkPages(pages: PageText[], size: number = PAGES_PER_LLM_CALL): PageText[][] {
  const groups: PageText[][] = [];
  for (let i = 0; i < pages.length; i += size) groups.push(pages.slice(i, i + size));
  return groups;
}

export class DraftsService {
  private readonly logger = createLogger('DraftsService');
  private busy = false;

  constructor(
    private readonly store: DraftsStore,
    private readonly flowRepository: FlowRepository,
    private readonly symptomSearch: SymptomSearchService,
    private readonly extractor: PdfTextExtractor,
    private readonly llm: DraftLlmClient | null = null,
  ) {}

  async failInterruptedDrafts(): Promise<void> {
    try {
      const interrupted = await this.store.failInterrupted();
      if (interrupted > 0) this.logger.warn(`ร่างที่ค้างสถานะ drafting ${interrupted} รายการ ถูกเปลี่ยนเป็น failed (เซิร์ฟเวอร์เริ่มใหม่)`);
    } catch (err) {
      this.logger.error(`ตรวจร่างที่ค้างไม่สำเร็จ (รัน migration 012 แล้วหรือยัง?): ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  /** POST /admin/drafts — รับ PDF  แยกข้อความช่วงหน้าที่เลือก บันทึกร่างสถานะ drafting ร่างต่อเบื้องหลังไฟล์ PDF ไม่ถูกเก็บ */
  async createFromUpload(file: { buffer: Buffer } | undefined, fields: UploadFields, userId: string): Promise<{ id: string }> {
    if (!file || file.buffer.length === 0) throw invalidDraftRequest('ต้องแนบไฟล์ PDF ในฟิลด์ file');
    if (!file.buffer.subarray(0, 1024).includes('%PDF-')) throw pdfUnsupportedType();

    if (this.busy) throw draftBusy();
    this.busy = true;
    try {
      if ((await this.store.countDrafting()) > 0) throw draftBusy();
      if (this.flowRepository.listManuals().some((m) => m.manualId === fields.manualId)) {
        throw draftIdConflict([`manual_id '${fields.manualId}' มีอยู่แล้ว (เผยแพร่ได้เฉพาะคู่มือใหม่)`]);
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

      void this.runDrafting(id);
      return { id };
    } catch (err) {
      this.busy = false;
      throw err;
    }
  }

  /** เรียก LLM */
  private async runDrafting(id: string): Promise<void> {
    try {
      const draft = await this.requireDraft(id);
      if (!this.llm) {
        await this.store.markFailed(id, 'LLM_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่า LLM (GROQ_API_KEY และ AUTHORING_LLM_MODEL ใน .env)');
        return;
      }

      const collected: LlmFlow[] = [];
      const groups = chunkPages(draft.pages);
      for (let index = 0; index < groups.length; index += 1) {
        const raw = await this.llm.draft({ manualId: draft.manualId, meta: draft.meta, pages: groups[index] });
        collected.push(...parseLlmOutput(raw));
        await this.store.setProgress(id, index + 1);
      }

      if (collected.length === 0) {
        await this.store.markFailed(id, 'NO_FLOWS_FOUND', 'LLM ไม่พบเนื้อหาการแก้ปัญหาในหน้าที่เลือก — ลองเลือกหน้าส่วน Troubleshooting');
        return;
      }

      const flows = assignFlowIds(draft.manualId, collected);
      const report = this.validate(draft.manualId, draft.meta, flows, draft.pages, id);
      await this.store.markReady(id, flows, report);
      this.logger.log(`ร่าง ${id} พร้อมตรวจ: ${flows.length} ผัง · error ${report.errors.length} · warning ${report.warnings.length}`);
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
        flowCount: row.flowCount,
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

  /** PUT /admin/drafts/:id */
  async update(rawId: string, flowsRaw: unknown): Promise<DraftDetailDto> {
    const id = this.requireId(rawId);
    const draft = await this.requireDraft(id);
    if (draft.status !== 'ready') throw draftNotReady('edit', draft.status);

    let flows: DraftFlow[];
    try {
      flows = parseDraftFlows(flowsRaw);
    } catch (err) {
      if (err instanceof DraftParseError) throw invalidDraftRequest(err.message);
      throw err;
    }

    const report = this.validate(draft.manualId, draft.meta, flows, draft.pages, id);
    if (!(await this.store.saveEdit(id, flows, report))) throw draftNotReady('edit', 'เปลี่ยนไปแล้ว');
    return this.get(id);
  }

  async reject(rawId: string, userId: string, reason: string | undefined): Promise<DraftDetailDto> {
    const id = this.requireId(rawId);
    const draft = await this.requireDraft(id);
    if (!(await this.store.reject(id, userId, reason))) throw draftNotReady('reject', draft.status);
    return this.get(id);
  }


  /** POST /admin/drafts/:id/publish { acknowledgedWarnings } */
  async publish(rawId: string, userId: string, acknowledgedWarnings: boolean): Promise<PublishResultDto> {
    const id = this.requireId(rawId);

    const flowIds = await this.store.publish(id, userId, (draft): PreparedPublish => {
      if (!draft.flows) throw draftNotReady('publish', draft.status);
      const flows = parseDraftFlows(draft.flows); // ข้อมูลใน DB ก็ถูกตรวจรูปร่างซ้ำ (กันถูกแก้นอกระบบ)
      const manual = assembleManual(draft.manualId, draft.meta, flows, draft.id);
      const report = validateManual(manual, this.pageMap(draft.pages));

      if (report.errors.length > 0) throw draftInvalid(report.errors.length);
      if (report.warnings.length > 0 && !acknowledgedWarnings) throw warningsNotAcknowledged(report.warnings.length);

      return { rows: toDbRows(manual), report, flowIds: flows.map((g) => g.flow_id) };
    });

    try {
      await this.flowRepository.reload();
    } catch (err) {
      this.logger.error(`publish ${id} สำเร็จแต่ reload ผังไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
      throw publishReloadFailed();
    }

    const searchIndex = await this.symptomSearch.addFlows(flowIds);
    this.logger.log(`เผยแพร่ร่าง ${id}: ${flowIds.length} ผัง · ดัชนีค้นหา ${searchIndex.indexed ? 'อัปเดตแล้ว' : 'ไม่ได้อัปเดต'}`);
    return {
      id,
      status: 'published',
      flowIds,
      searchIndex: { indexed: searchIndex.indexed, ...(searchIndex.reason !== undefined ? { reason: searchIndex.reason } : {}) },
    };
  }

  private requireId(raw: string): string {
    if (!UUID_PATTERN.test(raw)) throw draftNotFound(raw);
    return raw.toLowerCase();
  }

  private async requireDraft(id: string): Promise<DraftRecord> {
    const draft = await this.store.findById(id);
    if (!draft) throw draftNotFound(id);
    return draft;
  }

  private pageMap(pages: PageText[]): Map<number, string> {
    return new Map(pages.map((p) => [p.page, p.text]));
  }

  private validate(manualId: string, meta: DraftRecord['meta'], flows: DraftFlow[], pages: PageText[], draftId: string): ValidationReport {
    const manual = assembleManual(manualId, meta, flows, draftId);
    const report = validateManual(manual, this.pageMap(pages));

    for (const flow of flows) {
      if (this.flowRepository.findById(flow.flow_id)) {
        report.errors.push({ code: 'E_ID_CONFLICT', message: `flow_id '${flow.flow_id}' ชนกับผังที่ใช้งานอยู่ (ไม่เขียนทับ)`, flowId: flow.flow_id });
      }
    }
    if (this.flowRepository.listManuals().some((m) => m.manualId === manualId)) {
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
      flowCount: draft.flows === null ? null : draft.flows.length,
      progress: { done: draft.progressDone, total: draft.progressTotal },
      error: draft.errorCode === null ? null : { code: draft.errorCode, message: draft.errorMessage ?? '' },
      validationCounts: draft.validation === null ? null : { errors: draft.validation.errors.length, warnings: draft.validation.warnings.length },
      createdAt: iso(draft.createdAtEpoch) as string,
      updatedAt: iso(draft.updatedAtEpoch) as string,
      meta: draft.meta,
      pages: draft.pages,
      flows: draft.flows,
      validation: draft.validation,
      llm: { model: draft.llmModel, promptVersion: draft.promptVersion },
      reviewedAt: iso(draft.reviewedAtEpoch),
      publishedAt: iso(draft.publishedAtEpoch),
    };
  }
}
