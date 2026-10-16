/**
 * fake-sessions-pool.ts — ฐานข้อมูลจำลองในหน่วยความจำ ใช้เฉพาะในเทสต์ (ไม่ถูก build เข้า dist: ดู tsconfig.build.json)
 *
 * ทำไมไม่ต่อ MySQL จริง: เทสต์ต้องไม่แตะฐานข้อมูลคลาวด์ที่ใช้ร่วมกันและต้องรันได้ทุกเครื่อง
 *
 * ข้อสำคัญ: ตัวจำลองนี้ "ไม่รู้" กฎเจ้าของเอง มันทำตามเงื่อนไขที่ปรากฏในข้อความ SQL ที่ store ส่งมาเท่านั้น
 *   - มี `user_id = ?` / `client_id = ?` / `session_id = ?` → เทียบกับค่าพารามิเตอร์ตามลำดับที่ปรากฏ
 *   - มี `user_id IS NULL` / `status = 'completed'` / `expires_at > NOW()` → ใช้เงื่อนไขนั้น ไม่มี = ไม่ใช้
 * ถ้า store ลืมใส่เงื่อนไขเจ้าของ (เช่น ลืม AND user_id IS NULL) เทสต์จะเห็นแถวของคนอื่นและล้มทันที
 * รองรับเฉพาะคำสั่งที่ SessionStore / HistoryStore ใช้ คำสั่งอื่นโยน error
 */

import type { Pool } from 'mysql2/promise';

export interface FakeSessionRow {
  session_id: string;
  graph_id: string;
  current_node_id: string;
  status: 'in_progress' | 'completed';
  user_id: string | null;
  client_id: string | null;
  expired: boolean;
  created_epoch: number;
  variables: string;
  confidence: string | null;
  model_selection: 'selected' | 'unknown' | null;
  outcome_text: string | null;
}

let counter = 0;

export function makeSessionRow(overrides: Partial<FakeSessionRow> = {}): FakeSessionRow {
  counter += 1;
  return {
    session_id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    graph_id: 'graph-x',
    current_node_id: 'end-node',
    status: 'completed',
    user_id: null,
    client_id: null,
    expired: false,
    created_epoch: 1_760_000_000 + counter,
    variables: '{}',
    confidence: null,
    model_selection: null,
    outcome_text: null,
    ...overrides,
  };
}

export class FakeSessionsPool {
  readonly rows: FakeSessionRow[];
  readonly feedback = new Map<string, { helpful: number; comment: string | null }>();

  constructor(rows: FakeSessionRow[]) {
    this.rows = rows;
  }

  /** ใช้ส่งให้ store เป็น MYSQL_POOL */
  asPool(): Pool {
    return this as unknown as Pool;
  }

  has(sessionId: string): boolean {
    return this.rows.some((row) => row.session_id === sessionId);
  }

  async query(rawSql: string, params: unknown[] = []): Promise<[unknown, undefined]> {
    const sql = rawSql.replace(/\s+/g, ' ').trim();

    if (sql.startsWith('INSERT INTO sessions')) {
      return [this.insertSession(sql, params), undefined];
    }
    if (sql.startsWith('DELETE FROM sessions')) {
      const matched = this.match(sql, params);
      for (const row of matched) {
        this.rows.splice(this.rows.indexOf(row), 1);
        this.feedback.delete(row.session_id);
      }
      return [{ affectedRows: matched.length }, undefined];
    }
    if (sql.startsWith('SELECT') && sql.includes('FROM sessions')) {
      const matched = this.match(sql, params);
      if (sql.startsWith('SELECT user_id')) {
        return [matched.map((row) => ({ user_id: row.user_id })), undefined];
      }
      return [
        matched.map((row) => ({
          session_id: row.session_id,
          graph_id: row.graph_id,
          current_node_id: row.current_node_id,
          variables: row.variables,
          confidence: row.confidence,
          model_selection: row.model_selection,
          outcome_text: row.outcome_text,
          created_epoch: row.created_epoch,
        })),
        undefined,
      ];
    }
    if (sql.startsWith('SELECT') && sql.includes('FROM session_history')) {
      return [[], undefined];
    }
    if (sql.startsWith('SELECT') && sql.includes('FROM session_feedback')) {
      const found = this.feedback.get(String(params[0]));
      return [found ? [found] : [], undefined];
    }
    if (sql.startsWith('INSERT INTO session_feedback')) {
      const [sessionId, helpful, comment] = params as [string, number, string | null];
      this.feedback.set(sessionId, { helpful, comment });
      return [{ affectedRows: 1 }, undefined];
    }

    throw new Error(`FakeSessionsPool ไม่รองรับคำสั่งนี้: ${sql}`);
  }

  /** แถวที่ตรงกับเงื่อนไขใน WHERE ตามที่ปรากฏในข้อความ SQL */
  private match(sql: string, params: unknown[]): FakeSessionRow[] {
    const where = (sql.split(' WHERE ')[1] ?? '').split(/ ORDER BY | LIMIT /)[0];

    // พารามิเตอร์ของเงื่อนไข "คอลัมน์ = ?" ใช้ตามลำดับที่ปรากฏ (LIMIT ? ท้ายสุดไม่นับ)
    const equals: Array<{ column: 'session_id' | 'user_id' | 'client_id'; value: unknown }> = [];
    let next = 0;
    for (const m of where.matchAll(/\b(session_id|user_id|client_id) = \?/g)) {
      equals.push({ column: m[1] as 'session_id' | 'user_id' | 'client_id', value: params[next] });
      next += 1;
    }

    return this.rows.filter((row) => {
      if (!equals.every((cond) => row[cond.column] === cond.value)) return false;
      if (where.includes('user_id IS NULL') && row.user_id !== null) return false;
      if (where.includes("status = 'completed'") && row.status !== 'completed') return false;
      if (where.includes('expires_at > NOW()') && row.expired) return false;
      return true;
    });
  }

  private insertSession(sql: string, params: unknown[]): { affectedRows: number } {
    const columns = /\(([^)]+)\) VALUES/.exec(sql)?.[1].split(',').map((c) => c.trim()) ?? [];
    const values = new Map<string, unknown>();
    columns.forEach((column, index) => values.set(column, params[index]));

    this.rows.push(
      makeSessionRow({
        session_id: values.get('session_id') as string,
        graph_id: values.get('graph_id') as string,
        current_node_id: values.get('current_node_id') as string,
        status: values.get('status') as 'in_progress' | 'completed',
        user_id: (values.get('user_id') as string | null | undefined) ?? null,
        client_id: (values.get('client_id') as string | null | undefined) ?? null,
      }),
    );
    return { affectedRows: 1 };
  }
}
