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

import { GraphRepository } from './graph.repository';
import type { GraphSummary } from './graph.repository';
import { EquipmentRepository } from './equipment.repository';
import { SessionStore } from './session.store';
import { SymptomSearchService } from '../symptom-search/symptom-search.service';
import type { SessionResponseDto } from './traversal.dto';
import {
  getCurrentNode,
  startSession as engineStartSession,
  submitAction as engineSubmitAction,
} from '../traversal-engine/traversal-engine';
import type {
  RenderedNode,
  SessionState,
  TraversalAction,
  TroubleshootingGraph,
} from '../traversal-engine/types';

// ============================================================
// ข้อผิดพลาดของ service เอง
//
// ไม่ extends TraversalError เพราะไม่ได้มาจาก engine — engine ไม่รู้จัก "session"
// หรือ "ผังที่ไม่มีอยู่" มันรับ SessionState + TroubleshootingGraph ที่มีอยู่แล้วมาทำงานเท่านั้น
// การหาไม่เจอเป็นเรื่องของชั้นข้อมูล (repository/store คืน undefined)
// service จึงเป็นคนแปลงเป็น error เอง
// TraversalExceptionFilter จับด้วย instanceof แล้วแปลงเป็นรหัส HTTP
// ============================================================

export class GraphNotFoundError extends Error {
  constructor(graphId: string) {
    super(`ไม่พบผังขั้นตอน '${graphId}'`);
    this.name = this.constructor.name;
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`ไม่พบ session '${sessionId}' (อาจไม่เคยมีอยู่ หรือหมดอายุแล้ว)`);
    this.name = this.constructor.name;
  }
}

/**
 * บันทึกผลลัพธ์ให้ session ที่ยังเดินอยู่ (ยังไม่ถึงสถานะสิ้นสุด) → 409 SESSION_NOT_COMPLETED
 * ผลลัพธ์ที่ผู้ใช้กรอกมีความหมายเฉพาะตอนการตรวจจบแล้ว จึงรับเฉพาะ session ที่ status เป็น completed
 */
export class SessionNotCompletedError extends Error {
  constructor(sessionId: string) {
    super(`session '${sessionId}' ยังไม่ถึงสถานะสิ้นสุด บันทึกผลลัพธ์ไม่ได้`);
    this.name = this.constructor.name;
  }
}

/** session นี้เคยบันทึกผลลัพธ์ไปแล้ว ส่งซ้ำหรือแก้ไขไม่ได้ → 409 OUTCOME_ALREADY_SUBMITTED */
export class OutcomeAlreadySubmittedError extends Error {
  constructor(sessionId: string) {
    super(`session '${sessionId}' บันทึกผลลัพธ์ไปแล้ว ส่งซ้ำไม่ได้`);
    this.name = this.constructor.name;
  }
}

@Injectable()
export class TraversalService {
  constructor(
    private readonly graphRepository: GraphRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly sessionStore: SessionStore,
    private readonly symptomSearch: SymptomSearchService,
  ) {}

  // ============================================================
  // 6 เมธอด ตรงกับ 6 endpoint ของ TraversalController
  // ============================================================

  /** GET /traversal/graphs — ไม่ async เพราะผังโหลดเข้าหน่วยความจำไว้แล้วตอนบูต */
  listGraphs(): GraphSummary[] {
    return this.graphRepository.listAll();
  }

  /** POST /traversal/sessions */
  async startSession(graphId: string, query?: string): Promise<SessionResponseDto> {
    const graph = this.requireGraph(graphId);
    const confidence = await this.computeConfidence(graphId, query);

    // ถ้า engine โยน error (เช่น entry_node หาไม่เจอ) create() จะไม่ถูกเรียก
    // จึงไม่มี session ค้างอยู่ครึ่งๆ กลางๆ
    const { session, node } = engineStartSession(graph, confidence);
    await this.sessionStore.create(session);

    return this.toResponse(session, node, graph);
  }

  /** GET /traversal/sessions/:id */
  async getSession(sessionId: string): Promise<SessionResponseDto> {
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
  async submitAction(sessionId: string, action: TraversalAction): Promise<SessionResponseDto> {
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
   * ตรวจว่ามี session อยู่จริงก่อนลบ ยกเลิกซ้ำครั้งที่สองจึงได้ 404 ไม่ใช่ 204 เงียบๆ
   * (ตรงกับพฤติกรรมของ mockServer ฝั่งหน้าจอ)
   */
  async abandonSession(sessionId: string): Promise<void> {
    await this.requireSession(sessionId);
    await this.sessionStore.delete(sessionId);
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
  async submitOutcome(sessionId: string, text: string): Promise<SessionResponseDto> {
    const session = await this.requireSession(sessionId);
    const graph = this.requireGraph(session.graphId);

    if (session.status !== 'completed') {
      throw new SessionNotCompletedError(sessionId);
    }

    const saved = await this.sessionStore.saveOutcome(sessionId, text);
    if (!saved) {
      throw new OutcomeAlreadySubmittedError(sessionId);
    }

    const node = getCurrentNode(session, graph);
    return this.toResponse(session, node, graph, text);
  }

  // ============================================================
  // ตัวช่วยภายใน
  // ============================================================

  /** คืนกราฟ หรือโยน GraphNotFoundError ให้ controller/filter แปลงเป็น 404 ต่อ */
  private requireGraph(graphId: string): TroubleshootingGraph {
    const graph = this.graphRepository.findById(graphId);
    if (!graph) throw new GraphNotFoundError(graphId);
    return graph;
  }

  /** คืน session หรือโยน SessionNotFoundError (ครอบคลุมทั้งไม่เคยมีและหมดอายุแล้ว) */
  private async requireSession(sessionId: string): Promise<SessionState> {
    const session = await this.sessionStore.find(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }

  /**
   * ประกอบ SessionResponseDto จาก session, node (ผล render จาก engine ตรงๆ ห้ามดัดแปลง)
   * และ equipment (ผูกกับประเภทเครื่องของผัง ไม่ใช่ผูกกับอาการ)
   */
  private toResponse(
    session: SessionState,
    node: RenderedNode,
    graph: TroubleshootingGraph,
    outcome: string | null = null,
  ): SessionResponseDto {
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
    };
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