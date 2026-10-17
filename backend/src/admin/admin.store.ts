/**
 * admin.store.ts — SQL ทั้งหมดของ /admin/* · อ่านอย่างเดียว (SELECT เท่านั้น ไม่มี INSERT/UPDATE/DELETE)
 *
 * แยกจาก SessionStore / HistoryStore โดยตั้งใจ: store เหล่านั้นผูกกับเจ้าของ (ownerWhere) ส่วนที่นี่ "มองข้ามเจ้าของ"
 * ตามหน้าที่ของ admin จึงรวมไว้ไฟล์เดียวที่เข้าถึงได้ผ่าน guard Admin เท่านั้น (ดู admin.controller.ts)
 *
 * ความเป็นส่วนตัว:
 *   - ไม่แตะตาราง users และไม่ SELECT คอลัมน์ email / password_hash / display_name / user_id / client_id
 *   - รู้เจ้าของแค่ 3 ชนิดผ่าน CASE ... AS owner_type (user | guest | none) — ใช้ user_id/client_id เฉพาะใน IS [NOT] NULL
 *
 * SQL ประกอบจากชิ้นคงที่ในไฟล์นี้เท่านั้น ค่าจากผู้ใช้ไปทางพารามิเตอร์ (?) ทั้งหมด
 * เวลา: เทียบด้วย UNIX_TIMESTAMP(คอลัมน์) กับ epoch ที่คำนวณใน Node (เวลาไทย) ไม่ขึ้นกับ time_zone ของ MySQL
 * ไม่ต้องมี index เพิ่ม (ข้อมูลระดับ demo) — ถ้าข้อมูลโตให้พิจารณา INDEX (created_at) ภายหลัง
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import type { AdminSessionStatus, EpochRange, OwnerType } from './admin.dto';

/** ชนิดเจ้าของจาก user_id / client_id โดยไม่ดึงค่า id ออกมา */
const OWNER_TYPE_SQL = `CASE
           WHEN s.user_id IS NOT NULL THEN 'user'
           WHEN s.client_id IS NOT NULL THEN 'guest'
           ELSE 'none'
         END`;

const OWNER_FILTER_SQL: Record<OwnerType, string> = {
  user: 's.user_id IS NOT NULL',
  guest: 's.user_id IS NULL AND s.client_id IS NOT NULL',
  none: 's.user_id IS NULL AND s.client_id IS NULL',
};

interface Where {
  sql: string;
  params: unknown[];
}

function joinWhere(clauses: string[], params: unknown[]): Where {
  return { sql: clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`, params };
}

function timeClauses(column: string, range: EpochRange, clauses: string[], params: unknown[]): void {
  if (range.fromEpoch !== undefined) {
    clauses.push(`UNIX_TIMESTAMP(${column}) >= ?`);
    params.push(range.fromEpoch);
  }
  if (range.toEpoch !== undefined) {
    clauses.push(`UNIX_TIMESTAMP(${column}) < ?`);
    params.push(range.toEpoch);
  }
}

// ---------- แถวที่ store คืน (ไม่มี id ของเจ้าของ ไม่มี email) ----------

export interface FeedbackRecord {
  sessionId: string;
  helpful: boolean;
  comment: string | null;
  createdEpoch: number;
  updatedEpoch: number;
  graphId: string;
  ownerType: OwnerType;
}

export interface SessionRecord {
  sessionId: string;
  graphId: string;
  currentNodeId: string;
  status: AdminSessionStatus;
  expired: boolean;
  confidence: number | null;
  modelSelection: 'selected' | 'unknown' | null;
  hasFeedback: boolean;
  ownerType: OwnerType;
  createdEpoch: number;
}

export interface SessionTotals {
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

export interface FeedbackTotals {
  total: number;
  helpful: number;
}

export interface Window {
  /** รวมปลายนี้ */
  fromEpoch: number;
  /** ไม่รวมปลายนี้ */
  toEpoch: number;
}

interface Row extends RowDataPacket {
  [column: string]: unknown;
}

const num = (value: unknown): number => Number(value ?? 0);
const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

@Injectable()
export class AdminStore {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  // ============================================================
  // GET /admin/feedback
  // ============================================================

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
    timeClauses('f.created_at', filter, clauses, params);
    const where = joinWhere(clauses, params);

    const [countRows] = await this.pool.query<Row[]>(
      `SELECT COUNT(*) AS total
         FROM session_feedback f
         JOIN sessions s ON s.session_id = f.session_id
         ${where.sql}`,
      where.params,
    );

    const [rows] = await this.pool.query<Row[]>(
      `SELECT f.session_id, f.helpful, f.\`comment\`,
              UNIX_TIMESTAMP(f.created_at) AS created_epoch,
              UNIX_TIMESTAMP(f.updated_at) AS updated_epoch,
              s.graph_id,
              ${OWNER_TYPE_SQL} AS owner_type
         FROM session_feedback f
         JOIN sessions s ON s.session_id = f.session_id
         ${where.sql}
        ORDER BY f.created_at DESC, f.session_id
        LIMIT ? OFFSET ?`,
      [...where.params, limit, offset],
    );

    return {
      total: num(countRows[0]?.total),
      rows: rows.map((row) => ({
        sessionId: String(row.session_id),
        helpful: num(row.helpful) === 1,
        comment: row.comment === null || row.comment === undefined ? null : String(row.comment),
        createdEpoch: num(row.created_epoch),
        updatedEpoch: num(row.updated_epoch),
        graphId: String(row.graph_id),
        ownerType: row.owner_type as OwnerType,
      })),
    };
  }

  // ============================================================
  // GET /admin/sessions
  // ============================================================

  async listSessions(
    filter: EpochRange & { status?: AdminSessionStatus; ownerType?: OwnerType; graphId?: string },
    limit: number,
    offset: number,
  ): Promise<{ rows: SessionRecord[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.status !== undefined) {
      clauses.push('s.status = ?');
      params.push(filter.status);
    }
    if (filter.ownerType !== undefined) {
      clauses.push(OWNER_FILTER_SQL[filter.ownerType]);
    }
    if (filter.graphId !== undefined) {
      clauses.push('s.graph_id = ?');
      params.push(filter.graphId);
    }
    timeClauses('s.created_at', filter, clauses, params);
    const where = joinWhere(clauses, params);

    const [countRows] = await this.pool.query<Row[]>(
      `SELECT COUNT(*) AS total FROM sessions s ${where.sql}`,
      where.params,
    );

    const [rows] = await this.pool.query<Row[]>(
      `SELECT s.session_id, s.graph_id, s.current_node_id, s.status,
              (s.expires_at <= NOW()) AS expired,
              s.confidence, s.model_selection,
              UNIX_TIMESTAMP(s.created_at) AS created_epoch,
              (f.session_id IS NOT NULL) AS has_feedback,
              ${OWNER_TYPE_SQL} AS owner_type
         FROM sessions s
         LEFT JOIN session_feedback f ON f.session_id = s.session_id
         ${where.sql}
        ORDER BY s.created_at DESC, s.session_id
        LIMIT ? OFFSET ?`,
      [...where.params, limit, offset],
    );

    return {
      total: num(countRows[0]?.total),
      rows: rows.map((row) => ({
        sessionId: String(row.session_id),
        graphId: String(row.graph_id),
        currentNodeId: String(row.current_node_id),
        status: row.status as AdminSessionStatus,
        expired: num(row.expired) === 1,
        confidence: numOrNull(row.confidence),
        modelSelection: (row.model_selection ?? null) as 'selected' | 'unknown' | null,
        hasFeedback: num(row.has_feedback) === 1,
        ownerType: row.owner_type as OwnerType,
        createdEpoch: num(row.created_epoch),
      })),
    };
  }

  // ============================================================
  // GET /admin/analytics/summary — ทุกคำสั่งใช้ช่วงเวลา window เดียวกัน
  // ============================================================

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

  /** จำนวน session ต่อผัง (ทุกผังที่มี session ในช่วง · service จัดอันดับและรวมเป็นประเภทเครื่องเอง) */
  async graphCounts(window: Window): Promise<Array<{ graphId: string; count: number }>> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT graph_id, COUNT(*) AS n
         FROM sessions
        WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
        GROUP BY graph_id`,
      [window.fromEpoch, window.toEpoch],
    );
    return rows.map((row) => ({ graphId: String(row.graph_id), count: num(row.n) }));
  }

  /** โหนดสุดท้ายของ session ที่จบแล้ว (service แปลงเป็น outcome_kind จากผังปัจจุบัน) */
  async completedEndNodes(window: Window): Promise<Array<{ graphId: string; nodeId: string; count: number }>> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT graph_id, current_node_id, COUNT(*) AS n
         FROM sessions
        WHERE status = 'completed'
          AND UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
        GROUP BY graph_id, current_node_id`,
      [window.fromEpoch, window.toEpoch],
    );
    return rows.map((row) => ({
      graphId: String(row.graph_id),
      nodeId: String(row.current_node_id),
      count: num(row.n),
    }));
  }

  /** จำนวนเริ่ม/จบต่อวัน · day_idx = เลขวันนับจาก 1970-01-01 ตามเวลาไทย (ไม่ขึ้นกับ time_zone ของ MySQL) */
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
