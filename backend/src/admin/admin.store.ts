import type { Pool, RowDataPacket } from 'mysql2/promise';
import { numOrNull } from '../common/helpers';
import type { EpochRange, OwnerType } from './admin.dto';

const OWNER_TYPE_SQL = `CASE
           WHEN s.user_id IS NOT NULL THEN 'user'
           WHEN s.client_id IS NOT NULL THEN 'guest'
           ELSE 'none'
         END`;

interface FeedbackRecord {
  sessionId: string;
  helpful: boolean;
  comment: string | null;
  createdEpoch: number;
  updatedEpoch: number;
  flowId: string;
  ownerType: OwnerType;
}

interface SessionTotals {
  total: number;
  completed: number;
  inProgress: number;
  expiredUnfinished: number;
  byUser: number;
  byGuest: number;
  byNone: number;
  averageConfidence: number | null;
  confidenceSamples: number;
}

interface FeedbackTotals {
  total: number;
  helpful: number;
}

interface Window {
  fromEpoch: number;
  toEpoch: number;
}

interface Row extends RowDataPacket {
  [column: string]: unknown;
}

const num = (value: unknown): number => Number(value ?? 0);

export class AdminStore {
  constructor(private readonly pool: Pool) {}

  async listFeedback(
    filter: EpochRange & { helpful?: boolean },
    limit: number,
    offset: number,
  ): Promise<{ rows: FeedbackRecord[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.helpful !== undefined) {
      clauses.push('f.helpful = ?');
      params.push(filter.helpful ? 1 : 0);
    }
    if (filter.fromEpoch !== undefined) {
      clauses.push('UNIX_TIMESTAMP(f.created_at) >= ?');
      params.push(filter.fromEpoch);
    }
    if (filter.toEpoch !== undefined) {
      clauses.push('UNIX_TIMESTAMP(f.created_at) < ?');
      params.push(filter.toEpoch);
    }
    const whereSql = clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`;

    const [countRows] = await this.pool.query<Row[]>(
      `SELECT COUNT(*) AS total
         FROM session_feedback f
         JOIN sessions s ON s.session_id = f.session_id
         ${whereSql}`,
      params,
    );

    const [rows] = await this.pool.query<Row[]>(
      `SELECT f.session_id, f.helpful, f.\`comment\`,
              UNIX_TIMESTAMP(f.created_at) AS created_epoch,
              UNIX_TIMESTAMP(f.updated_at) AS updated_epoch,
              s.flow_id,
              ${OWNER_TYPE_SQL} AS owner_type
         FROM session_feedback f
         JOIN sessions s ON s.session_id = f.session_id
         ${whereSql}
        ORDER BY f.created_at DESC, f.session_id
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      total: num(countRows[0]?.total),
      rows: rows.map((row) => ({
        sessionId: String(row.session_id),
        helpful: num(row.helpful) === 1,
        comment: row.comment === null || row.comment === undefined ? null : String(row.comment),
        createdEpoch: num(row.created_epoch),
        updatedEpoch: num(row.updated_epoch),
        flowId: String(row.flow_id),
        ownerType: row.owner_type as OwnerType,
      })),
    };
  }

  // GET /admin/analytics/summary

  async sessionTotals(window: Window): Promise<SessionTotals> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT COUNT(*) AS total,
              SUM(status = 'completed') AS completed,
              SUM(status = 'in_progress' AND expires_at > NOW()) AS in_progress,
              SUM(status = 'in_progress' AND expires_at <= NOW()) AS expired_unfinished,
              SUM(user_id IS NOT NULL) AS by_user,
              SUM(user_id IS NULL AND client_id IS NOT NULL) AS by_guest,
              SUM(user_id IS NULL AND client_id IS NULL) AS by_none,
              AVG(confidence) AS avg_confidence,
              COUNT(confidence) AS confidence_samples
         FROM sessions
        WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?`,
      [window.fromEpoch, window.toEpoch],
    );
    const row = rows[0] ?? {};
    return {
      total: num(row.total),
      completed: num(row.completed),
      inProgress: num(row.in_progress),
      expiredUnfinished: num(row.expired_unfinished),
      byUser: num(row.by_user),
      byGuest: num(row.by_guest),
      byNone: num(row.by_none),
      averageConfidence: numOrNull(row.avg_confidence),
      confidenceSamples: num(row.confidence_samples),
    };
  }

  async feedbackTotals(window: Window): Promise<FeedbackTotals> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT COUNT(*) AS total, SUM(helpful = 1) AS helpful_count
         FROM session_feedback
        WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?`,
      [window.fromEpoch, window.toEpoch],
    );
    return { total: num(rows[0]?.total), helpful: num(rows[0]?.helpful_count) };
  }

  async flowCounts(window: Window): Promise<Array<{ flowId: string; count: number }>> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT flow_id, COUNT(*) AS n
         FROM sessions
        WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
        GROUP BY flow_id`,
      [window.fromEpoch, window.toEpoch],
    );
    return rows.map((row) => ({ flowId: String(row.flow_id), count: num(row.n) }));
  }

  async completedEndStates(window: Window): Promise<Array<{ flowId: string; stateId: string; count: number }>> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT flow_id, current_state_id, COUNT(*) AS n
         FROM sessions
        WHERE status = 'completed'
          AND UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
        GROUP BY flow_id, current_state_id`,
      [window.fromEpoch, window.toEpoch],
    );
    return rows.map((row) => ({
      flowId: String(row.flow_id),
      stateId: String(row.current_state_id),
      count: num(row.n),
    }));
  }

  async perDay(window: Window): Promise<Array<{ dayIndex: number; started: number; completed: number }>> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT FLOOR((UNIX_TIMESTAMP(created_at) + 25200) / 86400) AS day_idx,
              COUNT(*) AS started,
              SUM(status = 'completed') AS completed
         FROM sessions
        WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
        GROUP BY day_idx`,
      [window.fromEpoch, window.toEpoch],
    );
    return rows.map((row) => ({
      dayIndex: num(row.day_idx),
      started: num(row.started),
      completed: num(row.completed),
    }));
  }
}
