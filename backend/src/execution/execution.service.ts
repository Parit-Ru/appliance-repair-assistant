//execution.service.ts — ต่อ FlowRepository, EquipmentRepository และ SessionStore เข้ากับเครื่องสถานะ (state-machine)

import type { SessionOwner } from '../auth/session-owner';
import { ApiError } from '../common/api-error';
import { FlowRepository } from './flow.repository';
import type { FlowSummary, ManualSummary } from './flow.repository';
import { EquipmentRepository } from './equipment.repository';
import { SessionStore } from './session.store';
import { SymptomSearchService } from '../symptom-search/symptom-search.service';
import { RephraseService } from '../rephrase/rephrase.service';
import type { ModelSelection, SessionResponseDto, SessionTrailStepDto } from './execution.dto';
import { getCurrentState, startSession as engineStartSession, submitAction as engineSubmitAction } from '../state-machine/state-machine';
import { ExecutionError } from '../state-machine/types';
import type { RenderedState, SessionState, ExecutionAction, TroubleshootingFlow } from '../state-machine/types';


const flowNotFound = (flowId: string) => new ApiError(404, 'FLOW_NOT_FOUND', `ไม่พบผังขั้นตอน '${flowId}'`);

const flowManualMismatch = (flowId: string, manualId: string) =>
  new ApiError(400, 'FLOW_MANUAL_MISMATCH', `ผังขั้นตอน '${flowId}' ไม่ใช่ของคู่มือ '${manualId}'`);

const sessionNotFound = (sessionId: string) =>
  new ApiError(404, 'SESSION_NOT_FOUND', `ไม่พบ session '${sessionId}' (อาจไม่เคยมีอยู่ หรือหมดอายุแล้ว)`);

const sessionNotCompleted = (sessionId: string) =>
  new ApiError(409, 'SESSION_NOT_COMPLETED', `session '${sessionId}' ยังไม่ถึงสถานะสิ้นสุด บันทึกผลลัพธ์ไม่ได้`);

const outcomeAlreadySubmitted = (sessionId: string) =>
  new ApiError(409, 'OUTCOME_ALREADY_SUBMITTED', `session '${sessionId}' บันทึกผลลัพธ์ไปแล้ว ส่งซ้ำไม่ได้`);

/**
 * ขั้นที่ผ่านมาแล้วของ session สำหรับสร้างเส้นทางเดินตอนกลับมาทำต่อ (render อย่างเดียว ไม่เดินผัง)
 * ผังถูกแก้จนหา state เก่าไม่เจอ → [] (แสดงเส้นทางเดิมไม่ได้ แต่เดินต่อจาก state ปัจจุบันได้ตามปกติ)
 */
function buildTrail(session: SessionState, flow: TroubleshootingFlow): SessionTrailStepDto[] {
  try {
    const trail: SessionTrailStepDto[] = [];
    for (const entry of session.history) {
      if (!entry.action) return [];
      trail.push({
        state: getCurrentState({ ...session, currentStateId: entry.stateId }, flow),
        action: entry.action,
      });
    }
    return trail;
  } catch (error) {
    if (error instanceof ExecutionError) return [];
    throw error;
  }
}

export class ExecutionService {
  constructor(
    private readonly flowRepository: FlowRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly sessionStore: SessionStore,
    private readonly symptomSearch: SymptomSearchService,
    private readonly rephrase: RephraseService,
  ) {}

  // GET /execution/flows 
  listFlows(manualId?: string): FlowSummary[] {
    const all = this.flowRepository.listAll();
    return manualId === undefined ? all : all.filter((g) => g.manualId === manualId);
  }

  // GET /execution/manuals
  listManuals(): ManualSummary[] {
    return this.flowRepository.listManuals();
  }

  /**
    POST /execution/sessions
    owner: เจ้าของ session สำหรับหน้า "ประวัติการซ่อม" (user ที่ล็อกอิน → user_id · guest → client_id · ไม่ส่ง = ไม่ปรากฏในประวัติของใคร)
   */
  async startSession(
    flowId: string,
    query?: string,
    manualId?: string,
    modelSelection?: ModelSelection,
    owner?: SessionOwner,
  ): Promise<SessionResponseDto> {
    const flow = this.requireFlow(flowId);
    if (manualId !== undefined && flow.manual_id !== manualId) {
      throw flowManualMismatch(flowId, manualId);
    }
    const confidence = await this.computeConfidence(flowId, query);

    const { session, state } = engineStartSession(flow, confidence);
    await this.sessionStore.create(session, modelSelection, owner);

    return this.toResponse(session, state, flow);
  }

  /** GET /execution/sessions/:id */
  async getSession(sessionId: string, owner: SessionOwner): Promise<SessionResponseDto> {
    await this.authorize(sessionId, owner);
    const session = await this.requireSession(sessionId);
    const flow = this.requireFlow(session.flowId);

    const state = getCurrentState(session, flow);
    const outcome = session.status === 'completed' ? await this.sessionStore.findOutcome(sessionId) : null;
    const modelSelection = await this.sessionStore.findModelSelection(sessionId);

    const response = await this.toResponse(session, state, flow, outcome);
    return { ...response, trail: buildTrail(session, flow), modelSelection };
  }

  /** POST /execution/sessions/:id/actions */
  async submitAction(
    sessionId: string,
    action: ExecutionAction,
    owner: SessionOwner,
  ): Promise<SessionResponseDto> {
    await this.authorize(sessionId, owner);
    const session = await this.requireSession(sessionId);
    const flow = this.requireFlow(session.flowId);

    const result = engineSubmitAction(session, flow, action);

    // ถึงบรรทัดนี้แปลว่า engine อนุมัติ action แล้ว
    await this.sessionStore.update(result.session, {
      stateId: session.currentStateId,
      action,
    });

    return this.toResponse(result.session, result.state, flow);
  }

  /** DELETE /execution/sessions/:id */
  async abandonSession(sessionId: string, owner: SessionOwner): Promise<void> {
    const deleted = await this.sessionStore.delete(sessionId, owner);
    if (!deleted) throw sessionNotFound(sessionId);
  }

  // POST /execution/sessions/:id/outcome — บันทึกข้อความผลลัพธ์ตอนการตรวจจบ (ได้ครั้งเดียวต่อ session)

  async submitOutcome(
    sessionId: string,
    text: string,
    owner: SessionOwner,
  ): Promise<SessionResponseDto> {
    await this.authorize(sessionId, owner);
    const session = await this.requireSession(sessionId);
    const flow = this.requireFlow(session.flowId);

    if (session.status !== 'completed') {
      throw sessionNotCompleted(sessionId);
    }

    const saved = await this.sessionStore.saveOutcome(sessionId, text);
    if (!saved) {
      throw outcomeAlreadySubmitted(sessionId);
    }

    const state = getCurrentState(session, flow);
    return this.toResponse(session, state, flow, text);
  }

  // ไม่ใช่เจ้าของ = 404 เหมือน session ไม่มีอยู่ (ไม่เปิดเผยว่ามีจริง)
  private async authorize(sessionId: string, owner: SessionOwner): Promise<void> {
    if (!(await this.sessionStore.isOwnedBy(sessionId, owner))) {
      throw sessionNotFound(sessionId);
    }
  }
  private requireFlow(flowId: string): TroubleshootingFlow {
    const flow = this.flowRepository.findById(flowId);
    if (!flow) throw flowNotFound(flowId);
    return flow;
  }

  private async requireSession(sessionId: string): Promise<SessionState> {
    const session = await this.sessionStore.find(sessionId);
    if (!session) throw sessionNotFound(sessionId);
    return session;
  }

  private async toResponse(
    session: SessionState,
    state: RenderedState,
    flow: TroubleshootingFlow,
    outcome: string | null = null,
  ): Promise<SessionResponseDto> {
    return {
      sessionId: session.sessionId,
      flowId: session.flowId,
      status: session.status,
      state,
      equipment: this.equipmentRepository.findByCategory(flow.device_category),
      confidence: session.confidence ?? null,
      outcome,
      displayText: await this.displayTextOf(state),
    };
  }

  private async displayTextOf(state: RenderedState): Promise<string | null> {
    try {
      const result = await this.rephrase.rephrase(state.text, {
        stateType: state.type,
        safetyCritical: state.safetyCritical || state.requiresSafetyConfirmation,
      });
      return result.rephrased && result.text !== state.text ? result.text : null;
    } catch {
      return null;
    }
  }

  private async computeConfidence(flowId: string, query?: string): Promise<number | null> {
    if (query === undefined) return null;
    try {
      return await this.symptomSearch.scoreFlow(query, flowId);
    } catch {
      return null;
    }
  }
}