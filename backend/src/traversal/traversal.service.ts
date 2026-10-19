/**
 * traversal.service.ts — ต่อ GraphRepository, EquipmentRepository และ SessionStore
 *                        เข้ากับเครื่องสถานะ (traversal-engine)
 *
 * กฎของโครงงาน: ไฟล์นี้ห้ามมีตรรกะเปลี่ยนสถานะของตัวเองแม้แต่บรรทัดเดียว
 * การตัดสินว่า "ขั้นถัดไปคืออะไร" และ "action นี้ใช้กับสถานะปัจจุบันได้ไหม"
 * ต้องมาจาก startSession/getCurrentNode/submitAction ของ engine เท่านั้น
 * หน้าที่ของไฟล์นี้มีแค่: หาข้อมูลป้อนให้ engine, ส่งต่อผลลัพธ์, บันทึกผล
 *
 * ด่านความปลอดภัยถูกบังคับที่ submitAction(): เรียก engine ก่อนบันทึกเสมอ
 * ถ้า engine โยน error บรรทัด sessionStore.update() จะไม่ถูกรัน
 * จึงไม่ต้องมีโค้ด "ย้อนสถานะ"
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

// ============================================================
// ข้อผิดพลาดของ service เอง
//
// ไม่ใช่ error ของ engine — engine ไม่รู้จัก "session" หรือ "ผังที่ไม่มีอยู่" มันรับ SessionState + TroubleshootingGraph
// ที่มีอยู่แล้วมาทำงานเท่านั้น การหาไม่เจอเป็นเรื่องของชั้นข้อมูล (repository/store คืน undefined)
// service จึงเป็นคนสร้าง ApiError เอง (status + code + ข้อความ) · AllExceptionsFilter แปลงเป็น response
// ============================================================

const graphNotFound = (graphId: string) => new ApiError(404, 'GRAPH_NOT_FOUND', `ไม่พบผังขั้นตอน '${graphId}'`);

/**
 * ผังที่ขอเริ่มตรวจไม่ใช่ของรุ่น/คู่มือที่ผู้ใช้เลือก → 400 GRAPH_MANUAL_MISMATCH
 * กันเริ่มตรวจด้วยขั้นตอนของรุ่นอื่นโดยไม่รู้ตัว (เช็กก่อนสร้าง session จึงไม่มีอะไรค้างในฐานข้อมูล)
 */
const graphManualMismatch = (graphId: string, manualId: string) =>
  new ApiError(400, 'GRAPH_MANUAL_MISMATCH', `ผังขั้นตอน '${graphId}' ไม่ใช่ของคู่มือ '${manualId}'`);

const sessionNotFound = (sessionId: string) =>
  new ApiError(404, 'SESSION_NOT_FOUND', `ไม่พบ session '${sessionId}' (อาจไม่เคยมีอยู่ หรือหมดอายุแล้ว)`);

/**
 * บันทึกผลลัพธ์ให้ session ที่ยังเดินอยู่ (ยังไม่ถึงสถานะสิ้นสุด) → 409 SESSION_NOT_COMPLETED
 * ผลลัพธ์ที่ผู้ใช้กรอกมีความหมายเฉพาะตอนการตรวจจบแล้ว จึงรับเฉพาะ session ที่ status เป็น completed
 */
const sessionNotCompleted = (sessionId: string) =>
  new ApiError(409, 'SESSION_NOT_COMPLETED', `session '${sessionId}' ยังไม่ถึงสถานะสิ้นสุด บันทึกผลลัพธ์ไม่ได้`);

/** session นี้เคยบันทึกผลลัพธ์ไปแล้ว ส่งซ้ำหรือแก้ไขไม่ได้ → 409 OUTCOME_ALREADY_SUBMITTED */
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

  // ============================================================
  // 7 เมธอด ตรงกับ 7 endpoint ของ TraversalController
  // ============================================================

  /**
   * GET /traversal/graphs — ไม่ async เพราะผังโหลดเข้าหน่วยความจำไว้แล้วตอนบูต
   * manualId (ไม่บังคับ): เฉพาะผังของรุ่นนั้น · ไม่พบรุ่น = รายการว่าง
   */
  listGraphs(manualId?: string): GraphSummary[] {
    const all = this.graphRepository.listAll();
    return manualId === undefined ? all : all.filter((g) => g.manualId === manualId);
  }

  /** GET /traversal/manuals — รายการคู่มือ (รุ่น) ให้ผู้ใช้เลือกรุ่นก่อนเลือกอาการ */
  listManuals(): ManualSummary[] {
    return this.graphRepository.listManuals();
  }

  /**
   * POST /traversal/sessions
   * owner: เจ้าของ session สำหรับหน้า "ประวัติการซ่อม" (user ที่ล็อกอิน → user_id · guest → client_id · ไม่ส่ง = ไม่ปรากฏในประวัติของใคร)
   * บันทึกอย่างเดียว ไม่มีผลต่อการตัดสินขั้นตอน
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

    // ถ้า engine โยน error (เช่น entry_node หาไม่เจอ) create() จะไม่ถูกเรียก
    // จึงไม่มี session ค้างอยู่ครึ่งๆ กลางๆ
    const { session, node } = engineStartSession(graph, confidence);
    await this.sessionStore.create(session, modelSelection, owner);

    return this.toResponse(session, node, graph);
  }

  /** GET /traversal/sessions/:id */
  async getSession(sessionId: string, requesterUserId?: string): Promise<SessionResponseDto> {
    await this.authorize(sessionId, requesterUserId);
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    const node = getCurrentNode(session, graph);

    // ผลลัพธ์ที่ผู้ใช้กรอกมีได้เฉพาะ session ที่จบแล้ว จึงอ่านเฉพาะตอนนั้น
    // การเดินขั้นตอนปกติไม่เสียคำสั่ง SQL เพิ่ม และ engine ไม่เห็นค่านี้
    const outcome =
      session.status === 'completed' ? await this.sessionStore.findOutcome(sessionId) : null;

    return this.toResponse(session, node, graph, outcome);
  }

  /**
   * POST /traversal/sessions/:id/actions
   *
   * ด่านความปลอดภัยของทั้งระบบอยู่ตรงนี้: เรียก engineSubmitAction() ก่อนเสมอ
   * ถ้ามันโยน error (เช่น SafetyConfirmationRequiredError) โค้ดออกจากฟังก์ชันทันที
   * sessionStore.update() ไม่ถูกรัน session ในฐานข้อมูลจึงไม่ขยับ
   */
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
    // nodeId ที่บันทึกคือโหนดที่ "ออกจาก" (ของ session ก่อนหน้า) ไม่ใช่โหนดใหม่ที่เพิ่งไปถึง
    await this.sessionStore.update(result.session, {
      nodeId: session.currentNodeId,
      action,
    });

    return this.toResponse(result.session, result.node, graph);
  }

  /**
   * DELETE /traversal/sessions/:id
   *
   * ลบได้เฉพาะเจ้าของ: owner ต้องตรงกับที่บันทึกไว้ตอนเริ่ม session (user → user_id · guest → client_id และ session ต้องไม่ใช่ของ user)
   * ไม่มี session / ไม่ใช่เจ้าของ / session ไม่มีเจ้าของ (client_id เป็น NULL) / หมดอายุแล้ว
   * ล้วนได้ sessionNotFound (404) เหมือนกันหมด ไม่เปิดเผยว่า session นั้นมีอยู่จริง
   * ยกเลิกซ้ำครั้งที่สองจึงได้ 404 ไม่ใช่ 204 เงียบๆ
   *
   * ตรวจและลบในคำสั่ง SQL เดียว (sessionStore.delete) ไม่ find ก่อนแล้วค่อยลบ
   * owner มาจาก resolveRequiredOwner() แล้ว (เหมือน /history)
   */
  async abandonSession(sessionId: string, owner: SessionOwner): Promise<void> {
    const deleted = await this.sessionStore.delete(sessionId, owner);
    if (!deleted) throw sessionNotFound(sessionId);
  }

  /**
   * POST /traversal/sessions/:id/outcome — บันทึกข้อความผลลัพธ์ตอนการตรวจจบ (ได้ครั้งเดียวต่อ session)
   *
   * ไม่ผ่าน submitAction() และไม่เรียก engine ที่เปลี่ยนสถานะ: ผลลัพธ์เป็นข้อมูลบันทึกอย่างเดียว
   * (เหมือน confidence) และ resolveNextNode ต้องเป็นจุดตัดสินใจเดียว
   * เรียก getCurrentNode() แค่อ่านสถานะปัจจุบันมาประกอบ response เหมือน getSession()
   *
   * ลำดับการตรวจ (แต่ละข้อใช้รหัส error ต่างกัน หน้าจอจึงแสดงข้อความถูกกรณี):
   *   1. ไม่พบ session        → 404 SESSION_NOT_FOUND
   *   2. session ยังเดินอยู่   → 409 SESSION_NOT_COMPLETED
   *   3. เคยบันทึกไปแล้ว       → 409 OUTCOME_ALREADY_SUBMITTED
   *
   * ข้อ 3 ไม่เช็คก่อนเขียน แต่ให้ saveOutcome() ตัดสินใน UPDATE คำสั่งเดียว (atomic)
   * ถ้าได้ false ทั้งที่ข้อ 1–2 ผ่านมาแล้ว แปลว่ามีผลลัพธ์อยู่แล้ว (สองคำขอพร้อมกัน ชนะได้คนเดียว)
   * ถ้า session หมดอายุพอดีระหว่างข้อ 1 กับ UPDATE ก็ยังเขียนสำเร็จ ซึ่งไม่มีผลเสีย
   *
   * text ต้องผ่าน parseOutcomeBody() มาแล้ว
   */
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

  // ============================================================
  // ตัวช่วยภายใน
  // ============================================================

  /**
   * ด่านเจ้าของของ endpoint เดินขั้นตอน (GET / actions / outcome) — เรียกก่อนแตะ session เสมอ
   *
   * session ที่เริ่มตอนล็อกอิน (มี user_id) ต้องมี token ของเจ้าของนั้นเท่านั้น
   * ไม่มี token / เป็นของ user คนอื่น → sessionNotFound (404 เหมือนไม่มี session ไม่บอกว่ามีอยู่)
   * session ของ guest (user_id เป็น NULL) ยังใช้ session id เป็นกุญแจเหมือนเดิม ไม่เปลี่ยนพฤติกรรมของ guest
   * ไม่มี session นี้เลย → ผ่านด่านนี้ไป แล้ว requireSession() ตอบ 404 เอง
   */
  private async authorize(sessionId: string, requesterUserId?: string): Promise<void> {
    const ownerUserId = await this.sessionStore.findUserId(sessionId);
    if (ownerUserId !== null && ownerUserId !== requesterUserId) {
      throw sessionNotFound(sessionId);
    }
  }

  /** คืนกราฟ หรือโยน graphNotFound (404) */
  private requireGraph(graphId: string): TroubleshootingGraph {
    const graph = this.graphRepository.findById(graphId);
    if (!graph) throw graphNotFound(graphId);
    return graph;
  }

  /** คืน session หรือโยน sessionNotFound (ครอบคลุมทั้งไม่เคยมีและหมดอายุแล้ว) */
  private async requireSession(sessionId: string): Promise<SessionState> {
    const session = await this.sessionStore.find(sessionId);
    if (!session) throw sessionNotFound(sessionId);
    return session;
  }

  /**
   * ประกอบ SessionResponseDto จาก session, node (ผล render จาก engine ตรงๆ ห้ามดัดแปลง)
   * และ equipment (ผูกกับประเภทเครื่องของผัง ไม่ใช่ผูกกับอาการ)
   */
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
      // SessionState ของ engine ไม่มีฟิลด์ผลลัพธ์ จึงให้ผู้เรียกที่รู้ค่า (getSession, submitOutcome) ส่งเข้ามา
      // ที่เหลือ (start, action) เป็น null ซึ่งถูกต้อง: session ที่เพิ่งเริ่มหรือเพิ่งเดินต่อ
      // (แม้เพิ่งถึงสถานะสิ้นสุด) ยังไม่เคยมีผลลัพธ์ เพราะ saveOutcome รับเฉพาะ session ที่จบแล้ว
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

  /**
   * คะแนนความมั่นใจของ session
   *
   * - ไม่มี query (ผู้ใช้เลือกอาการจากรายการเอง) → null
   * - มี query → ให้ระบบค้นหาคำนวณเอง (ไม่รับตัวเลขจากหน้าจอ)
   * - ระบบค้นหาไม่พร้อม หรือคำนวณล้มเหลว → null ไม่แต่งตัวเลข และไม่ทำให้การเริ่ม session ล้ม
   *
   * ค่านี้แสดงผลอย่างเดียว ไม่มีโค้ดส่วนไหนอ่านมันไปตัดสินขั้นถัดไปหรือด่านความปลอดภัย
   */
  private async computeConfidence(graphId: string, query?: string): Promise<number | null> {
    if (query === undefined) return null;
    try {
      return await this.symptomSearch.scoreGraph(query, graphId);
    } catch {
      return null;
    }
  }
}