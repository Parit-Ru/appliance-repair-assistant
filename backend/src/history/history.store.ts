/**
 * history.store.ts — SQL ทั้งหมดของหน้า "ประวัติการซ่อม" (อ่านรายการ/รายละเอียด, ลบ, ให้คะแนน)
 *
 * แยกจาก SessionStore โดยตั้งใจ: SessionStore คือที่เก็บสถานะของการ "เดิน" ขั้นตอนและห้ามรู้เรื่องหน้าประวัติ
 * ไฟล์นี้อ่านตารางเดิม (sessions, session_history) + ตารางใหม่ session_feedback (migration 009)
 * และไม่เขียนอะไรลง sessions/session_history เลยนอกจากการลบทั้ง session ตามที่เจ้าของสั่ง
 *
 * ทุกคำสั่งที่แตะ session ระบุเจ้าของเสมอ (ownerWhere: user_id = ? หรือ client_id = ? AND user_id IS NULL)
 * → session ของคนอื่นไม่ถูกมองเห็นและไม่ถูกลบ · guest มองไม่เห็น session ของ user แม้ใช้ client_id เดียวกัน
 * (ผลคือ "ไม่พบ" ซึ่ง service แปลงเป็น 404 ไม่ใช่ 403 เพื่อไม่บอกว่า id นั้นมีอยู่)
 * และเฉพาะ session ที่ status='completed' และยังไม่หมดอายุ (D3)
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { ownerWhere } from '../auth/session-owner';
import type { SessionOwner } from '../auth/session-owner';
import { MYSQL_POOL } from '../database/database.constants';
import type { SessionHistoryEntry } from '../traversal-engine/types';
import { parseVariables, rowToHistoryEntry } from '../traversal/session.store';
import type { HistoryRow } from '../traversal/session.store';
import type { ModelSelection } from '../traversal/traversal.dto';
import type { HistoryFeedbackDto } from './history.dto';

/** เพดานจำนวนแถวที่ดึงต่อผู้ใช้ — กันผู้ใช้ที่มีประวัติมหาศาลทำให้คำขอเดียวหนัก (ใหม่สุดก่อน) */
export const MAX_HISTORY_ROWS = 500;

interface SummaryRow extends RowDataPacket {
  session_id: string;
  graph_id: string;
  current_node_id: string;
  /** UNIX_TIMESTAMP(created_at) — เลขวินาทีไม่ขึ้นกับเขตเวลาของ Node/MySQL */
  created_epoch: string | number;
}

interface DetailRow extends SummaryRow {
  variables: unknown;
  confidence: string | number | null;
  model_selection: ModelSelection | null;
  outcome_text: string | null;
}

interface FeedbackRow extends RowDataPacket {
  helpful: number;
  comment: string | null;
}

/** ข้อมูลที่รายการต้องใช้ (พอสำหรับหาผัง + โหนดสุดท้าย + วันที่) */
export interface CompletedSessionSummary {
  sessionId: string;
  graphId: string;
  /** โหนดสุดท้าย (โหนดสิ้นสุดของผัง ณ ตอนจบ) */
  currentNodeId: string;
  startedAtEpoch: number;
}

export interface CompletedSession extends CompletedSessionSummary {
  variables: Record<string, string>;
  confidence: number | null;
  modelSelection: ModelSelection | null;
  outcomeText: string | null;
}

@Injectable()
export class HistoryStore {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  /** session ที่จบแล้วของ owner นี้ ใหม่สุดก่อน (เพดาน MAX_HISTORY_ROWS) */
  async listCompleted(owner: SessionOwner): Promise<CompletedSessionSummary[]> {
    const where = ownerWhere(owner);
    const [rows] = await this.pool.query<SummaryRow[]>(
      `SELECT session_id, graph_id, current_node_id,
              UNIX_TIMESTAMP(created_at) AS created_epoch
         FROM sessions
        WHERE ${where.sql} AND status = 'completed' AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT ?`,
      [...where.params, MAX_HISTORY_ROWS],
    );
    return rows.map(toSummary);
  }

  /** session เดียว ถ้าเป็นของ owner นี้ จบแล้ว และยังไม่หมดอายุ · ไม่ใช่ = undefined */
  async findCompleted(sessionId: string, owner: SessionOwner): Promise<CompletedSession | undefined> {
    const where = ownerWhere(owner);
    const [rows] = await this.pool.query<DetailRow[]>(
      `SELECT session_id, graph_id, current_node_id, variables, confidence,
              model_selection, outcome_text,
              UNIX_TIMESTAMP(created_at) AS created_epoch
         FROM sessions
        WHERE session_id = ? AND ${where.sql} AND status = 'completed' AND expires_at > NOW()`,
      [sessionId, ...where.params],
    );
    const row = rows[0];
    if (!row) return undefined;

    return {
      ...toSummary(row),
      variables: parseVariables(row.variables),
      // DECIMAL(4,3) มาเป็นข้อความ ("0.812") · NULL ต้องคงเป็น null ห้ามกลายเป็น 0
      confidence: row.confidence === null ? null : Number(row.confidence),
      modelSelection: row.model_selection,
      outcomeText: row.outcome_text,
    };
  }

  /**
   * ขั้นที่ผู้ใช้เคยผ่านตามลำดับ (เหมือนที่ SessionStore.find ใช้เดินขั้นตอน)
   * เรียกหลังตรวจเจ้าของด้วย findCompleted แล้วเท่านั้น ฟังก์ชันนี้ไม่ตรวจเจ้าของเอง
   */
  async findSteps(sessionId: string): Promise<SessionHistoryEntry[]> {
    const [rows] = await this.pool.query<HistoryRow[]>(
      `SELECT node_id, action_type, action_value
         FROM session_history
        WHERE session_id = ?
        ORDER BY step_order`,
      [sessionId],
    );
    return rows.map(rowToHistoryEntry);
  }

  /** ลบทั้ง session (session_history/session_feedback ถูกลบตามด้วย CASCADE) · true = ลบได้ */
  async deleteCompleted(sessionId: string, owner: SessionOwner): Promise<boolean> {
    const where = ownerWhere(owner);
    const [result] = await this.pool.query<ResultSetHeader>(
      `DELETE FROM sessions
        WHERE session_id = ? AND ${where.sql} AND status = 'completed' AND expires_at > NOW()`,
      [sessionId, ...where.params],
    );
    return result.affectedRows === 1;
  }

  /** บันทึก/แก้คะแนน — 1 session 1 แถว ส่งซ้ำ = เขียนทับ ผู้เรียกต้องตรวจเจ้าของมาก่อน */
  async saveFeedback(sessionId: string, feedback: HistoryFeedbackDto): Promise<void> {
    await this.pool.query(
      `INSERT INTO session_feedback (session_id, helpful, \`comment\`)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE helpful = VALUES(helpful), \`comment\` = VALUES(\`comment\`)`,
      [sessionId, feedback.helpful ? 1 : 0, feedback.comment],
    );
  }

  async findFeedback(sessionId: string): Promise<HistoryFeedbackDto | undefined> {
    const [rows] = await this.pool.query<FeedbackRow[]>(
      `SELECT helpful, \`comment\`
         FROM session_feedback
        WHERE session_id = ?`,
      [sessionId],
    );
    const row = rows[0];
    return row ? { helpful: row.helpful === 1, comment: row.comment } : undefined;
  }
}

function toSummary(row: SummaryRow): CompletedSessionSummary {
  return {
    sessionId: row.session_id,
    graphId: row.graph_id,
    currentNodeId: row.current_node_id,
    startedAtEpoch: Number(row.created_epoch),
  };
}
