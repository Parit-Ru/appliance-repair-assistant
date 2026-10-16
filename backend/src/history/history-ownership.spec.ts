/**
 * ทดสอบกฎเจ้าของของหน้าประวัติ (HistoryService + HistoryStore จริง บนฐานข้อมูลจำลองในหน่วยความจำ)
 *
 * ข้อมูลทดสอบ:
 *   A1, A2  = session ของ user A (user_id = A, client_id = null)
 *   B1      = session ของ user B
 *   G1      = session ของ guest (client_id = C1, user_id = null)
 *   OLD     = แถวเก่าก่อนมี migration 011 (user_id = NULL, client_id = C2)
 *   LEGACY  = แถวที่มีทั้ง user_id = A และ client_id = C1 (ไม่ควรเกิดตามกฎเจ้าของแบบเดียว แต่ต้องไม่รั่วให้ guest C1)
 */

import { FakeSessionsPool, makeSessionRow } from '../auth/testing/fake-sessions-pool';
import type { SessionOwner } from '../auth/session-owner';
import type { GraphRepository } from '../traversal/graph.repository';
import { HistoryNotFoundError, HistoryService } from './history.service';
import { HistoryStore } from './history.store';

const USER_A: SessionOwner = { kind: 'user', userId: 'user-a' };
const USER_B: SessionOwner = { kind: 'user', userId: 'user-b' };
const GUEST_C1: SessionOwner = { kind: 'guest', clientId: '11111111-1111-4111-8111-111111111111' };
const GUEST_C2: SessionOwner = { kind: 'guest', clientId: '22222222-2222-4222-8222-222222222222' };

const A1 = makeSessionRow({ user_id: 'user-a' });
const A2 = makeSessionRow({ user_id: 'user-a' });
const B1 = makeSessionRow({ user_id: 'user-b' });
const G1 = makeSessionRow({ client_id: GUEST_C1.kind === 'guest' ? GUEST_C1.clientId : null });
const OLD = makeSessionRow({ client_id: GUEST_C2.kind === 'guest' ? GUEST_C2.clientId : null });
const LEGACY = makeSessionRow({
  user_id: 'user-a',
  client_id: GUEST_C1.kind === 'guest' ? GUEST_C1.clientId : null,
});

// ผังไม่มีในหน่วยความจำ → รายการแสดงแบบจำกัดข้อมูล รายละเอียดตอบ available=false (พฤติกรรมเดิมของระบบเมื่อผังหาย)
const noGraphs = { findById: () => undefined, listManuals: () => [] } as unknown as GraphRepository;

function setup() {
  const pool = new FakeSessionsPool([A1, A2, B1, G1, OLD, LEGACY].map((row) => ({ ...row })));
  const service = new HistoryService(new HistoryStore(pool.asPool()), noGraphs);
  return { pool, service };
}

async function idsOf(service: HistoryService, owner: SessionOwner): Promise<string[]> {
  const result = await service.list(owner, { sort: 'newest', page: 1, pageSize: 50 });
  return result.items.map((item) => item.sessionId).sort();
}

const sorted = (...rows: Array<{ session_id: string }>) => rows.map((r) => r.session_id).sort();

describe('(1) user A อ่าน/ลบ session ของ user B ไม่ได้ → 404', () => {
  it('รายการของ A ไม่มี session ของ B', async () => {
    const { service } = setup();
    // A เห็น session ของตัวเอง 3 แถว (รวม LEGACY ที่ user_id = A) และไม่เห็นของ B, guest, แถวเก่า
    expect(await idsOf(service, USER_A)).toEqual(sorted(A1, A2, LEGACY));
  });

  it('A อ่านรายละเอียด session ของ B → HistoryNotFoundError', async () => {
    const { service } = setup();
    await expect(service.detail(USER_A, B1.session_id)).rejects.toThrow(HistoryNotFoundError);
  });

  it('A ลบ session ของ B → HistoryNotFoundError และแถวของ B ยังอยู่', async () => {
    const { service, pool } = setup();
    await expect(service.remove(USER_A, B1.session_id)).rejects.toThrow(HistoryNotFoundError);
    expect(pool.has(B1.session_id)).toBe(true);
  });

  it('A ให้คะแนน session ของ B → HistoryNotFoundError และไม่มีคะแนนถูกเขียน', async () => {
    const { service, pool } = setup();
    await expect(service.saveFeedback(USER_A, B1.session_id, { helpful: true, comment: null })).rejects.toThrow(
      HistoryNotFoundError,
    );
    expect(pool.feedback.size).toBe(0);
  });

  it('A อ่าน/ลบ session ของตัวเองได้', async () => {
    const { service, pool } = setup();
    expect((await service.detail(USER_A, A1.session_id)).sessionId).toBe(A1.session_id);
    await service.remove(USER_A, A1.session_id);
    expect(pool.has(A1.session_id)).toBe(false);
    expect(pool.has(A2.session_id)).toBe(true);
  });
});

describe('(2) guest เห็นประวัติของ user ไม่ได้ แม้ใช้ client_id เดียวกัน', () => {
  it('รายการของ guest C1 มีแค่ session ของ guest ไม่มี LEGACY (user A ที่มี client_id = C1)', async () => {
    const { service } = setup();
    expect(await idsOf(service, GUEST_C1)).toEqual(sorted(G1));
  });

  it('guest C1 อ่านรายละเอียด session ของ user (LEGACY, A1) → HistoryNotFoundError', async () => {
    const { service } = setup();
    await expect(service.detail(GUEST_C1, LEGACY.session_id)).rejects.toThrow(HistoryNotFoundError);
    await expect(service.detail(GUEST_C1, A1.session_id)).rejects.toThrow(HistoryNotFoundError);
  });

  it('guest C1 ลบ/ให้คะแนน session ของ user ไม่ได้ และแถวยังอยู่', async () => {
    const { service, pool } = setup();
    await expect(service.remove(GUEST_C1, LEGACY.session_id)).rejects.toThrow(HistoryNotFoundError);
    await expect(
      service.saveFeedback(GUEST_C1, LEGACY.session_id, { helpful: false, comment: 'x' }),
    ).rejects.toThrow(HistoryNotFoundError);
    expect(pool.has(LEGACY.session_id)).toBe(true);
    expect(pool.feedback.size).toBe(0);
  });

  it('user ไม่เห็น session ของ guest (G1, OLD) ด้วย', async () => {
    const { service } = setup();
    await expect(service.detail(USER_A, G1.session_id)).rejects.toThrow(HistoryNotFoundError);
    await expect(service.detail(USER_B, OLD.session_id)).rejects.toThrow(HistoryNotFoundError);
  });
});

describe('(3) guest flow เดิมยังทำงาน', () => {
  it('guest C1 ดูรายการ รายละเอียด ให้คะแนน แล้วลบ session ของตัวเอง', async () => {
    const { service, pool } = setup();

    expect(await idsOf(service, GUEST_C1)).toEqual(sorted(G1));
    expect((await service.detail(GUEST_C1, G1.session_id)).sessionId).toBe(G1.session_id);

    await expect(service.saveFeedback(GUEST_C1, G1.session_id, { helpful: true, comment: 'ดี' })).resolves.toEqual({
      helpful: true,
      comment: 'ดี',
    });
    expect(pool.feedback.get(G1.session_id)).toEqual({ helpful: 1, comment: 'ดี' });

    await service.remove(GUEST_C1, G1.session_id);
    expect(pool.has(G1.session_id)).toBe(false);
  });

  it('guest ลบ session ที่ไม่ใช่ของ client_id ตัวเอง (ของ guest อีกคน) ไม่ได้', async () => {
    const { service, pool } = setup();
    await expect(service.remove(GUEST_C1, OLD.session_id)).rejects.toThrow(HistoryNotFoundError);
    expect(pool.has(OLD.session_id)).toBe(true);
  });
});

describe('(4) แถวเก่าที่ user_id = NULL ยังโหลดได้', () => {
  it('เจ้าของ client_id เดิม (C2) เห็นแถวเก่าในรายการและเปิดรายละเอียดได้', async () => {
    const { service } = setup();
    expect(await idsOf(service, GUEST_C2)).toEqual(sorted(OLD));
    expect((await service.detail(GUEST_C2, OLD.session_id)).sessionId).toBe(OLD.session_id);
  });

  it('ลบแถวเก่าได้โดยเจ้าของเดิม', async () => {
    const { service, pool } = setup();
    await service.remove(GUEST_C2, OLD.session_id);
    expect(pool.has(OLD.session_id)).toBe(false);
  });

  it('แถวที่หมดอายุไม่ถูกแสดง (เงื่อนไขเดิมยังอยู่)', async () => {
    const pool = new FakeSessionsPool([makeSessionRow({ client_id: GUEST_C2.kind === 'guest' ? GUEST_C2.clientId : null, expired: true })]);
    const service = new HistoryService(new HistoryStore(pool.asPool()), noGraphs);
    expect(await idsOf(service, GUEST_C2)).toEqual([]);
  });
});
