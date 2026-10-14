/**
 * traversal.service.rephrase.spec.ts — เทสการเชื่อม LLM เรียบเรียงถ้อยคำเข้ากับ TraversalService
 *
 * สิ่งที่ต้องพิสูจน์ (TOR §3 ข้อ 3: LLM ไม่มีสิทธิ์ตัดสินว่าขั้นตอนถัดไปคืออะไร):
 *   1. เปิด/ปิด/พัง/ช้า/ถูกปฏิเสธ → ลำดับ nodeId ของทุกเส้นทางของทุกผัง "เหมือนกันทุกตัว"
 *   2. โหนดความปลอดภัยและโหนดสิ้นสุด ไม่มี displayText เสมอ (ใช้ข้อความต้นฉบับจากคู่มือ)
 *   3. ทุกความผิดพลาดของ LLM → fallback: displayText = null และระบบทำงานต่อได้
 * ใช้ข้อมูลผังแอร์จริง 13 ผัง และของปลอมแบบเดียวกับ traversal.service.spec.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import { TraversalService } from './traversal.service';
import { RephraseService, type LlmClient } from '../rephrase/rephrase.service';
import type { GraphRepository } from './graph.repository';
import type { EquipmentRepository } from './equipment.repository';
import type { SessionStore } from './session.store';
import type { SymptomSearchService } from '../symptom-search/symptom-search.service';
import type { SessionResponseDto } from './traversal.dto';
import type { SessionState, TraversalAction, TroubleshootingGraph } from '../traversal-engine/types';

const manual = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../data/manuals/samsung_ac_ar70h.json'), 'utf-8'),
) as { graphs: TroubleshootingGraph[] };

class FakeGraphRepository {
  private readonly graphs = new Map(manual.graphs.map((g) => [g.graph_id, g]));
  findById(id: string) { return this.graphs.get(id); }
  listAll() { return []; }
}
class FakeEquipmentRepository {
  findByCategory() { return []; }
}
class FakeSessionStore {
  readonly sessions = new Map<string, SessionState>();
  async create(s: SessionState) { this.sessions.set(s.sessionId, s); }
  async find(id: string) { return this.sessions.get(id); }
  async update(s: SessionState) { this.sessions.set(s.sessionId, s); }
  async delete(id: string) { this.sessions.delete(id); }
  async saveOutcome() { return false; }
  async findOutcome() { return null; }
}
const noSearch = { scoreGraph: async () => null };

function makeService(rephrase?: RephraseService): { service: TraversalService; store: FakeSessionStore } {
  const store = new FakeSessionStore();
  const service = new TraversalService(
    new FakeGraphRepository() as unknown as GraphRepository,
    new FakeEquipmentRepository() as unknown as EquipmentRepository,
    store as unknown as SessionStore,
    noSearch as unknown as SymptomSearchService,
    rephrase,
  );
  return { service, store };
}

const llm = (impl: (t: string, s: AbortSignal) => Promise<string>): LlmClient => ({ rephrase: impl });
/** LLM ปลอมที่ "เรียบเรียง" โดยต่อท้ายคำสุภาพ — ผ่านด่านตรวจ (ตัวเลข/ชื่อเฉพาะ/คำปฏิเสธคงเดิม) */
const politeLlm = llm(async (t) => `${t} นะครับ`);

/** เดินจนจบด้วยนโยบายเดียว บันทึกทุกคำตอบของเซิร์ฟเวอร์ */
async function walk(service: TraversalService, graphId: string, answer: 'yes' | 'no'): Promise<SessionResponseDto[]> {
  const out: SessionResponseDto[] = [];
  let res = await service.startSession(graphId);
  out.push(res);
  for (let i = 0; i < 80 && res.status !== 'completed'; i++) {
    const n = res.node;
    let action: TraversalAction;
    if (n.requiresSafetyConfirmation) action = { type: 'confirm_safety' };
    else if (n.type === 'checkpoint') action = { type: 'answer', value: answer };
    else if (n.type === 'input') action = { type: 'input', value: 'E1' };
    else action = { type: 'continue' };
    res = await service.submitAction(res.sessionId, action);
    out.push(res);
  }
  expect(res.status).toBe('completed');
  return out;
}

const idsOf = (rs: SessionResponseDto[]) => rs.map((r) => r.node.nodeId);

describe('TraversalService + RephraseService', () => {
  it('ไม่มี RephraseService (ค่าเริ่มต้น): ทุกคำตอบมี displayText = null', async () => {
    const { service } = makeService();
    for (const g of manual.graphs) {
      for (const r of await walk(service, g.graph_id, 'yes')) expect(r.displayText).toBeNull();
    }
  });

  it('RephraseService ปิดอยู่: displayText = null และไม่เรียก LLM', async () => {
    let calls = 0;
    const rephrase = new RephraseService(llm(async (t) => { calls++; return t; }), { enabled: false });
    const { service } = makeService(rephrase);
    const rs = await walk(service, manual.graphs[0].graph_id, 'yes');
    expect(rs.every((r) => r.displayText === null)).toBe(true);
    expect(calls).toBe(0);
  });

  it('เปิดอยู่: ลำดับ nodeId ของทุกเส้นทางของทุกผังเหมือนตอนปิดทุกตัว (LLM ไม่กระทบสถานะ)', async () => {
    let compared = 0;
    for (const g of manual.graphs) {
      for (const answer of ['yes', 'no'] as const) {
        const off = await walk(makeService().service, g.graph_id, answer);
        const on = await walk(makeService(new RephraseService(politeLlm, { enabled: true })).service, g.graph_id, answer);
        expect(idsOf(on)).toEqual(idsOf(off));
        expect(on.map((r) => r.status)).toEqual(off.map((r) => r.status));
        compared += on.length + off.length;
      }
    }
    expect(compared).toBeGreaterThan(150); // 13 ผัง × 2 นโยบาย × (ปิด+เปิด)
  });

  it('เปิดอยู่: โหนดความปลอดภัยและโหนดสิ้นสุดไม่มี displayText เสมอ ส่วนโหนดอื่นมี และต้นฉบับยังอยู่ใน node.text', async () => {
    const { service } = makeService(new RephraseService(politeLlm, { enabled: true }));
    let rephrased = 0;
    let safetyNodes = 0;
    let terminals = 0;
    for (const g of manual.graphs) {
      for (const r of await walk(service, g.graph_id, 'yes')) {
        const n = r.node;
        if (n.requiresSafetyConfirmation || n.safetyCritical) { safetyNodes++; expect(r.displayText).toBeNull(); }
        else if (n.isTerminal) { terminals++; expect(r.displayText).toBeNull(); }
        else if (r.displayText !== null) {
          rephrased++;
          expect(r.displayText).toBe(`${n.text} นะครับ`);
          expect(n.text).not.toContain('นะครับ'); // ต้นฉบับไม่ถูกแก้
        }
      }
    }
    expect(safetyNodes).toBeGreaterThan(0);
    expect(terminals).toBeGreaterThan(0);
    expect(rephrased).toBeGreaterThan(20);
  });

  it('LLM พังทุกครั้ง: fallback เป็นข้อความต้นฉบับ (displayText = null) และเดินจนจบได้', async () => {
    const boom = llm(async () => { throw new Error('HTTP 500'); });
    const { service } = makeService(new RephraseService(boom, { enabled: true }));
    for (const r of await walk(service, manual.graphs[0].graph_id, 'no')) expect(r.displayText).toBeNull();
  });

  it('LLM ช้าเกินเวลา: fallback และไม่ค้างทั้งระบบ', async () => {
    const slow = llm((t, signal) => new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve(`${t} นะครับ`), 2000);
      signal.addEventListener('abort', () => clearTimeout(timer));
    }));
    const { service } = makeService(new RephraseService(slow, { enabled: true, timeoutMs: 20 }));
    const started = Date.now();
    const rs = await walk(service, manual.graphs[0].graph_id, 'yes');
    expect(rs.every((r) => r.displayText === null)).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('LLM เปลี่ยนตัวเลข: ถูกด่านปฏิเสธ ไม่มีข้อความที่ตัวเลขผิดหลุดไปถึงผู้ใช้', async () => {
    const bumpDigits = llm(async (t) => t.replace(/\d+/g, (d) => String(Number(d) + 1)));
    const { service } = makeService(new RephraseService(bumpDigits, { enabled: true }));
    let withDigits = 0;
    for (const g of manual.graphs) {
      for (const r of await walk(service, g.graph_id, 'yes')) {
        if (/\d/.test(r.node.text)) { withDigits++; expect(r.displayText).toBeNull(); }
      }
    }
    expect(withDigits).toBeGreaterThan(0);
  });

  it('getSession ก็มี displayText ตามเดียวกัน และสถานะใน store ไม่เปลี่ยนเพราะการเรียบเรียง', async () => {
    const { service, store } = makeService(new RephraseService(politeLlm, { enabled: true }));
    const started = await service.startSession(manual.graphs[0].graph_id);
    const before = JSON.stringify(store.sessions.get(started.sessionId));
    const got = await service.getSession(started.sessionId);
    expect(got.displayText).toBe(started.displayText);
    expect(JSON.stringify(store.sessions.get(started.sessionId))).toBe(before);
  });
});
