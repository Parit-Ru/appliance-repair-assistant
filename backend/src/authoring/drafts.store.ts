import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { numOrNull } from '../common/helpers';
import { FLOW_COLUMNS, MANUAL_COLUMNS, STATE_COLUMNS, TRANSITION_COLUMNS } from './draft-manual';
import type { DbRows, DraftMeta } from './draft-manual';
import type { DraftFlow } from './draft-schema';
import type { DraftStatus } from './drafts.dto';
import { draftIdConflict, draftNotFound, draftNotReady } from './drafts.errors';
import type { ValidationReport } from './flow-validator';
import type { PageText } from './pdf-text';

export interface DraftRecord {
  id: string;
  status: DraftStatus;
  manualId: string;
  meta: DraftMeta;
  pages: PageText[];
  flows: DraftFlow[] | null;
  validation: ValidationReport | null;
  progressDone: number;
  progressTotal: number;
  errorCode: string | null;
  errorMessage: string | null;
  llmModel: string | null;
  promptVersion: string | null;
  createdAtEpoch: number;
  updatedAtEpoch: number;
  reviewedAtEpoch: number | null;
  publishedAtEpoch: number | null;
}

interface DraftListRow {
  id: string;
  status: DraftStatus;
  manualId: string;
  meta: DraftMeta;
  flowCount: number | null;
  progressDone: number;
  progressTotal: number;
  errorCode: string | null;
  errorMessage: string | null;
  errorCountInValidation: number | null;
  warningCountInValidation: number | null;
  createdAtEpoch: number;
  updatedAtEpoch: number;
}

interface NewDraft {
  id: string;
  manualId: string;
  meta: DraftMeta;
  pages: PageText[];
  progressTotal: number;
  llmModel: string | null;
  promptVersion: string | null;
  createdBy: string;
}

export interface PreparedPublish {
  rows: DbRows;
  report: ValidationReport;
  flowIds: string[];
}

interface Row extends RowDataPacket {
  [column: string]: unknown;
}

const SELECT_DRAFT = `SELECT id, status, manual_id, meta, pages, flows, validation, progress_done, progress_total,
                              error_code, error_message, llm_model, prompt_version,
                              UNIX_TIMESTAMP(created_at) AS created_epoch, UNIX_TIMESTAMP(updated_at) AS updated_epoch,
                              UNIX_TIMESTAMP(reviewed_at) AS reviewed_epoch, UNIX_TIMESTAMP(published_at) AS published_epoch
                         FROM flow_drafts`;


function json<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

function toRecord(row: Row): DraftRecord {
  return {
    id: String(row.id),
    status: row.status as DraftStatus,
    manualId: String(row.manual_id),
    meta: json<DraftMeta>(row.meta) as DraftMeta,
    pages: json<PageText[]>(row.pages) ?? [],
    flows: json<DraftFlow[]>(row.flows),
    validation: json<ValidationReport>(row.validation),
    progressDone: Number(row.progress_done),
    progressTotal: Number(row.progress_total),
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    llmModel: (row.llm_model as string | null) ?? null,
    promptVersion: (row.prompt_version as string | null) ?? null,
    createdAtEpoch: Number(row.created_epoch),
    updatedAtEpoch: Number(row.updated_epoch),
    reviewedAtEpoch: numOrNull(row.reviewed_epoch),
    publishedAtEpoch: numOrNull(row.published_epoch),
  };
}

export class DraftsStore {
  constructor(private readonly pool: Pool) {}

  async insert(draft: NewDraft): Promise<void> {
    await this.pool.query(
      `INSERT INTO flow_drafts
         (id, status, manual_id, meta, pages, progress_total, llm_model, prompt_version, created_by)
       VALUES (?, 'drafting', ?, ?, ?, ?, ?, ?, ?)`,
      [draft.id, draft.manualId, JSON.stringify(draft.meta), JSON.stringify(draft.pages), draft.progressTotal, draft.llmModel, draft.promptVersion, draft.createdBy],
    );
  }

  async findById(id: string): Promise<DraftRecord | undefined> {
    const [rows] = await this.pool.query<Row[]>(`${SELECT_DRAFT} WHERE id = ?`, [id]);
    return rows[0] ? toRecord(rows[0]) : undefined;
  }

  async list(): Promise<DraftListRow[]> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT id, status, manual_id, meta, progress_done, progress_total, error_code, error_message,
              JSON_LENGTH(flows) AS flow_count,
              JSON_LENGTH(JSON_EXTRACT(validation, '$.errors')) AS error_count,
              JSON_LENGTH(JSON_EXTRACT(validation, '$.warnings')) AS warning_count,
              UNIX_TIMESTAMP(created_at) AS created_epoch, UNIX_TIMESTAMP(updated_at) AS updated_epoch
         FROM flow_drafts
        ORDER BY created_at DESC
        LIMIT 100`,
    );
    return rows.map((row) => ({
      id: String(row.id),
      status: row.status as DraftStatus,
      manualId: String(row.manual_id),
      meta: json<DraftMeta>(row.meta) as DraftMeta,
      flowCount: numOrNull(row.flow_count),
      progressDone: Number(row.progress_done),
      progressTotal: Number(row.progress_total),
      errorCode: (row.error_code as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
      errorCountInValidation: numOrNull(row.error_count),
      warningCountInValidation: numOrNull(row.warning_count),
      createdAtEpoch: Number(row.created_epoch),
      updatedAtEpoch: Number(row.updated_epoch),
    }));
  }

  async countDrafting(): Promise<number> {
    const [rows] = await this.pool.query<Row[]>(`SELECT COUNT(*) AS n FROM flow_drafts WHERE status = 'drafting'`);
    return Number(rows[0]?.n ?? 0);
  }

  async failInterrupted(): Promise<number> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE flow_drafts
          SET status = 'failed', error_code = 'INTERRUPTED', error_message = 'งานถูกขัดจังหวะ (เซิร์ฟเวอร์เริ่มทำงานใหม่) ให้อัปโหลดคู่มือใหม่'
        WHERE status = 'drafting'`,
    );
    return result.affectedRows;
  }

  async setProgress(id: string, done: number): Promise<void> {
    await this.pool.query(`UPDATE flow_drafts SET progress_done = ? WHERE id = ? AND status = 'drafting'`, [done, id]);
  }

  async markReady(id: string, flows: DraftFlow[], validation: ValidationReport): Promise<void> {
    await this.pool.query(
      `UPDATE flow_drafts
          SET status = 'ready', flows = ?, validation = ?, error_code = NULL, error_message = NULL
        WHERE id = ? AND status = 'drafting'`,
      [JSON.stringify(flows), JSON.stringify(validation), id],
    );
  }

  async markFailed(id: string, code: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE flow_drafts SET status = 'failed', error_code = ?, error_message = ? WHERE id = ? AND status = 'drafting'`,
      [code, message.slice(0, 500), id],
    );
  }

  async saveEdit(id: string, flows: DraftFlow[], validation: ValidationReport): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE flow_drafts SET flows = ?, validation = ? WHERE id = ? AND status = 'ready'`,
      [JSON.stringify(flows), JSON.stringify(validation), id],
    );
    return result.affectedRows === 1;
  }

  async reject(id: string, userId: string, reason: string | undefined): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE flow_drafts
          SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), error_code = 'REJECTED', error_message = ?
        WHERE id = ? AND status IN ('ready', 'failed')`,
      [userId, reason ?? null, id],
    );
    return result.affectedRows === 1;
  }
  async publish(id: string, userId: string, prepare: (draft: DraftRecord) => PreparedPublish): Promise<string[]> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<Row[]>(`${SELECT_DRAFT} WHERE id = ? FOR UPDATE`, [id]);
      if (!rows[0]) throw draftNotFound(id);
      const draft = toRecord(rows[0]);
      if (draft.status !== 'ready') throw draftNotReady('publish', draft.status);

      const prepared = prepare(draft);
      await this.assertNoConflicts(conn, prepared);

      const { rows: db } = prepared;
      await conn.query(`INSERT INTO manuals (${MANUAL_COLUMNS.join(', ')}) VALUES (?)`, [MANUAL_COLUMNS.map((c) => db.manual[c])]);
      await conn.query(`INSERT INTO flows (${FLOW_COLUMNS.join(', ')}) VALUES ?`, [db.flows.map((g) => FLOW_COLUMNS.map((c) => g[c]))]);
      await conn.query(`INSERT INTO states (${STATE_COLUMNS.join(', ')}) VALUES ?`, [db.states.map((n) => STATE_COLUMNS.map((c) => n[c]))]);
      // transition อ้างอิง states (FK) จึง INSERT หลัง states ใน transaction เดียวกัน
      if (db.transitions.length > 0) {
        await conn.query(`INSERT INTO state_transitions (${TRANSITION_COLUMNS.join(', ')}) VALUES ?`, [db.transitions.map((t) => TRANSITION_COLUMNS.map((c) => t[c]))]);
      }

      await conn.query(
        `UPDATE flow_drafts
            SET status = 'published', validation = ?, reviewed_by = ?, reviewed_at = NOW(), published_at = NOW(),
                error_code = NULL, error_message = NULL
          WHERE id = ?`,
        [JSON.stringify(prepared.report), userId, id],
      );

      await conn.commit();
      return prepared.flowIds;
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw draftIdConflict(['มี id เดียวกันถูกเพิ่มระหว่างเผยแพร่']);
      throw err;
    } finally {
      conn.release();
    }
  }

  private async assertNoConflicts(conn: PoolConnection, prepared: PreparedPublish): Promise<void> {
    const conflicts: string[] = [];

    const [manuals] = await conn.query<Row[]>(`SELECT manual_id FROM manuals WHERE manual_id = ?`, [prepared.rows.manual.manual_id]);
    for (const row of manuals) conflicts.push(`manual_id '${String(row.manual_id)}'`);

    const [flows] = await conn.query<Row[]>(`SELECT flow_id FROM flows WHERE flow_id IN (?)`, [prepared.flowIds]);
    for (const row of flows) conflicts.push(`flow_id '${String(row.flow_id)}'`);

    if (conflicts.length > 0) throw draftIdConflict(conflicts);
  }
}
