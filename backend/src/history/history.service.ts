/**
 * history.service.ts — หน้า "ประวัติการซ่อม": รายการ, รายละเอียด, ลบ, ให้คะแนน
 *
 * กฎเหมือน traversal.service.ts: ไฟล์นี้ไม่ตัดสินเรื่องขั้นตอนเอง
 *   - โหนด/ข้อความทุกอย่างมาจาก engine (getCurrentNode / submitAction) ตรงๆ ไม่ดัดแปลง ไม่แต่งเพิ่ม
 *   - ไม่เรียก LLM (ไม่มี displayText): ประวัติแสดงข้อความต้นฉบับของคู่มือเท่านั้น
 *   - ไม่คิดเกณฑ์ confidence ใหม่ และไม่เดา "สาเหตุที่เป็นไปได้" (ไม่มีข้อมูลนี้ในผัง)
 *
 * ผังที่ถูก seed ใหม่ (seed-graphs.js ลบ nodes แล้ว insert ใหม่) เป็นเรื่องที่คาดไว้:
 *   - รายการ: แถวที่ผัง/โหนดหายไม่ทำให้ทั้งรายการล้ม ส่ง graph/outcomeKind เป็น null ให้หน้าจอแสดงแบบจำกัดข้อมูล
 *   - รายละเอียด: ตอบ available=false (200) ไม่ใช่ 500 — ดู buildDetail()
 *
 * การกรอง/เรียง/แบ่งหน้าทำในหน่วยความจำ เพราะประวัติของคนเดียวมีน้อย (เพดาน MAX_HISTORY_ROWS)
 * และข้อมูลผังอยู่ในหน่วยความจำอยู่แล้ว (GraphRepository) ไม่ต้อง JOIN ใน SQL
 */

import { Injectable } from '@nestjs/common';

import type { SessionOwner } from '../auth/session-owner';
import { getCurrentNode, submitAction as engineSubmitAction } from '../traversal-engine/traversal-engine';
import { TraversalError } from '../traversal-engine/types';
import type {
  OutcomeKind,
  RenderedNode,
  SessionHistoryEntry,
  SessionState,
  TroubleshootingGraph,
} from '../traversal-engine/types';
import { GraphRepository } from '../traversal/graph.repository';
import type { ManualSummary } from '../traversal/graph.repository';
import { DEVICE_CATEGORIES } from './history.dto';
import type {
  FeedbackBody,
  HistoryDetailDto,
  HistoryFeedbackDto,
  HistoryGraphInfo,
  HistoryListItemDto,
  HistoryListResponseDto,
  HistoryQuery,
  HistoryStepDto,
} from './history.dto';
import { HistoryStore } from './history.store';
import type { CompletedSession, CompletedSessionSummary } from './history.store';

/**
 * ไม่พบ session ในประวัติของผู้ถามคนนี้ → 404 HISTORY_NOT_FOUND
 * ครอบคลุมทั้ง: ไม่มี id นี้, เป็นของคนอื่น, ยังไม่จบ, หมดอายุแล้ว — ตอบเหมือนกันหมด
 * ไม่บอกว่า id นั้นมีอยู่จริงแต่เป็นของคนอื่น (ไม่ใช่ 403)
 */
export class HistoryNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`ไม่พบรายการประวัติ '${sessionId}' (อาจถูกลบ หมดอายุ หรือไม่ใช่ของคุณ)`);
    this.name = this.constructor.name;
  }
}

interface ListEntry {
  epoch: number;
  item: HistoryListItemDto;
  /** ข้อความตัวพิมพ์เล็กรวมชื่ออาการ/ยี่ห้อ/รุ่น ไว้ค้นหา */
  haystack: string;
}

@Injectable()
export class HistoryService {
  constructor(
    private readonly store: HistoryStore,
    private readonly graphRepository: GraphRepository,
  ) {}

  /** GET /history */
  async list(owner: SessionOwner, query: HistoryQuery): Promise<HistoryListResponseDto> {
    const summaries = await this.store.listCompleted(owner);
    const manuals = this.manualsById();

    const entries = summaries.map((summary) => this.toListEntry(summary, manuals));

    // ตัวเลือกของตัวกรองนับจากประวัติทั้งหมด (ก่อนกรอง) เพื่อไม่ให้ตัวเลือกหายไปเมื่อกรองอยู่
    const categories = new Set<string>();
    const brands = new Set<string>();
    for (const { item } of entries) {
      if (item.graph) {
        categories.add(item.graph.deviceCategory);
        brands.add(item.graph.brand);
      }
    }

    const terms = (query.q ?? '').toLowerCase().split(/\s+/).filter((t) => t !== '');
    const brandFilter = query.brand?.toLowerCase();

    const filtered = entries.filter(({ item, haystack }) => {
      // แถวที่ผังหาย (graph/outcomeKind = null) ไม่ตรงตัวกรองที่ต้องรู้ข้อมูลนั้น จึงปรากฏเฉพาะตอนไม่กรองด้วยมัน
      if (query.category !== undefined && item.graph?.deviceCategory !== query.category) return false;
      if (brandFilter !== undefined && item.graph?.brand.toLowerCase() !== brandFilter) return false;
      if (query.status !== undefined && item.outcomeKind !== query.status) return false;
      return terms.every((term) => haystack.includes(term));
    });

    const direction = query.sort === 'oldest' ? 1 : -1;
    filtered.sort(
      (a, b) =>
        direction * (a.epoch - b.epoch) ||
        direction * a.item.sessionId.localeCompare(b.item.sessionId),
    );

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize).map((entry) => entry.item),
      total,
      page,
      pageSize: query.pageSize,
      totalPages,
      facets: {
        categories: DEVICE_CATEGORIES.filter((category) => categories.has(category)),
        brands: [...brands].sort((a, b) => a.localeCompare(b)),
      },
    };
  }

  /** GET /history/:id */
  async detail(owner: SessionOwner, sessionId: string): Promise<HistoryDetailDto> {
    const session = await this.requireOwned(sessionId, owner);
    const feedback = await this.store.findFeedback(sessionId);
    const graph = this.graphRepository.findById(session.graphId);
    const steps = graph ? await this.store.findSteps(sessionId) : [];

    return this.buildDetail(session, graph, steps, feedback ?? null);
  }

  /** DELETE /history/:id — ลบทั้ง session (เจ้าของเท่านั้น) */
  async remove(owner: SessionOwner, sessionId: string): Promise<void> {
    const deleted = await this.store.deleteCompleted(sessionId, owner);
    if (!deleted) {
      throw new HistoryNotFoundError(sessionId);
    }
  }

  /** POST /history/:id/feedback — 1 session 1 คะแนน ส่งซ้ำ = แก้ค่าเดิม */
  async saveFeedback(
    owner: SessionOwner,
    sessionId: string,
    body: FeedbackBody,
  ): Promise<HistoryFeedbackDto> {
    await this.requireOwned(sessionId, owner);
    await this.store.saveFeedback(sessionId, body);
    return { helpful: body.helpful, comment: body.comment };
  }

  // ============================================================
  // ตัวช่วยภายใน
  // ============================================================

  private async requireOwned(sessionId: string, owner: SessionOwner): Promise<CompletedSession> {
    const session = await this.store.findCompleted(sessionId, owner);
    if (!session) throw new HistoryNotFoundError(sessionId);
    return session;
  }

  private manualsById(): Map<string, ManualSummary> {
    return new Map(this.graphRepository.listManuals().map((manual) => [manual.manualId, manual]));
  }

  private toListEntry(
    summary: CompletedSessionSummary,
    manuals: Map<string, ManualSummary>,
  ): ListEntry {
    const graph = this.graphRepository.findById(summary.graphId);
    const graphInfo = graphInfoOf(graph, manuals);

    // รายการดูแค่โหนดสุดท้ายว่าเป็นโหนดสิ้นสุดชนิดไหน (ไม่ replay ขั้นตอนทั้งหมดเพราะต้องดึงประวัติทีละ session)
    // ตัวตรวจเข้มของการ replay อยู่ที่รายละเอียด (buildDetail)
    const finalNode = graph ? renderNodeIfPresent(graph, summary.currentNodeId, {}) : undefined;
    const outcomeKind: OutcomeKind | null =
      finalNode?.isTerminal === true ? (finalNode.outcomeKind ?? null) : null;

    const item: HistoryListItemDto = {
      sessionId: summary.sessionId,
      graphId: summary.graphId,
      startedAt: new Date(summary.startedAtEpoch * 1000).toISOString(),
      outcomeKind,
      graph: graphInfo,
    };

    const haystack = graphInfo
      ? [
          graphInfo.entrySymptomTh,
          graphInfo.entrySymptom,
          graphInfo.brand,
          graphInfo.modelPattern,
          graphInfo.displayName,
        ]
          .filter((part): part is string => typeof part === 'string')
          .join(' ')
          .toLowerCase()
      : '';

    return { epoch: summary.startedAtEpoch, item, haystack };
  }

  private buildDetail(
    session: CompletedSession,
    graph: TroubleshootingGraph | undefined,
    entries: SessionHistoryEntry[],
    feedback: HistoryFeedbackDto | null,
  ): HistoryDetailDto {
    const base = {
      sessionId: session.sessionId,
      graphId: session.graphId,
      startedAt: new Date(session.startedAtEpoch * 1000).toISOString(),
      modelSelection: session.modelSelection,
      confidence: session.confidence,
      graph: graphInfoOf(graph, this.manualsById()),
      outcome: session.outcomeText,
      feedback,
    };

    // อ่านขั้นตอนย้อนหลังไม่ได้ → ไม่โยน error (ไม่ใช่ 500) ส่งสถานะนี้ไปให้หน้าจอบอกผู้ใช้
    // ไม่ปล่อยข้อมูลครึ่งๆ กลางๆ ออกไป: ไม่มี steps/finalNode/reference/คำเตือน มีแต่ของที่ผู้ใช้บันทึกเอง
    const unavailable: HistoryDetailDto = {
      ...base,
      outcomeKind: null,
      available: false,
      steps: [],
      finalNode: null,
      safetyWarnings: [],
      reference: null,
    };

    if (!graph) return unavailable;

    const finalNode = renderNodeIfPresent(graph, session.currentNodeId, session.variables);
    if (!finalNode || !finalNode.isTerminal || !finalNode.outcomeKind) return unavailable;

    // เดินขั้นตอนที่บันทึกไว้ซ้ำผ่าน engine ในผังปัจจุบัน ต้องไปจบที่โหนดเดิม
    // กันกรณีผังถูกแก้ทางเดิน (on_yes/on_no/next เปลี่ยน) แล้วเราโชว์ขั้นเก่าคู่กับข้อสรุปใหม่ที่ไม่เกี่ยวกัน
    if (!replayReaches(graph, entries, session.currentNodeId)) return unavailable;

    const steps: HistoryStepDto[] = [];
    for (const entry of entries) {
      const node = renderNodeIfPresent(graph, entry.nodeId, session.variables);
      if (!node || !entry.action) return unavailable;
      steps.push({ node, action: entry.action });
    }

    // คำเตือนเฉพาะที่ผังมีจริงตามโหนดที่ผ่าน ไม่มี = ไม่มีกล่อง (ไม่แต่งคำเตือนทั่วไปเพิ่ม)
    const safetyWarnings: string[] = [];
    for (const node of [...steps.map((step) => step.node), finalNode]) {
      const warning = node.safetyWarning?.trim();
      if (warning && !safetyWarnings.includes(warning)) safetyWarnings.push(warning);
    }

    return {
      ...base,
      outcomeKind: finalNode.outcomeKind,
      available: true,
      steps,
      finalNode,
      safetyWarnings,
      reference: finalNode.reference,
    };
  }
}

function graphInfoOf(
  graph: TroubleshootingGraph | undefined,
  manuals: Map<string, ManualSummary>,
): HistoryGraphInfo | null {
  if (!graph) return null;
  return {
    manualId: graph.manual_id,
    entrySymptom: graph.entry_symptom,
    entrySymptomTh: graph.entry_symptom_th,
    deviceCategory: graph.device_category,
    brand: graph.brand,
    modelPattern: graph.model_pattern,
    displayName: manuals.get(graph.manual_id)?.displayName,
  };
}

/**
 * render โหนดด้วย engine (getCurrentNode) ไม่ซ้ำตรรกะ — ไม่พบโหนด = undefined แทนการโยน NodeNotFoundError
 * เพราะ "โหนดหาย" เป็นสถานการณ์ปกติของข้อมูลย้อนหลัง ไม่ใช่ความผิดพลาดของระบบ
 */
function renderNodeIfPresent(
  graph: TroubleshootingGraph,
  nodeId: string,
  variables: Record<string, string>,
): RenderedNode | undefined {
  if (!graph.nodes.some((node) => node.node_id === nodeId)) return undefined;

  const session: SessionState = {
    sessionId: 'history-view',
    graphId: graph.graph_id,
    currentNodeId: nodeId,
    status: 'completed',
    variables,
    history: [],
  };
  return getCurrentNode(session, graph);
}

/**
 * เดินตามขั้นที่บันทึกไว้ผ่าน submitAction ของ engine เริ่มจากโหนดแรกของผังปัจจุบัน
 * ผ่านเมื่อ: แต่ละขั้นอยู่ที่โหนดเดียวกับที่บันทึก, engine ยอมรับ action ทุกตัว, และจบที่โหนดสุดท้ายเดิมในสถานะ completed
 */
function replayReaches(
  graph: TroubleshootingGraph,
  entries: SessionHistoryEntry[],
  finalNodeId: string,
): boolean {
  let state: SessionState = {
    sessionId: 'history-replay',
    graphId: graph.graph_id,
    currentNodeId: graph.entry_node,
    status: 'in_progress',
    variables: {},
    history: [],
  };

  for (const entry of entries) {
    if (!entry.action || state.currentNodeId !== entry.nodeId) return false;
    try {
      state = engineSubmitAction(state, graph, entry.action).session;
    } catch (error) {
      // ผังเปลี่ยนจน engine ไม่รับ action เดิม (InvalidAction / SafetyConfirmationRequired / NodeNotFound ฯลฯ)
      if (error instanceof TraversalError) return false;
      throw error;
    }
  }

  return state.status === 'completed' && state.currentNodeId === finalNodeId;
}
