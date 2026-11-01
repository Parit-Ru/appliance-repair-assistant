import type { SessionOwner } from '../auth/session-owner';
import { ApiError } from '../common/api-error';
import { isoFromEpoch } from '../common/helpers';
import { getCurrentState, getOutcomeKind, submitAction as engineSubmitAction } from '../state-machine/state-machine';
import { ExecutionError } from '../state-machine/types';
import type { RenderedState, SessionHistoryEntry, SessionState, TroubleshootingFlow } from '../state-machine/types';
import { FlowRepository } from '../execution/flow.repository';
import type { ManualSummary } from '../execution/flow.repository';
import type { HistoryDetailDto, HistoryFeedbackDto, HistoryFlowInfo, HistoryListItemDto, HistoryListResponseDto, HistoryQuery, HistoryStepDto } from './history.dto';
import { HistoryStore } from './history.store';
import type { CompletedSession, CompletedSessionSummary } from './history.store';


const historyNotFound = (sessionId: string) =>
  new ApiError(404, 'HISTORY_NOT_FOUND', `ไม่พบรายการประวัติ '${sessionId}' (อาจถูกลบ หมดอายุ หรือไม่ใช่ของคุณ)`);

export class HistoryService {
  constructor(
    private readonly store: HistoryStore,
    private readonly flowRepository: FlowRepository,
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
    const flow = this.flowRepository.findById(session.flowId);
    const steps = flow ? await this.store.findSteps(sessionId) : [];

    return this.buildDetail(session, flow, steps, feedback ?? null);
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
    return new Map(this.flowRepository.listManuals().map((manual) => [manual.manualId, manual]));
  }

  private toListItem(summary: CompletedSessionSummary, manuals: Map<string, ManualSummary>): HistoryListItemDto {
    const flow = this.flowRepository.findById(summary.flowId);
    const outcomeKind = flow ? getOutcomeKind(flow, summary.currentStateId) : null;

    return {
      sessionId: summary.sessionId,
      flowId: summary.flowId,
      startedAt: isoFromEpoch(summary.startedAtEpoch),
      outcomeKind,
      flow: flowInfoOf(flow, manuals),
    };
  }

  private buildDetail(
    session: CompletedSession,
    flow: TroubleshootingFlow | undefined,
    entries: SessionHistoryEntry[],
    feedback: HistoryFeedbackDto | null,
  ): HistoryDetailDto {
    const base = {
      sessionId: session.sessionId,
      flowId: session.flowId,
      startedAt: isoFromEpoch(session.startedAtEpoch),
      modelSelection: session.modelSelection,
      confidence: session.confidence,
      flow: flowInfoOf(flow, this.manualsById()),
      outcome: session.outcomeText,
      feedback,
    };

    const unavailable: HistoryDetailDto = {
      ...base,
      outcomeKind: null,
      available: false,
      steps: [],
      finalState: null,
      safetyWarnings: [],
      reference: null,
    };

    if (!flow) return unavailable;

    const finalState = renderStateIfPresent(flow, session.currentStateId, session.variables);
    if (!finalState || !finalState.isTerminal || !finalState.outcomeKind) return unavailable;

    // เดินขั้นตอนที่บันทึกไว้ซ้ำผ่าน engine ในผังปัจจุบัน ต้องไปจบที่สถานะเดิม
    // กันกรณีผังถูกแก้ทางเดิน (on_yes/on_no/next เปลี่ยน) แล้วเราโชว์ขั้นเก่าคู่กับข้อสรุปใหม่ที่ไม่เกี่ยวกัน
    if (!replayReaches(flow, entries, session.currentStateId)) return unavailable;

    const steps: HistoryStepDto[] = [];
    for (const entry of entries) {
      const state = renderStateIfPresent(flow, entry.stateId, session.variables);
      if (!state || !entry.action) return unavailable;
      steps.push({ state, action: entry.action });
    }

    const safetyWarnings: string[] = [];
    for (const state of [...steps.map((step) => step.state), finalState]) {
      const warning = state.safetyWarning?.trim();
      if (warning && !safetyWarnings.includes(warning)) safetyWarnings.push(warning);
    }

    return {
      ...base,
      outcomeKind: finalState.outcomeKind,
      available: true,
      steps,
      finalState,
      safetyWarnings,
      reference: finalState.reference,
    };
  }
}

function flowInfoOf(
  flow: TroubleshootingFlow | undefined,
  manuals: Map<string, ManualSummary>,
): HistoryFlowInfo | null {
  if (!flow) return null;
  return {
    manualId: flow.manual_id,
    entrySymptom: flow.entry_symptom,
    entrySymptomTh: flow.entry_symptom_th,
    deviceCategory: flow.device_category,
    brand: flow.brand,
    modelPattern: flow.model_pattern,
    displayName: manuals.get(flow.manual_id)?.displayName,
  };
}

function renderStateIfPresent(
  flow: TroubleshootingFlow,
  stateId: string,
  variables: Record<string, string>,
): RenderedState | undefined {
  if (!flow.states.some((state) => state.state_id === stateId)) return undefined;

  const session: SessionState = {
    sessionId: 'history-view',
    flowId: flow.flow_id,
    currentStateId: stateId,
    status: 'completed',
    variables,
    history: [],
  };
  return getCurrentState(session, flow);
}

/*
 เดินตามขั้นที่บันทึกไว้ผ่าน submitAction ของ engine เริ่มจากสถานะแรกของผังปัจจุบัน
ผ่านเมื่อ: แต่ละขั้นอยู่ที่สถานะเดียวกับที่บันทึก, engine ยอมรับ action ทุกตัว, และจบที่สถานะสุดท้ายเดิมในสถานะ completed*/
function replayReaches(
  flow: TroubleshootingFlow,
  entries: SessionHistoryEntry[],
  finalStateId: string,
): boolean {
  let replay: SessionState = {
    sessionId: 'history-replay',
    flowId: flow.flow_id,
    currentStateId: flow.initial_state,
    status: 'in_progress',
    variables: {},
    history: [],
  };

  for (const entry of entries) {
    if (!entry.action || replay.currentStateId !== entry.stateId) return false;
    try {
      replay = engineSubmitAction(replay, flow, entry.action).session;
    } catch (error) {
      if (error instanceof ExecutionError) return false;
      throw error;
    }
  }

  return replay.status === 'completed' && replay.currentStateId === finalStateId;
}
