import type { SessionOwner } from '../auth/session-owner';
import { ApiError } from '../common/api-error';
import { isoFromEpoch } from '../common/helpers';
import { getCurrentNode, getOutcomeKind, submitAction as engineSubmitAction } from '../traversal-engine/traversal-engine';
import { TraversalError } from '../traversal-engine/types';
import type { RenderedNode, SessionHistoryEntry, SessionState, TroubleshootingGraph } from '../traversal-engine/types';
import { GraphRepository } from '../traversal/graph.repository';
import type { ManualSummary } from '../traversal/graph.repository';
import type { HistoryDetailDto, HistoryFeedbackDto, HistoryGraphInfo, HistoryListItemDto, HistoryListResponseDto, HistoryQuery, HistoryStepDto } from './history.dto';
import { HistoryStore } from './history.store';
import type { CompletedSession, CompletedSessionSummary } from './history.store';


const historyNotFound = (sessionId: string) =>
  new ApiError(404, 'HISTORY_NOT_FOUND', `ไม่พบรายการประวัติ '${sessionId}' (อาจถูกลบ หมดอายุ หรือไม่ใช่ของคุณ)`);

export class HistoryService {
  constructor(
    private readonly store: HistoryStore,
    private readonly graphRepository: GraphRepository,
  ) {}

  /** GET /history */
  async list(owner: SessionOwner, query: HistoryQuery): Promise<HistoryListResponseDto> {
    const summaries = await this.store.listCompleted(owner);
    const manuals = this.manualsById();

    const sorted = [...summaries].sort(
      (a, b) => b.startedAtEpoch - a.startedAtEpoch || b.sessionId.localeCompare(a.sessionId),
    );

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.pageSize;

    return {
      items: sorted.slice(start, start + query.pageSize).map((summary) => this.toListItem(summary, manuals)),
      total,
      page,
      pageSize: query.pageSize,
      totalPages,
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

  /** DELETE /history/:id */
  async remove(owner: SessionOwner, sessionId: string): Promise<void> {
    const deleted = await this.store.deleteCompleted(sessionId, owner);
    if (!deleted) {
      throw historyNotFound(sessionId);
    }
  }

  /** POST /history/:id/feedback */
  async saveFeedback(
    owner: SessionOwner,
    sessionId: string,
    body: HistoryFeedbackDto,
  ): Promise<HistoryFeedbackDto> {
    await this.requireOwned(sessionId, owner);
    await this.store.saveFeedback(sessionId, body);
    return { helpful: body.helpful, comment: body.comment };
  }

  private async requireOwned(sessionId: string, owner: SessionOwner): Promise<CompletedSession> {
    const session = await this.store.findCompleted(sessionId, owner);
    if (!session) throw historyNotFound(sessionId);
    return session;
  }

  private manualsById(): Map<string, ManualSummary> {
    return new Map(this.graphRepository.listManuals().map((manual) => [manual.manualId, manual]));
  }

  private toListItem(summary: CompletedSessionSummary, manuals: Map<string, ManualSummary>): HistoryListItemDto {
    const graph = this.graphRepository.findById(summary.graphId);
    const outcomeKind = graph ? getOutcomeKind(graph, summary.currentNodeId) : null;

    return {
      sessionId: summary.sessionId,
      graphId: summary.graphId,
      startedAt: isoFromEpoch(summary.startedAtEpoch),
      outcomeKind,
      graph: graphInfoOf(graph, manuals),
    };
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
      startedAt: isoFromEpoch(session.startedAtEpoch),
      modelSelection: session.modelSelection,
      confidence: session.confidence,
      graph: graphInfoOf(graph, this.manualsById()),
      outcome: session.outcomeText,
      feedback,
    };

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

/*
 เดินตามขั้นที่บันทึกไว้ผ่าน submitAction ของ engine เริ่มจากโหนดแรกของผังปัจจุบัน
ผ่านเมื่อ: แต่ละขั้นอยู่ที่โหนดเดียวกับที่บันทึก, engine ยอมรับ action ทุกตัว, และจบที่โหนดสุดท้ายเดิมในสถานะ completed*/
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
      if (error instanceof TraversalError) return false;
      throw error;
    }
  }

  return state.status === 'completed' && state.currentNodeId === finalNodeId;
}
