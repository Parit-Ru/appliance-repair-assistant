import { Inject, Injectable } from '@nestjs/common';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import { ownerColumns, ownerWhere } from '../auth/session-owner';
import type { SessionOwner } from '../auth/session-owner';
import type { ModelSelection } from './traversal.dto';
import type { SessionHistoryEntry, SessionState, SessionStatus, TraversalAction } from '../traversal-engine/types';

/** session ที่ยังเดินอยู่: ไม่มีการใช้งาน 24 ชั่วโมงแล้วหมดอายุ (ต่ออายุทุกครั้งที่ขยับ) */
const SESSION_TTL_HOURS = 24;

/**
 * session ที่จบแล้วเก็บไว้ให้ดูในหน้า "ประวัติการซ่อม" 90 วัน (docs/features/history-page.md, D2)
 * ตั้งตอน update() ที่ทำให้ status เป็น completed เท่านั้น — ไม่ได้ต่ออายุซ้ำเมื่อบันทึกผลลัพธ์/ให้คะแนน
 */
const COMPLETED_SESSION_TTL_DAYS = 90;
const COMPLETED_SESSION_TTL_HOURS = COMPLETED_SESSION_TTL_DAYS * 24;

interface SessionRow extends RowDataPacket {
  session_id: string;
  graph_id: string;
  current_node_id: string;
  status: SessionStatus;
  variables: unknown;
  confidence: string | number | null;
}

export interface HistoryRow extends RowDataPacket {
  node_id: string;
  action_type: TraversalAction['type'];
  action_value: string | null;
}

interface OutcomeRow extends RowDataPacket {
  outcome_text: string | null;
}

interface OwnerRow extends RowDataPacket {
  user_id: string | null;
}

@Injectable()
export class SessionStore {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  /**
   * owner (migration 008/011): เจ้าของ session สำหรับหน้า "ประวัติการซ่อม"
   *   user  → เก็บ user_id (client_id เป็น NULL) · guest → เก็บ client_id (user_id เป็น NULL)
   *   ไม่ส่ง = ทั้งคู่ NULL (ไม่ปรากฏในประวัติของใคร)
   * ไม่เกี่ยวกับการเดินขั้นตอน engine ไม่เห็นค่านี้
   */
  async create(session: SessionState, modelSelection?: ModelSelection, owner?: SessionOwner): Promise<void> {
    const { userId, clientId } = ownerColumns(owner);
    await this.pool.query(
      `INSERT INTO sessions
         (session_id, graph_id, current_node_id, status, variables, confidence, model_selection, client_id, user_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)`,
      [
        session.sessionId,
        session.graphId,
        session.currentNodeId,
        session.status,
        JSON.stringify(session.variables),
        session.confidence ?? null,
        modelSelection ?? null,
        clientId,
        userId,
        SESSION_TTL_HOURS,
      ],
    );
  }

  async find(sessionId: string): Promise<SessionState | undefined> {
    const [sessionRows] = await this.pool.query<SessionRow[]>(
      `SELECT session_id, graph_id, current_node_id, status, variables, confidence
         FROM sessions
        WHERE session_id = ? AND expires_at > NOW()`,
      [sessionId],
    );

    const row = sessionRows[0];
    if (!row) return undefined;

    const [historyRows] = await this.pool.query<HistoryRow[]>(
      `SELECT node_id, action_type, action_value
         FROM session_history
        WHERE session_id = ?
        ORDER BY step_order`,
      [sessionId],
    );

    return {
      sessionId: row.session_id,
      graphId: row.graph_id,
      currentNodeId: row.current_node_id,
      status: row.status,
      variables: parseVariables(row.variables),
      confidence: row.confidence === null ? null : Number(row.confidence),
      history: historyRows.map(rowToHistoryEntry),
    };
  }

  async update(
    session: SessionState,
    step: { nodeId: string; action: TraversalAction },
  ): Promise<void> {
    if (session.history.length === 0) {
      throw new Error(
        'update() ต้องรับ session ที่ผ่านการ submitAction แล้ว (history ต้องไม่ว่าง)',
      );
    }
    const stepOrder = session.history.length - 1;
    // ขั้นที่ทำให้จบ → เก็บ 90 วันให้ดูย้อนหลังได้ · ขั้นอื่นยัง 24 ชั่วโมงเหมือนเดิม
    const ttlHours =
      session.status === 'completed' ? COMPLETED_SESSION_TTL_HOURS : SESSION_TTL_HOURS;

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE sessions
            SET current_node_id = ?,
                status = ?,
                variables = ?,
                expires_at = NOW() + INTERVAL ? HOUR
          WHERE session_id = ?`,
        [
          session.currentNodeId,
          session.status,
          JSON.stringify(session.variables),
          ttlHours,
          session.sessionId,
        ],
      );

      await conn.query(
        `INSERT INTO session_history
           (session_id, step_order, node_id, action_type, action_value)
         VALUES (?, ?, ?, ?, ?)`,
        [
          session.sessionId,
          stepOrder,
          step.nodeId,
          step.action.type,
          actionValueOf(step.action),
        ],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * user_id ของเจ้าของ session (มีเฉพาะ session ที่เริ่มตอนล็อกอิน) · null = เป็นของ guest / ไม่มีเจ้าของ / ไม่มี session นี้
   * ใช้ตัดสินว่า endpoint เดินขั้นตอน (GET/actions/outcome) ต้องมี token ของเจ้าของหรือไม่ — ดู TraversalService.authorize
   */
  async findUserId(sessionId: string): Promise<string | null> {
    const [rows] = await this.pool.query<OwnerRow[]>(
      `SELECT user_id
         FROM sessions
        WHERE session_id = ? AND expires_at > NOW()`,
      [sessionId],
    );
    return rows[0]?.user_id ?? null;
  }

  /**
   * ลบ session ของ owner นี้ (ทุกสถานะ — ยกเลิกระหว่างเดินคือ use case หลัก) คืน true เมื่อลบได้
   * ไม่ใช่เจ้าของ / ไม่มีเจ้าของ / ไม่มี / หมดอายุแล้ว → ไม่ลบอะไรและคืน false ทุกกรณี
   * (ผู้เรียกแปลงเป็น 404 เหมือนกันหมด จึงไม่เปิดเผยว่า session นั้นมีอยู่จริง)
   *
   * คำสั่งเดียวตัดสินและลบพร้อมกัน ไม่ "find แล้วค่อย delete" เพื่อไม่ให้มีช่องว่างระหว่างตรวจกับลบ
   * session_history และ session_feedback ถูกลบตามด้วย ON DELETE CASCADE
   */
  async delete(sessionId: string, owner: SessionOwner): Promise<boolean> {
    const where = ownerWhere(owner);
    const [result] = await this.pool.query<ResultSetHeader>(
      `DELETE FROM sessions
        WHERE session_id = ? AND ${where.sql} AND expires_at > NOW()`,
      [sessionId, ...where.params],
    );
    return result.affectedRows === 1;
  }

  async saveOutcome(sessionId: string, text: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE sessions
          SET outcome_text = ?,
              outcome_at = NOW()
        WHERE session_id = ?
          AND status = 'completed'
          AND outcome_text IS NULL`,
      [text, sessionId],
    );
    return result.affectedRows === 1;
  }

  async findOutcome(sessionId: string): Promise<string | null> {
    const [rows] = await this.pool.query<OutcomeRow[]>(
      `SELECT outcome_text
         FROM sessions
        WHERE session_id = ? AND expires_at > NOW()`,
      [sessionId],
    );
    return rows[0]?.outcome_text ?? null;
  }
}

function actionValueOf(action: TraversalAction): string | null {
  return action.type === 'answer' || action.type === 'input' ? action.value : null;
}

/** ใช้ร่วมกับ HistoryStore (หน้าประวัติ) เพื่อให้แปลงแถว session_history เหมือนตอนเดินขั้นตอนทุกประการ */
export function rowToHistoryEntry(row: HistoryRow): SessionHistoryEntry {
  return { nodeId: row.node_id, action: rowToAction(row) };
}

function rowToAction(row: HistoryRow): TraversalAction {
  switch (row.action_type) {
    case 'answer':
      if (row.action_value !== 'yes' && row.action_value !== 'no') {
        throw new Error(`ประวัติเสีย: answer ต้องมีค่า yes/no แต่พบ '${String(row.action_value)}'`);
      }
      return { type: 'answer', value: row.action_value };

    case 'input':
      if (row.action_value === null) {
        throw new Error('ประวัติเสีย: input ต้องมีค่า แต่พบ NULL');
      }
      return { type: 'input', value: row.action_value };

    case 'continue':
      return { type: 'continue' };

    case 'confirm_safety':
      return { type: 'confirm_safety' };

    default: {
      const unreachable: never = row.action_type;
      throw new Error(`ประวัติเสีย: action_type ไม่รู้จัก '${String(unreachable)}'`);
    }
  }
}

export function parseVariables(value: unknown): Record<string, string> {
  if (typeof value === 'string') {
    return JSON.parse(value) as Record<string, string>;
  }
  return (value ?? {}) as Record<string, string>;
}
