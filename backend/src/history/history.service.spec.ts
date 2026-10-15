/**
 * ทดสอบ HistoryService ร่วมกับ HistoryStore จริง โดยใช้ pool ปลอม (ตารางในหน่วยความจำ)
 *
 * pool ปลอมทำตามเงื่อนไข WHERE ที่ "เขียนอยู่ใน SQL จริง" เท่านั้น (client_id, status='completed',
 * expires_at > NOW()) ถ้า SQL ใน history.store.ts ลืมเงื่อนไขใด เทสต์ความเป็นเจ้าของ/หมดอายุจะล้มทันที
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { GraphRepository, ManualSummary } from '../traversal/graph.repository';
import type { TroubleshootingGraph, TroubleshootingNode } from '../traversal-engine/types';
import { DEFAULT_PAGE_SIZE } from './history.dto';
import type { HistoryQuery } from './history.dto';
import { HistoryNotFoundError, HistoryService } from './history.service';
import { HistoryStore } from './history.store';

// ============================================================
// ผังตัวอย่าง
// ============================================================

const SERVICE_CENTER_TEXT = 'ไม่พบสาเหตุที่ตรงกับคู่มือ แนะนำให้ติดต่อศูนย์บริการ';

function acGraph(overrides: Partial<TroubleshootingGraph> = {}): TroubleshootingGraph {
  const nodes: TroubleshootingNode[] = [
    { node_id: 'n_q1', type: 'checkpoint', question: 'เครื่องเปิดติดไหม', on_yes: 'n_safe', on_no: 'n_q2' },
    {
      node_id: 'n_safe',
      type: 'instruction',
      content: 'ถอดปลั๊กแล้วทำความสะอาดแผ่นกรอง',
      next: 'n_fixed',
      safety_critical: true,
      safety_warning: 'ถอดปลั๊กไฟก่อนทำความสะอาด',
    },
    { node_id: 'n_q2', type: 'checkpoint', question: 'มีเสียงดังผิดปกติไหม', on_yes: 'n_normal', on_no: 'n_q3' },
    { node_id: 'n_q3', type: 'checkpoint', question: 'มีน้ำหยดไหม', on_yes: 'n_informed', on_no: 'n_unknown' },
    { node_id: 'n_fixed', type: 'resolution', content: 'แก้ได้แล้ว', outcome_kind: 'user_fixed' },
    { node_id: 'n_normal', type: 'resolution', content: 'ทำงานปกติ', outcome_kind: 'normal_behavior' },
    { node_id: 'n_informed', type: 'escalation', content: 'แจ้งช่างพร้อมข้อมูล', outcome_kind: 'handoff_informed' },
    { node_id: 'n_unknown', type: 'escalation', content: SERVICE_CENTER_TEXT, outcome_kind: 'handoff_unknown' },
  ];
  return {
    schema_version: 2,
    graph_id: 'g_ac',
    manual_id: 'm_ac',
    device_category: 'Air Conditioner',
    brand: 'Samsung',
    model_pattern: 'AR70H',
    entry_symptom: 'Not cooling',
    entry_symptom_th: 'แอร์ไม่เย็น',
    source: 'AR70H-manual.pdf',
    page_range: [12, 14],
    source_chunk_id: 'c1',
    entry_node: 'n_q1',
    nodes,
    ...overrides,
  };
}

function tvGraph(): TroubleshootingGraph {
  return {
    schema_version: 2,
    graph_id: 'g_tv',
    manual_id: 'm_tv',
    device_category: 'Television',
    brand: 'LG',
    model_pattern: 'OLED55',
    entry_symptom: 'No picture',
    entry_symptom_th: 'ไม่มีภาพ',
    source: 'OLED55-manual.pdf',
    page_range: [5, 5],
    source_chunk_id: 'c2',
    entry_node: 't_q1',
    nodes: [
      { node_id: 't_q1', type: 'checkpoint', question: 'ไฟสถานะติดไหม', on_yes: 't_fixed', on_no: 't_fixed' },
      { node_id: 't_fixed', type: 'resolution', content: 'แก้ได้แล้ว', outcome_kind: 'user_fixed' },
    ],
  };
}

function fakeGraphRepository(graphs: TroubleshootingGraph[]): GraphRepository {
  const byId = new Map(graphs.map((g) => [g.graph_id, g]));
  const manuals: ManualSummary[] = graphs.map((g) => ({
    manualId: g.manual_id,
    deviceCategory: g.device_category,
    brand: g.brand,
    modelPattern: g.model_pattern,
    displayName: g.manual_id === 'm_ac' ? 'Samsung AR70H ห้องนอน' : undefined,
    graphCount: 1,
  }));
  return {
    findById: (id: string) => byId.get(id),
    listManuals: () => manuals,
  } as unknown as GraphRepository;
}

// ============================================================
// pool ปลอม
// ============================================================

/**
 * คอลัมน์ของ session_feedback ตามที่ migration 009 สร้างจริง (อ่านจากไฟล์ .sql)
 * pool ปลอมเทียบชื่อคอลัมน์ใน SQL ของ HistoryStore กับรายการนี้ ถ้าตั้งชื่อไม่ตรงกับ migration เทสต์จะล้ม
 */
const MIGRATION_009 = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '009_create_session_feedback.sql'),
  'utf8',
);

function migrationColumns(sql: string): string[] {
  const body = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS session_feedback ('));
  const names: string[] = [];
  for (const line of body.split(/\r?\n/).slice(1)) {
    if (/^\)/.test(line)) break;
    const match = /^\s{2}`?(\w+)`?\s+(CHAR|TINYINT|TEXT|VARCHAR|TIMESTAMP)\b/.exec(line);
    if (match) names.push(match[1]);
  }
  return names;
}

const FEEDBACK_COLUMNS = migrationColumns(MIGRATION_009);

function columnsOf(list: string): string[] {
  return list.split(',').map((c) => c.trim().replace(/`/g, ''));
}

function assertKnownColumns(columns: string[]): void {
  for (const column of columns) {
    if (!FEEDBACK_COLUMNS.includes(column)) {
      throw new Error(`คอลัมน์ '${column}' ไม่มีใน migration 009 (มี: ${FEEDBACK_COLUMNS.join(', ')})`);
    }
  }
}

interface FakeSession {
  session_id: string;
  graph_id: string;
  current_node_id: string;
  status: 'in_progress' | 'completed';
  variables: Record<string, string>;
  confidence: string | null;
  model_selection: 'selected' | 'unknown' | null;
  outcome_text: string | null;
  created_epoch: number;
  client_id: string | null;
  expired?: boolean;
}

interface FakeStep {
  node_id: string;
  action_type: 'answer' | 'continue' | 'confirm_safety' | 'input';
  action_value: string | null;
}

class FakePool {
  sessions: FakeSession[] = [];
  steps = new Map<string, FakeStep[]>();
  /** แถวของ session_feedback ตามชื่อคอลัมน์ใน migration */
  feedback = new Map<string, Record<string, unknown>>();
  /** SQL ของ INSERT ล่าสุดที่เข้า session_feedback (ไว้เช็กวิธีเขียน) */
  lastFeedbackInsert: { sql: string; params: unknown[] } | undefined;

  async query(rawSql: string, params: unknown[] = []): Promise<[unknown]> {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    const needsCompleted = sql.includes("status = 'completed'");
    const needsLive = sql.includes('expires_at > NOW()');
    const visible = (s: FakeSession) =>
      (!needsCompleted || s.status === 'completed') && (!needsLive || !s.expired);

    if (sql.startsWith('SELECT') && sql.includes('FROM sessions') && sql.includes('ORDER BY created_at DESC')) {
      const [clientId, limit] = params as [string, number];
      const rows = this.sessions
        .filter((s) => s.client_id === clientId && visible(s))
        .sort((a, b) => b.created_epoch - a.created_epoch)
        .slice(0, limit);
      return [rows];
    }

    if (sql.startsWith('SELECT') && sql.includes('FROM sessions WHERE session_id = ?')) {
      const [sessionId, clientId] = params as [string, string];
      return [this.sessions.filter((s) => s.session_id === sessionId && s.client_id === clientId && visible(s))];
    }

    if (sql.startsWith('SELECT') && sql.includes('FROM session_history')) {
      return [this.steps.get(params[0] as string) ?? []];
    }

    if (sql.startsWith('DELETE FROM sessions')) {
      const [sessionId, clientId] = params as [string, string];
      const target = this.sessions.find((s) => s.session_id === sessionId && s.client_id === clientId && visible(s));
      if (!target) return [{ affectedRows: 0 }];
      this.sessions = this.sessions.filter((s) => s !== target);
      this.steps.delete(sessionId);
      this.feedback.delete(sessionId); // ON DELETE CASCADE
      return [{ affectedRows: 1 }];
    }

    if (sql.startsWith('INSERT INTO session_feedback')) {
      this.lastFeedbackInsert = { sql, params };
      const columns = columnsOf(/INSERT INTO session_feedback \(([^)]*)\)/.exec(sql)![1]);
      assertKnownColumns(columns);
      const [first] = params as [string];
      const row: Record<string, unknown> = { ...(this.feedback.get(first) ?? {}) };
      columns.forEach((column, index) => {
        row[column] = params[index];
      });
      this.feedback.set(first, row);
      return [{ affectedRows: 1 }];
    }

    if (sql.startsWith('SELECT') && sql.includes('FROM session_feedback')) {
      const columns = columnsOf(/^SELECT (.*?) FROM session_feedback/.exec(sql)![1]);
      assertKnownColumns(columns);
      const found = this.feedback.get(params[0] as string);
      if (!found) return [[]];
      return [[Object.fromEntries(columns.map((column) => [column, found[column] ?? null]))]];
    }

    throw new Error(`pool ปลอมไม่รู้จัก SQL: ${sql}`);
  }
}

// ============================================================
// ตัวช่วยสร้างข้อมูล
// ============================================================

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const DAY = 86_400;
const T0 = 1_760_000_000; // เวลาตั้งต้นของเทสต์ (วินาที)

const PATHS: Record<string, { final: string; steps: FakeStep[] }> = {
  fixed: {
    final: 'n_fixed',
    steps: [
      { node_id: 'n_q1', action_type: 'answer', action_value: 'yes' },
      { node_id: 'n_safe', action_type: 'confirm_safety', action_value: null },
    ],
  },
  normal: {
    final: 'n_normal',
    steps: [
      { node_id: 'n_q1', action_type: 'answer', action_value: 'no' },
      { node_id: 'n_q2', action_type: 'answer', action_value: 'yes' },
    ],
  },
  informed: {
    final: 'n_informed',
    steps: [
      { node_id: 'n_q1', action_type: 'answer', action_value: 'no' },
      { node_id: 'n_q2', action_type: 'answer', action_value: 'no' },
      { node_id: 'n_q3', action_type: 'answer', action_value: 'yes' },
    ],
  },
  unknown: {
    final: 'n_unknown',
    steps: [
      { node_id: 'n_q1', action_type: 'answer', action_value: 'no' },
      { node_id: 'n_q2', action_type: 'answer', action_value: 'no' },
      { node_id: 'n_q3', action_type: 'answer', action_value: 'no' },
    ],
  },
};

interface Harness {
  pool: FakePool;
  service: HistoryService;
}

function build(graphs: TroubleshootingGraph[] = [acGraph(), tvGraph()]): Harness {
  const pool = new FakePool();
  const store = new HistoryStore(pool as never);
  const service = new HistoryService(store, fakeGraphRepository(graphs));
  return { pool, service };
}

function addSession(h: Harness, id: string, overrides: Partial<FakeSession> = {}, path = PATHS.fixed): FakeSession {
  const session: FakeSession = {
    session_id: id,
    graph_id: 'g_ac',
    current_node_id: path.final,
    status: 'completed',
    variables: {},
    confidence: null,
    model_selection: null,
    outcome_text: null,
    created_epoch: T0,
    client_id: ME,
    ...overrides,
  };
  h.pool.sessions.push(session);
  h.pool.steps.set(id, path.steps);
  return session;
}

function query(overrides: Partial<HistoryQuery> = {}): HistoryQuery {
  return { sort: 'newest', page: 1, pageSize: DEFAULT_PAGE_SIZE, ...overrides };
}

// ============================================================
// รายการ
// ============================================================

describe('HistoryService.list', () => {
  it('คืนเฉพาะ session ที่จบแล้ว ยังไม่หมดอายุ และเป็นของ client นี้', async () => {
    const h = build();
    addSession(h, 'mine');
    addSession(h, 'others', { client_id: OTHER });
    addSession(h, 'unfinished', { status: 'in_progress' });
    addSession(h, 'expired', { expired: true });
    addSession(h, 'no-owner', { client_id: null });

    const result = await h.service.list(ME, query());

    expect(result.items.map((i) => i.sessionId)).toEqual(['mine']);
    expect(result.total).toBe(1);
  });

  it('outcomeKind มาจากโหนดสุดท้ายของผัง ครบทั้ง 4 ชนิด', async () => {
    const h = build();
    addSession(h, 's-fixed', { created_epoch: T0 + 1 }, PATHS.fixed);
    addSession(h, 's-normal', { created_epoch: T0 + 2 }, PATHS.normal);
    addSession(h, 's-informed', { created_epoch: T0 + 3 }, PATHS.informed);
    addSession(h, 's-unknown', { created_epoch: T0 + 4 }, PATHS.unknown);

    const result = await h.service.list(ME, query());
    const kindOf = Object.fromEntries(result.items.map((i) => [i.sessionId, i.outcomeKind]));

    expect(kindOf).toEqual({
      's-fixed': 'user_fixed',
      's-normal': 'normal_behavior',
      's-informed': 'handoff_informed',
      's-unknown': 'handoff_unknown',
    });
  });

  it('แถวมีข้อมูลผัง: ชื่ออาการ ยี่ห้อ รุ่น และ displayName', async () => {
    const h = build();
    addSession(h, 's1');

    const [item] = (await h.service.list(ME, query())).items;

    expect(item.graph).toEqual({
      manualId: 'm_ac',
      entrySymptom: 'Not cooling',
      entrySymptomTh: 'แอร์ไม่เย็น',
      deviceCategory: 'Air Conditioner',
      brand: 'Samsung',
      modelPattern: 'AR70H',
      displayName: 'Samsung AR70H ห้องนอน',
    });
    expect(item.startedAt).toBe(new Date(T0 * 1000).toISOString());
  });

  it('ผังหายไป: ไม่ทำให้ทั้งรายการล้ม แถวนั้น graph/outcomeKind เป็น null', async () => {
    const h = build();
    addSession(h, 'ok', { created_epoch: T0 + 1 });
    addSession(h, 'orphan', { graph_id: 'g_deleted', created_epoch: T0 + 2 });

    const result = await h.service.list(ME, query());

    expect(result.items.map((i) => i.sessionId)).toEqual(['orphan', 'ok']);
    const orphan = result.items[0];
    expect(orphan.graph).toBeNull();
    expect(orphan.outcomeKind).toBeNull();
    expect(orphan.graphId).toBe('g_deleted');
  });

  it('โหนดสุดท้ายหายไปจากผัง (seed ใหม่): outcomeKind เป็น null แต่ยังมีข้อมูลผัง', async () => {
    const h = build();
    addSession(h, 'stale', { current_node_id: 'n_old_removed' });

    const [item] = (await h.service.list(ME, query())).items;

    expect(item.outcomeKind).toBeNull();
    expect(item.graph?.brand).toBe('Samsung');
  });

  it('โหนดสุดท้ายไม่ใช่โหนดสิ้นสุดแล้ว (ผังถูกเปลี่ยนชนิดโหนด): outcomeKind เป็น null', async () => {
    const h = build();
    addSession(h, 'changed', { current_node_id: 'n_q1' });

    const [item] = (await h.service.list(ME, query())).items;

    expect(item.outcomeKind).toBeNull();
  });

  it('กรองตามประเภท ยี่ห้อ (ไม่สนตัวพิมพ์) และสถานะ', async () => {
    const h = build();
    addSession(h, 'ac-fixed', { created_epoch: T0 + 1 }, PATHS.fixed);
    addSession(h, 'ac-unknown', { created_epoch: T0 + 2 }, PATHS.unknown);
    addSession(h, 'tv', { graph_id: 'g_tv', current_node_id: 't_fixed', created_epoch: T0 + 3 }, { final: 't_fixed', steps: [{ node_id: 't_q1', action_type: 'answer', action_value: 'yes' }] });

    const byCategory = await h.service.list(ME, query({ category: 'Television' }));
    expect(byCategory.items.map((i) => i.sessionId)).toEqual(['tv']);

    const byBrand = await h.service.list(ME, query({ brand: 'samsung' }));
    expect(byBrand.items.map((i) => i.sessionId).sort()).toEqual(['ac-fixed', 'ac-unknown']);

    const byStatus = await h.service.list(ME, query({ status: 'handoff_unknown' }));
    expect(byStatus.items.map((i) => i.sessionId)).toEqual(['ac-unknown']);
  });

  it('ตัวเลือกตัวกรอง (facets) นับจากประวัติทั้งหมด ไม่ขึ้นกับตัวกรองที่เลือก', async () => {
    const h = build();
    addSession(h, 'ac', { created_epoch: T0 + 1 });
    addSession(h, 'tv', { graph_id: 'g_tv', current_node_id: 't_fixed', created_epoch: T0 + 2 }, { final: 't_fixed', steps: [{ node_id: 't_q1', action_type: 'answer', action_value: 'yes' }] });

    const result = await h.service.list(ME, query({ category: 'Television' }));

    expect(result.facets.categories).toEqual(['Air Conditioner', 'Television']);
    expect(result.facets.brands).toEqual(['LG', 'Samsung']);
  });

  it('ค้นหาด้วยข้อความ: ทุกคำต้องอยู่ในชื่ออาการ/ยี่ห้อ/รุ่น (ไม่สนตัวพิมพ์)', async () => {
    const h = build();
    addSession(h, 'ac', { created_epoch: T0 + 1 });
    addSession(h, 'tv', { graph_id: 'g_tv', current_node_id: 't_fixed', created_epoch: T0 + 2 }, { final: 't_fixed', steps: [{ node_id: 't_q1', action_type: 'answer', action_value: 'yes' }] });

    expect((await h.service.list(ME, query({ q: 'แอร์' }))).items.map((i) => i.sessionId)).toEqual(['ac']);
    expect((await h.service.list(ME, query({ q: 'samsung ar70h' }))).items.map((i) => i.sessionId)).toEqual(['ac']);
    expect((await h.service.list(ME, query({ q: 'oled' }))).items.map((i) => i.sessionId)).toEqual(['tv']);
    expect((await h.service.list(ME, query({ q: 'samsung oled' }))).items).toEqual([]);
  });

  it('เรียงตามวันที่ ใหม่สุดก่อน/เก่าสุดก่อน', async () => {
    const h = build();
    addSession(h, 'old', { created_epoch: T0 });
    addSession(h, 'mid', { created_epoch: T0 + DAY });
    addSession(h, 'new', { created_epoch: T0 + 2 * DAY });

    expect((await h.service.list(ME, query({ sort: 'newest' }))).items.map((i) => i.sessionId)).toEqual(['new', 'mid', 'old']);
    expect((await h.service.list(ME, query({ sort: 'oldest' }))).items.map((i) => i.sessionId)).toEqual(['old', 'mid', 'new']);
  });

  it('แบ่งหน้า และดึงหน้าที่เกินกลับมาหน้าสุดท้าย', async () => {
    const h = build();
    for (let i = 0; i < 5; i += 1) addSession(h, `s${i}`, { created_epoch: T0 + i });

    const first = await h.service.list(ME, query({ pageSize: 2, page: 1 }));
    expect(first.items.map((i) => i.sessionId)).toEqual(['s4', 's3']);
    expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2, totalPages: 3 });

    const beyond = await h.service.list(ME, query({ pageSize: 2, page: 99 }));
    expect(beyond.page).toBe(3);
    expect(beyond.items.map((i) => i.sessionId)).toEqual(['s0']);
  });

  it('ไม่มีประวัติ: รายการว่าง totalPages อย่างน้อย 1', async () => {
    const h = build();

    const result = await h.service.list(ME, query());

    expect(result).toMatchObject({ items: [], total: 0, page: 1, totalPages: 1 });
    expect(result.facets).toEqual({ categories: [], brands: [] });
  });

  it('แถวที่ผังหายไม่ตรงตัวกรองสถานะ/ประเภท แต่ปรากฏเมื่อไม่กรอง', async () => {
    const h = build();
    addSession(h, 'orphan', { graph_id: 'g_deleted' });

    expect((await h.service.list(ME, query())).total).toBe(1);
    expect((await h.service.list(ME, query({ status: 'user_fixed' }))).total).toBe(0);
    expect((await h.service.list(ME, query({ category: 'Air Conditioner' }))).total).toBe(0);
  });
});

// ============================================================
// รายละเอียด
// ============================================================

describe('HistoryService.detail', () => {
  it('ส่งขั้นตอนที่ผ่านมา โหนดสุดท้าย แหล่งอ้างอิง และข้อความผลลัพธ์ของผู้ใช้', async () => {
    const h = build();
    addSession(h, 's1', { confidence: '0.812', model_selection: 'selected', outcome_text: 'แอร์เย็นแล้ว' });

    const detail = await h.service.detail(ME, 's1');

    expect(detail.available).toBe(true);
    expect(detail.outcomeKind).toBe('user_fixed');
    expect(detail.steps.map((s) => s.node.nodeId)).toEqual(['n_q1', 'n_safe']);
    expect(detail.steps[0].action).toEqual({ type: 'answer', value: 'yes' });
    expect(detail.steps[1].action).toEqual({ type: 'confirm_safety' });
    expect(detail.finalNode?.nodeId).toBe('n_fixed');
    expect(detail.reference).toEqual({ source: 'AR70H-manual.pdf', pageRange: [12, 14] });
    expect(detail.outcome).toBe('แอร์เย็นแล้ว');
    expect(detail.graphId).toBe('g_ac');
    expect(detail.graph?.manualId).toBe('m_ac');
  });

  it('confidence: DECIMAL (ข้อความ) → ตัวเลข · NULL คงเป็น null ไม่กลายเป็น 0', async () => {
    const h = build();
    addSession(h, 'with-score', { confidence: '0.812' });
    addSession(h, 'no-score', { confidence: null });

    expect((await h.service.detail(ME, 'with-score')).confidence).toBe(0.812);
    expect((await h.service.detail(ME, 'no-score')).confidence).toBeNull();
  });

  it('modelSelection: NULL ส่งเป็น null (ไม่เติมเป็น selected) · unknown คงเดิม', async () => {
    const h = build();
    addSession(h, 'null-sel', { model_selection: null });
    addSession(h, 'unknown-sel', { model_selection: 'unknown' });

    expect((await h.service.detail(ME, 'null-sel')).modelSelection).toBeNull();
    expect((await h.service.detail(ME, 'unknown-sel')).modelSelection).toBe('unknown');
  });

  it('handoff_unknown: ใช้ข้อความของโหนดสุดท้ายตรงๆ (คำแนะนำศูนย์บริการจากผัง)', async () => {
    const h = build();
    addSession(h, 's1', {}, PATHS.unknown);

    const detail = await h.service.detail(ME, 's1');

    expect(detail.outcomeKind).toBe('handoff_unknown');
    expect(detail.finalNode?.text).toBe(SERVICE_CENTER_TEXT);
  });

  it('คำเตือนความปลอดภัย: รวมจากโหนดที่ผ่านตามลำดับ ไม่ซ้ำ · ไม่มี = อาร์เรย์ว่าง', async () => {
    const h = build();
    addSession(h, 'with-warning', {}, PATHS.fixed);
    addSession(h, 'without-warning', {}, PATHS.normal);

    expect((await h.service.detail(ME, 'with-warning')).safetyWarnings).toEqual(['ถอดปลั๊กไฟก่อนทำความสะอาด']);
    expect((await h.service.detail(ME, 'without-warning')).safetyWarnings).toEqual([]);
  });

  it('ไม่ใช่ของ client นี้ / ยังไม่จบ / หมดอายุ / ไม่มี id นี้ → HistoryNotFoundError', async () => {
    const h = build();
    addSession(h, 'others', { client_id: OTHER });
    addSession(h, 'unfinished', { status: 'in_progress' });
    addSession(h, 'expired', { expired: true });

    for (const id of ['others', 'unfinished', 'expired', 'does-not-exist']) {
      await expect(h.service.detail(ME, id)).rejects.toBeInstanceOf(HistoryNotFoundError);
    }
  });

  it('ผังถูกลบ: ตอบ available=false ไม่โยน error และยังเห็นข้อความที่ผู้ใช้บันทึกเอง', async () => {
    const h = build();
    addSession(h, 's1', { graph_id: 'g_deleted', outcome_text: 'บันทึกไว้เอง' });

    const detail = await h.service.detail(ME, 's1');

    expect(detail).toMatchObject({
      available: false,
      graph: null,
      outcomeKind: null,
      steps: [],
      finalNode: null,
      reference: null,
      safetyWarnings: [],
      outcome: 'บันทึกไว้เอง',
    });
  });

  it('โหนดที่เคยผ่านหายไปจากผัง: available=false (ไม่ใช่ 500)', async () => {
    const h = build();
    addSession(h, 's1', {}, {
      final: 'n_fixed',
      steps: [
        { node_id: 'n_q1', action_type: 'answer', action_value: 'yes' },
        { node_id: 'n_removed', action_type: 'continue', action_value: null },
      ],
    });

    const detail = await h.service.detail(ME, 's1');

    expect(detail.available).toBe(false);
    expect(detail.steps).toEqual([]);
  });

  it('ทางเดินของผังถูกแก้ (ขั้นเดิมไปไม่ถึงโหนดสุดท้ายเดิม): available=false ไม่โชว์ขั้นเก่าคู่ข้อสรุปใหม่', async () => {
    // ผังใหม่: n_q1 ตอบ "ใช่" ไปที่ n_normal แทน n_safe
    const edited = acGraph();
    edited.nodes = edited.nodes.map((node) =>
      node.node_id === 'n_q1' && node.type === 'checkpoint' ? { ...node, on_yes: 'n_normal' } : node,
    );
    const h = build([edited, tvGraph()]);
    addSession(h, 's1', {}, PATHS.fixed); // บันทึกไว้ว่า q1 yes → n_safe → n_fixed

    const detail = await h.service.detail(ME, 's1');

    expect(detail.available).toBe(false);
  });

  it('ผังเปลี่ยนให้ขั้นนั้นต้องยืนยันความปลอดภัย (action เดิมใช้ไม่ได้แล้ว): available=false', async () => {
    const h = build();
    // บันทึกไว้ว่ากด continue ที่ n_safe ซึ่งปัจจุบัน safety_critical ต้อง confirm_safety
    addSession(h, 's1', {}, {
      final: 'n_fixed',
      steps: [
        { node_id: 'n_q1', action_type: 'answer', action_value: 'yes' },
        { node_id: 'n_safe', action_type: 'continue', action_value: null },
      ],
    });

    expect((await h.service.detail(ME, 's1')).available).toBe(false);
  });

  it('โหนดสุดท้ายไม่ใช่โหนดสิ้นสุดแล้ว: available=false', async () => {
    const h = build();
    addSession(h, 's1', { current_node_id: 'n_q1' }, { final: 'n_q1', steps: [] });

    expect((await h.service.detail(ME, 's1')).available).toBe(false);
  });
});

// ============================================================
// ลบ
// ============================================================

describe('HistoryService.remove', () => {
  it('เจ้าของลบได้ และหลังลบเปิดดูไม่ได้ (ข้อมูลที่ผูกอยู่ถูกลบด้วย)', async () => {
    const h = build();
    addSession(h, 's1');
    h.pool.feedback.set('s1', { helpful: 1, comment: null });

    await h.service.remove(ME, 's1');

    await expect(h.service.detail(ME, 's1')).rejects.toBeInstanceOf(HistoryNotFoundError);
    expect(h.pool.feedback.has('s1')).toBe(false);
    expect(h.pool.steps.has('s1')).toBe(false);
  });

  it('ไม่ใช่เจ้าของ: HistoryNotFoundError และ session ยังอยู่', async () => {
    const h = build();
    addSession(h, 's1');

    await expect(h.service.remove(OTHER, 's1')).rejects.toBeInstanceOf(HistoryNotFoundError);

    expect(h.pool.sessions.map((s) => s.session_id)).toEqual(['s1']);
  });

  it('session ที่ยังไม่จบลบผ่านหน้าประวัติไม่ได้', async () => {
    const h = build();
    addSession(h, 's1', { status: 'in_progress' });

    await expect(h.service.remove(ME, 's1')).rejects.toBeInstanceOf(HistoryNotFoundError);

    expect(h.pool.sessions).toHaveLength(1);
  });

  it('ลบซ้ำครั้งที่สอง: HistoryNotFoundError', async () => {
    const h = build();
    addSession(h, 's1');

    await h.service.remove(ME, 's1');

    await expect(h.service.remove(ME, 's1')).rejects.toBeInstanceOf(HistoryNotFoundError);
  });
});

// ============================================================
// ให้คะแนน
// ============================================================

describe('HistoryService.saveFeedback', () => {
  it('บันทึกแล้วรายละเอียดส่งกลับมา · ส่งซ้ำ = แก้ค่าเดิม', async () => {
    const h = build();
    addSession(h, 's1');

    expect((await h.service.detail(ME, 's1')).feedback).toBeNull();

    await h.service.saveFeedback(ME, 's1', { helpful: true, comment: 'ใช้ได้ผล' });
    expect((await h.service.detail(ME, 's1')).feedback).toEqual({ helpful: true, comment: 'ใช้ได้ผล' });

    await h.service.saveFeedback(ME, 's1', { helpful: false, comment: null });
    expect((await h.service.detail(ME, 's1')).feedback).toEqual({ helpful: false, comment: null });
  });

  it('👍 โดยไม่มีข้อความ: เขียน comment เป็น NULL (ไม่ใช่สตริงว่าง) และ helpful เป็น 1', async () => {
    const h = build();
    addSession(h, 's1');

    await h.service.saveFeedback(ME, 's1', { helpful: true, comment: null });

    expect(h.pool.feedback.get('s1')).toMatchObject({ helpful: 1, comment: null });
    expect((await h.service.detail(ME, 's1')).feedback).toEqual({ helpful: true, comment: null });
  });

  it('👎 พร้อมข้อความ: เขียนลงคอลัมน์ comment ตามลำดับที่ migration กำหนด (helpful = 0)', async () => {
    const h = build();
    addSession(h, 's1');

    await h.service.saveFeedback(ME, 's1', { helpful: false, comment: 'ทำตามแล้วยังไม่หาย' });

    expect(h.pool.lastFeedbackInsert?.sql).toContain('`comment`');
    expect(h.pool.lastFeedbackInsert?.params).toEqual(['s1', 0, 'ทำตามแล้วยังไม่หาย']);
    expect((await h.service.detail(ME, 's1')).feedback).toEqual({ helpful: false, comment: 'ทำตามแล้วยังไม่หาย' });
  });

  it('ส่งซ้ำโดยไม่มีข้อความ: ล้างข้อความเดิมเป็น NULL (แทนที่ทั้งชุด)', async () => {
    const h = build();
    addSession(h, 's1');

    await h.service.saveFeedback(ME, 's1', { helpful: true, comment: 'ดีมาก' });
    await h.service.saveFeedback(ME, 's1', { helpful: true, comment: null });

    expect((await h.service.detail(ME, 's1')).feedback).toEqual({ helpful: true, comment: null });
  });

  it('ไม่ใช่เจ้าของ: HistoryNotFoundError และไม่มีอะไรถูกบันทึก', async () => {
    const h = build();
    addSession(h, 's1');

    await expect(
      h.service.saveFeedback(OTHER, 's1', { helpful: true, comment: null }),
    ).rejects.toBeInstanceOf(HistoryNotFoundError);

    expect(h.pool.feedback.size).toBe(0);
  });
});

describe('migration 009', () => {
  it('คอลัมน์ comment เป็น TEXT NULL และมีครบทุกคอลัมน์ที่ store ใช้', () => {
    expect(FEEDBACK_COLUMNS).toEqual(expect.arrayContaining(['session_id', 'helpful', 'comment']));
    expect(MIGRATION_009).toMatch(/`comment`\s+TEXT\s+NULL/);
  });

  it('helpful เป็น NOT NULL และ session_id เป็น PRIMARY KEY (1 session 1 คะแนน)', () => {
    expect(MIGRATION_009).toMatch(/helpful\s+TINYINT\(1\)\s+NOT NULL/);
    expect(MIGRATION_009).toMatch(/PRIMARY KEY \(session_id\)/);
  });
});
