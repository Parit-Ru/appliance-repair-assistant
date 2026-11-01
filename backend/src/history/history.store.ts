import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ownerWhere } from '../auth/session-owner';
import type { SessionOwner } from '../auth/session-owner';
import type { SessionHistoryEntry } from '../state-machine/types';
import { parseVariables, rowToHistoryEntry } from '../execution/session.store';
import type { HistoryRow } from '../execution/session.store';
import type { ModelSelection } from '../execution/execution.dto';
import type { HistoryFeedbackDto } from './history.dto';

export const MAX_HISTORY_ROWS = 50;

interface SummaryRow extends RowDataPacket {
  session_id: string;
  flow_id: string;
  current_state_id: string;
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

export interface CompletedSessionSummary {
  sessionId: string;
  flowId: string;
  currentStateId: string;
  startedAtEpoch: number;
}

export interface CompletedSession extends CompletedSessionSummary {
  variables: Record<string, string>;
  confidence: number | null;
  modelSelection: ModelSelection | null;
  outcomeText: string | null;
}

export class HistoryStore {
  constructor(private readonly pool: Pool) {}

  async listCompleted(owner: SessionOwner): Promise<CompletedSessionSummary[]> {
    const where = ownerWhere(owner);
    const [rows] = await this.pool.query<SummaryRow[]>(
      `SELECT session_id, flow_id, current_state_id,
              UNIX_TIMESTAMP(created_at) AS created_epoch
         FROM sessions
        WHERE ${where.sql} AND status = 'completed' AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT ?`,
      [...where.params, MAX_HISTORY_ROWS],
    );
    return rows.map(toSummary);
  }

  async findCompleted(sessionId: string, owner: SessionOwner): Promise<CompletedSession | undefined> {
    const where = ownerWhere(owner);
    const [rows] = await this.pool.query<DetailRow[]>(
      `SELECT session_id, flow_id, current_state_id, variables, confidence,
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

  async deleteCompleted(sessionId: string, owner: SessionOwner): Promise<boolean> {
    const where = ownerWhere(owner);
    const [result] = await this.pool.query<ResultSetHeader>(
      `DELETE FROM sessions
        WHERE session_id = ? AND ${where.sql} AND status = 'completed' AND expires_at > NOW()`,
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

function toSummary(row: SummaryRow): CompletedSessionSummary {
  return {
    sessionId: row.session_id,
    flowId: row.flow_id,
    currentStateId: row.current_state_id,
    startedAtEpoch: Number(row.created_epoch),
  };
}
