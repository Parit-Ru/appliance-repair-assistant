import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { FlowListQuery } from './flow-admin.dto';
import { adminFlowNotFound, flowAlreadyDeleted, flowDeleted, flowEditConflict, flowNotDeleted } from './flow-admin.errors';

type Db = Pool | PoolConnection;

interface Row extends RowDataPacket {
  [column: string]: unknown;
}

const num = (value: unknown): number => Number(value ?? 0);
const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const textOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));

// MySQL JSON columns may arrive parsed or as text depending on the driver path
function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface FlowHeadRecord {
  flowId: string;
  manualId: string;
  deviceCategory: string;
  brand: string;
  modelPattern: string;
  displayName: string | null;
  revision: number;
  editedEpoch: number | null;
  editedByName: string | null;
  deletedEpoch: number | null;
  deletedByName: string | null;
}

export interface FlowListRecord extends FlowHeadRecord {
  entrySymptom: string;
  entrySymptomTh: string | null;
  stateCount: number;
  sessionCount: number;
  activeSessionCount: number;
}

export interface StateRecord {
  stateId: string;
  stateType: string;
  textContent: string;
  inputType: string | null;
  inputPattern: string | null;
  storeAs: string | null;
  outcomeKind: string | null;
  safetyCritical: boolean;
  safetyWarning: string | null;
  authorNote: string | null;
}

/** One state whose text really changes; an undefined field is left untouched */
export interface StateChange {
  stateId: string;
  textContent?: string;
  safetyWarning?: string;
}

export interface TransitionRecord {
  fromStateId: string;
  inputSymbol: string;
  toStateId: string;
}

export interface FlowDetailRecord extends FlowHeadRecord {
  sourceManual: string;
  source: string;
  sourceChunkId: string;
  entrySymptom: string;
  entrySymptomTh: string | null;
  entrySymptomAliases: string[];
  severity: string | null;
  difficulty: string | null;
  pageStart: number;
  pageEnd: number;
  initialState: string;
  createdEpoch: number;
  updatedEpoch: number;
  states: StateRecord[];
  transitions: TransitionRecord[];
  usage: { sessions: number; completed: number; feedback: number; activeByState: Record<string, number> };
}

const HEAD_COLUMNS = `
       f.flow_id, f.manual_id, m.device_category, m.brand, m.model_pattern, m.display_name,
       f.revision,
       UNIX_TIMESTAMP(f.edited_at)  AS edited_epoch,  eu.display_name AS edited_by_name,
       UNIX_TIMESTAMP(f.deleted_at) AS deleted_epoch, du.display_name AS deleted_by_name`;

const HEAD_JOINS = `
  FROM flows f
  JOIN manuals m ON m.manual_id = f.manual_id
  LEFT JOIN users eu ON eu.id = f.edited_by
  LEFT JOIN users du ON du.id = f.deleted_by`;

function toHead(row: Row): FlowHeadRecord {
  return {
    flowId: String(row.flow_id),
    manualId: String(row.manual_id),
    deviceCategory: String(row.device_category),
    brand: String(row.brand),
    modelPattern: String(row.model_pattern),
    displayName: textOrNull(row.display_name),
    revision: num(row.revision),
    editedEpoch: numOrNull(row.edited_epoch),
    editedByName: textOrNull(row.edited_by_name),
    deletedEpoch: numOrNull(row.deleted_epoch),
    deletedByName: textOrNull(row.deleted_by_name),
  };
}

const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

export class FlowAdminStore {
  constructor(private readonly pool: Pool) {}

  async list(query: FlowListQuery): Promise<{ rows: FlowListRecord[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (query.status === 'active') clauses.push('f.deleted_at IS NULL');
    if (query.status === 'deleted') clauses.push('f.deleted_at IS NOT NULL');
    if (query.manualId !== undefined) {
      clauses.push('f.manual_id = ?');
      params.push(query.manualId);
    }
    if (query.deviceCategory !== undefined) {
      clauses.push('m.device_category = ?');
      params.push(query.deviceCategory);
    }
    if (query.q !== undefined) {
      const like = `%${escapeLike(query.q)}%`;
      clauses.push(
        `(f.flow_id LIKE ? OR f.entry_symptom LIKE ? OR f.entry_symptom_th LIKE ?
          OR m.model_pattern LIKE ? OR m.display_name LIKE ? OR m.brand LIKE ?)`,
      );
      params.push(like, like, like, like, like, like);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const [countRows] = await this.pool.query<Row[]>(
      `SELECT COUNT(*) AS total
         FROM flows f
         JOIN manuals m ON m.manual_id = f.manual_id
         ${where}`,
      params,
    );

    const [rows] = await this.pool.query<Row[]>(
      `SELECT ${HEAD_COLUMNS},
              f.entry_symptom, f.entry_symptom_th,
              (SELECT COUNT(*) FROM states s WHERE s.flow_id = f.flow_id) AS state_count,
              (SELECT COUNT(*) FROM sessions x WHERE x.flow_id = f.flow_id) AS session_count,
              (SELECT COUNT(*) FROM sessions x
                WHERE x.flow_id = f.flow_id AND x.status = 'in_progress' AND x.expires_at > NOW()) AS active_session_count
         ${HEAD_JOINS}
         ${where}
        ORDER BY f.flow_id
        LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );

    return {
      total: num(countRows[0]?.total),
      rows: rows.map((row) => ({
        ...toHead(row),
        entrySymptom: String(row.entry_symptom),
        entrySymptomTh: textOrNull(row.entry_symptom_th),
        stateCount: num(row.state_count),
        sessionCount: num(row.session_count),
        activeSessionCount: num(row.active_session_count),
      })),
    };
  }

  /**
   * Edit the text of existing states in one transaction.
   * The flows row is locked first (SELECT ... FOR UPDATE), so two admins saving the same flow run one after the other;
   * the second sees the new revision and gets 409. `plan` is pure: it validates the request against the current rows,
   * returns only the states that really change, and builds the snapshot of the flow as it was before the edit.
   */
  async updateStates(
    flowId: string,
    actorId: string,
    expectedRevision: number,
    plan: (current: FlowDetailRecord) => { changes: StateChange[]; snapshot: unknown },
  ): Promise<{ changed: number }> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const [locked] = await conn.query<Row[]>(
        `SELECT f.revision, f.deleted_at IS NOT NULL AS is_deleted,
                UNIX_TIMESTAMP(f.edited_at) AS edited_epoch, eu.display_name AS edited_by_name,
                UNIX_TIMESTAMP(f.deleted_at) AS deleted_epoch, du.display_name AS deleted_by_name
           FROM flows f
           LEFT JOIN users eu ON eu.id = f.edited_by
           LEFT JOIN users du ON du.id = f.deleted_by
          WHERE f.flow_id = ?
          FOR UPDATE`,
        [flowId],
      );
      const row = locked[0];
      if (!row) throw adminFlowNotFound(flowId);
      if (num(row.is_deleted) === 1) throw flowDeleted(textOrNull(row.deleted_by_name), numOrNull(row.deleted_epoch));
      if (num(row.revision) !== expectedRevision) throw flowEditConflict(textOrNull(row.edited_by_name), numOrNull(row.edited_epoch));

      const current = await this.readDetail(conn, flowId);
      if (!current) throw adminFlowNotFound(flowId);

      const { changes, snapshot } = plan(current);
      if (changes.length === 0) {
        await conn.rollback();
        return { changed: 0 };
      }

      await conn.query(
        'INSERT INTO flow_revisions (flow_id, action, revision, snapshot, acted_by) VALUES (?, ?, ?, ?, ?)',
        [flowId, 'edit', current.revision, JSON.stringify(snapshot), actorId],
      );

      for (const change of changes) {
        const sets: string[] = [];
        const params: unknown[] = [];
        if (change.textContent !== undefined) {
          sets.push('text_content = ?');
          params.push(change.textContent);
        }
        if (change.safetyWarning !== undefined) {
          sets.push('safety_warning = ?');
          params.push(change.safetyWarning);
        }
        await conn.query(`UPDATE states SET ${sets.join(', ')} WHERE flow_id = ? AND state_id = ?`, [...params, flowId, change.stateId]);
      }

      await conn.query('UPDATE flows SET revision = revision + 1, edited_at = NOW(), edited_by = ? WHERE flow_id = ?', [actorId, flowId]);

      await conn.commit();
      return { changed: changes.length };
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Soft delete / restore in one transaction. Rows of the flow, its sessions, history and feedback are never touched:
   * sessions.flow_id is ON DELETE RESTRICT and users' history must stay readable.
   * Every call is written to flow_revisions (kept after a restore too) and manuals.flow_count follows the active flows.
   */
  async setDeleted(flowId: string, actorId: string, deleted: boolean): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const [locked] = await conn.query<Row[]>(
        `SELECT f.manual_id, f.revision, f.deleted_at IS NOT NULL AS is_deleted,
                UNIX_TIMESTAMP(f.deleted_at) AS deleted_epoch, du.display_name AS deleted_by_name
           FROM flows f
           LEFT JOIN users du ON du.id = f.deleted_by
          WHERE f.flow_id = ?
          FOR UPDATE`,
        [flowId],
      );
      const row = locked[0];
      if (!row) throw adminFlowNotFound(flowId);
      const isDeleted = num(row.is_deleted) === 1;
      if (deleted && isDeleted) throw flowAlreadyDeleted(textOrNull(row.deleted_by_name), numOrNull(row.deleted_epoch));
      if (!deleted && !isDeleted) throw flowNotDeleted();

      await conn.query('INSERT INTO flow_revisions (flow_id, action, revision, snapshot, acted_by) VALUES (?, ?, ?, NULL, ?)', [
        flowId,
        deleted ? 'delete' : 'restore',
        num(row.revision),
        actorId,
      ]);

      await conn.query(
        deleted
          ? 'UPDATE flows SET deleted_at = NOW(), deleted_by = ? WHERE flow_id = ?'
          : 'UPDATE flows SET deleted_at = NULL, deleted_by = NULL WHERE flow_id = ?',
        deleted ? [actorId, flowId] : [flowId],
      );

      await conn.query(
        'UPDATE manuals SET flow_count = (SELECT COUNT(*) FROM flows WHERE manual_id = ? AND deleted_at IS NULL) WHERE manual_id = ?',
        [row.manual_id, row.manual_id],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      throw err;
    } finally {
      conn.release();
    }
  }

  async findDetail(flowId: string): Promise<FlowDetailRecord | null> {
    return this.readDetail(this.pool, flowId);
  }

  private async readDetail(db: Db, flowId: string): Promise<FlowDetailRecord | null> {
    const [headRows] = await db.query<Row[]>(
      `SELECT ${HEAD_COLUMNS},
              m.source_manual, f.source, f.source_chunk_id,
              f.entry_symptom, f.entry_symptom_th, f.entry_symptom_aliases,
              f.severity, f.difficulty, f.page_start, f.page_end, f.initial_state,
              UNIX_TIMESTAMP(f.created_at) AS created_epoch, UNIX_TIMESTAMP(f.updated_at) AS updated_epoch
         ${HEAD_JOINS}
        WHERE f.flow_id = ?`,
      [flowId],
    );
    const head = headRows[0];
    if (!head) return null;

    const [stateRows] = await db.query<Row[]>(
      `SELECT state_id, state_type, text_content, input_type, input_pattern, store_as, outcome_kind,
              safety_critical, safety_warning, author_note
         FROM states
        WHERE flow_id = ?
        ORDER BY display_order, state_id`,
      [flowId],
    );

    const [transitionRows] = await db.query<Row[]>(
      'SELECT from_state_id, input_symbol, to_state_id FROM state_transitions WHERE flow_id = ?',
      [flowId],
    );

    const [totalRows] = await db.query<Row[]>(
      `SELECT COUNT(*) AS sessions, COALESCE(SUM(status = 'completed'), 0) AS completed
         FROM sessions WHERE flow_id = ?`,
      [flowId],
    );

    const [feedbackRows] = await db.query<Row[]>(
      `SELECT COUNT(*) AS feedback
         FROM session_feedback f
         JOIN sessions s ON s.session_id = f.session_id
        WHERE s.flow_id = ?`,
      [flowId],
    );

    const [activeRows] = await db.query<Row[]>(
      `SELECT current_state_id, COUNT(*) AS total
         FROM sessions
        WHERE flow_id = ? AND status = 'in_progress' AND expires_at > NOW()
        GROUP BY current_state_id`,
      [flowId],
    );

    const activeByState: Record<string, number> = {};
    for (const row of activeRows) activeByState[String(row.current_state_id)] = num(row.total);

    return {
      ...toHead(head),
      sourceManual: String(head.source_manual),
      source: String(head.source),
      sourceChunkId: String(head.source_chunk_id),
      entrySymptom: String(head.entry_symptom),
      entrySymptomTh: textOrNull(head.entry_symptom_th),
      entrySymptomAliases: parseJson<string[]>(head.entry_symptom_aliases, []),
      severity: textOrNull(head.severity),
      difficulty: textOrNull(head.difficulty),
      pageStart: num(head.page_start),
      pageEnd: num(head.page_end),
      initialState: String(head.initial_state),
      createdEpoch: num(head.created_epoch),
      updatedEpoch: num(head.updated_epoch),
      states: stateRows.map((row) => ({
        stateId: String(row.state_id),
        stateType: String(row.state_type),
        textContent: String(row.text_content),
        inputType: textOrNull(row.input_type),
        inputPattern: textOrNull(row.input_pattern),
        storeAs: textOrNull(row.store_as),
        outcomeKind: textOrNull(row.outcome_kind),
        safetyCritical: num(row.safety_critical) === 1,
        safetyWarning: textOrNull(row.safety_warning),
        authorNote: textOrNull(row.author_note),
      })),
      transitions: transitionRows.map((row) => ({
        fromStateId: String(row.from_state_id),
        inputSymbol: String(row.input_symbol),
        toStateId: String(row.to_state_id),
      })),
      usage: {
        sessions: num(totalRows[0]?.sessions),
        completed: num(totalRows[0]?.completed),
        feedback: num(feedbackRows[0]?.feedback),
        activeByState,
      },
    };
  }
}
