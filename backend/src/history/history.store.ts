import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ownerWhere } from '../auth/session-owner';
import type { SessionOwner } from '../auth/session-owner';
import type { SessionHistoryEntry, SessionStatus } from '../state-machine/types';
import { parseVariables, rowToHistoryEntry } from '../execution/session.store';
import type { HistoryRow } from '../execution/session.store';
import type { ModelSelection } from '../execution/execution.dto';
import type { HistoryFeedbackDto } from './history.dto';

export const MAX_HISTORY_ROWS = 50;

interface SummaryRow extends RowDataPacket {
  session_id: string;
  flow_id: string;
  current_state_id: string;
  status: SessionStatus;
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

export interface SessionSummary {
  sessionId: string;
  flowId: string;
  currentStateId: string;
  status: SessionStatus;
  startedAtEpoch: number;
}

export interface CompletedSession extends SessionSummary {
  variables: Record<string, string>;
  confidence: number | null;
  modelSelection: ModelSelection | null;
  outcomeText: string | null;
}

export class HistoryStore {
  constructor(private readonly pool: Pool) {}

  // รวมทั้ง in_progress และ completed · in_progress ขึ้นก่อน แล้วใหม่สุดก่อน (ให้ของที่ค้างอยู่เห็นก่อนโดยไม่ต้องเปิดหน้า 2)
  async listSessions(owner: SessionOwner): Promise<SessionSummary[]> {
    const where = ownerWhere(owner);
    const [rows] = await this.pool.query<SummaryRow[]>(
      `SELECT session_id, flow_id, current_state_id, status,
              UNIX_TIMESTAMP(created_at) AS created_epoch
         FROM sessions
        WHERE ${where.sql} AND expires_at > NOW()
        ORDER BY (status = 'in_progress') DESC, created_at DESC
        LIMIT ?`,
      [...where.params, MAX_HISTORY_ROWS],
    );
    return rows.map(toSummary);
  }

  async findCompleted(sessionId: string, owner: SessionOwner): Promise<CompletedSession | undefined> {
    const where = ownerWhere(owner);
    const [rows] = await this.pool.query<DetailRow[]>(
      `SELECT session_id, flow_id, current_state_id, status, variables, confidence,
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
      confidence: row.confidence === null ? null : Number(row.confidence),
      modelSelection: row.model_selection,
      outcomeText: row.outcome_text,
    };
  }

  async findSteps(sessionId: string): Promise<SessionHistoryEntry[]> {
    const [rows] = await this.pool.query<HistoryRow[]>(
      `SELECT state_id, action_type, action_value
         FROM session_history
        WHERE session_id = ?
        ORDER BY step_order`,
      [sessionId],
    );
    return rows.map(rowToHistoryEntry);
  }

  // ลบได้ทุกสถานะ (รวมที่ยังไม่จบ) แต่ต้องเป็นของ owner นี้
  async deleteSession(sessionId: string, owner: SessionOwner): Promise<boolean> {
    const where = ownerWhere(owner);
    const [result] = await this.pool.query<ResultSetHeader>(
      `DELETE FROM sessions
        WHERE session_id = ? AND ${where.sql} AND expires_at > NOW()`,
      [sessionId, ...where.params],
    );
    return result.affectedRows === 1;
  }

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

function toSummary(row: SummaryRow): SessionSummary {
  return {
    sessionId: row.session_id,
    flowId: row.flow_id,
    currentStateId: row.current_state_id,
    status: row.status,
    startedAtEpoch: Number(row.created_epoch),
  };
}
