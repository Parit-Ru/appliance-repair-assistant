/**
  traversal.service.ts — ต่อ GraphRepository, EquipmentRepository และ SessionStore เข้ากับเครื่องสถานะ (traversal-engine)
 */

import { Injectable } from '@nestjs/common';
import type { SessionOwner } from '../auth/session-owner';
import { ApiError } from '../common/api-error';
import { GraphRepository } from './graph.repository';
import type { GraphSummary, ManualSummary } from './graph.repository';
import { EquipmentRepository } from './equipment.repository';
import { SessionStore } from './session.store';
import { SymptomSearchService } from '../symptom-search/symptom-search.service';
import { RephraseService } from '../rephrase/rephrase.service';
import type { ModelSelection, SessionResponseDto } from './traversal.dto';
import { getCurrentNode, startSession as engineStartSession, submitAction as engineSubmitAction } from '../traversal-engine/traversal-engine';
import type { RenderedNode, SessionState, TraversalAction, TroubleshootingGraph } from '../traversal-engine/types';


const graphNotFound = (graphId: string) => new ApiError(404, 'GRAPH_NOT_FOUND', `ไม่พบผังขั้นตอน '${graphId}'`);

const graphManualMismatch = (graphId: string, manualId: string) =>
  new ApiError(400, 'GRAPH_MANUAL_MISMATCH', `ผังขั้นตอน '${graphId}' ไม่ใช่ของคู่มือ '${manualId}'`);

const sessionNotFound = (sessionId: string) =>
  new ApiError(404, 'SESSION_NOT_FOUND', `ไม่พบ session '${sessionId}' (อาจไม่เคยมีอยู่ หรือหมดอายุแล้ว)`);

const sessionNotCompleted = (sessionId: string) =>
  new ApiError(409, 'SESSION_NOT_COMPLETED', `session '${sessionId}' ยังไม่ถึงสถานะสิ้นสุด บันทึกผลลัพธ์ไม่ได้`);

const outcomeAlreadySubmitted = (sessionId: string) =>
  new ApiError(409, 'OUTCOME_ALREADY_SUBMITTED', `session '${sessionId}' บันทึกผลลัพธ์ไปแล้ว ส่งซ้ำไม่ได้`);

@Injectable()
export class TraversalService {
  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly sessionStore: SessionStore,
    private readonly symptomSearch: SymptomSearchService,
    private readonly rephrase: RephraseService,
  ) {}

  // GET /traversal/graphs 
  listGraphs(manualId?: string): GraphSummary[] {
    const all = this.graphRepository.listAll();
    return manualId === undefined ? all : all.filter((g) => g.manualId === manualId);
  }

  // GET /traversal/manuals
  listManuals(): ManualSummary[] {
    return this.graphRepository.listManuals();
  }

  /**
    POST /traversal/sessions
    owner: เจ้าของ session สำหรับหน้า "ประวัติการซ่อม" (user ที่ล็อกอิน → user_id · guest → client_id · ไม่ส่ง = ไม่ปรากฏในประวัติของใคร)
   */
  async startSession(
    graphId: string,
    query?: string,
    manualId?: string,
    modelSelection?: ModelSelection,
    owner?: SessionOwner,
  ): Promise<SessionResponseDto> {
    const graph = this.requireGraph(graphId);
    if (manualId !== undefined && graph.manual_id !== manualId) {
      throw graphManualMismatch(graphId, manualId);
    }
    const confidence = await this.computeConfidence(graphId, query);

    const { session, node } = engineStartSession(graph, confidence);
    await this.sessionStore.create(session, modelSelection, owner);

    return this.toResponse(session, node, graph);
  }

  // GET /traversal/sessions/:id 
  async getSession(sessionId: string, requesterUserId?: string): Promise<SessionResponseDto> {
    await this.authorize(sessionId, requesterUserId);
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    const node = getCurrentNode(session, graph);
    const outcome = session.status === 'completed' ? await this.sessionStore.findOutcome(sessionId) : null;

    return this.toResponse(session, node, graph, outcome);
  }

  // POST /traversal/sessions/:id/actions
  async submitAction(
    sessionId: string,
    action: TraversalAction,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    await this.authorize(sessionId, requesterUserId);
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    const result = engineSubmitAction(session, graph, action);

    // ถึงบรรทัดนี้แปลว่า engine อนุมัติ action แล้ว
    await this.sessionStore.update(result.session, {
      nodeId: session.currentNodeId,
      action,
    });

    return this.toResponse(result.session, result.node, graph);
  }

  //DELETE /traversal/sessions/:id
  async abandonSession(sessionId: string, owner: SessionOwner): Promise<void> {
    const deleted = await this.sessionStore.delete(sessionId, owner);
    if (!deleted) throw sessionNotFound(sessionId);
  }

  // POST /traversal/sessions/:id/outcome — บันทึกข้อความผลลัพธ์ตอนการตรวจจบ (ได้ครั้งเดียวต่อ session)

  async submitOutcome(
    sessionId: string,
    text: string,
    requesterUserId?: string,
  ): Promise<SessionResponseDto> {
    await this.authorize(sessionId, requesterUserId);
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    if (session.status !== 'completed') {
      throw sessionNotCompleted(sessionId);
    }

    const saved = await this.sessionStore.saveOutcome(sessionId, text);
    if (!saved) {
      throw outcomeAlreadySubmitted(sessionId);
    }

    const node = getCurrentNode(session, graph);
    return this.toResponse(session, node, graph, text);
  }

  private async authorize(sessionId: string, requesterUserId?: string): Promise<void> {
    const ownerUserId = await this.sessionStore.findUserId(sessionId);
    if (ownerUserId !== null && ownerUserId !== requesterUserId) {
      throw sessionNotFound(sessionId);
    }
  }
  private requireGraph(graphId: string): TroubleshootingGraph {
    const graph = this.graphRepository.findById(graphId);
    if (!graph) throw graphNotFound(graphId);
    return graph;
  }

  private async requireSession(sessionId: string): Promise<SessionState> {
    const session = await this.sessionStore.find(sessionId);
    if (!session) throw sessionNotFound(sessionId);
    return session;
  }

  private async toResponse(
    session: SessionState,
    node: RenderedNode,
    graph: TroubleshootingGraph,
    outcome: string | null = null,
  ): Promise<SessionResponseDto> {
    return {
      sessionId: session.sessionId,
      graphId: session.graphId,
      status: session.status,
      node,
      equipment: this.equipmentRepository.findByCategory(graph.device_category),
      confidence: session.confidence ?? null,
      outcome,
      displayText: await this.displayTextOf(node),
    };
  }

  private async displayTextOf(node: RenderedNode): Promise<string | null> {
    try {
      const result = await this.rephrase.rephrase(node.text, {
        nodeType: node.type,
        safetyCritical: node.safetyCritical || node.requiresSafetyConfirmation,
      });
      return result.rephrased && result.text !== node.text ? result.text : null;
    } catch {
      return null;
    }
  }

  private async computeConfidence(graphId: string, query?: string): Promise<number | null> {
    if (query === undefined) return null;
    try {
      return await this.symptomSearch.scoreGraph(query, graphId);
    } catch {
      return null;
    }
  }
}