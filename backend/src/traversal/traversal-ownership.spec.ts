/**
 * ทดสอบกฎเจ้าของฝั่งเดินขั้นตอน (SessionStore จริงบนฐานข้อมูลจำลอง + ด่าน TraversalService.authorize)
 *
 *   - สร้าง session: เก็บเจ้าของแบบเดียว (user → user_id · guest → client_id)
 *   - DELETE /traversal/sessions/:id: user A ลบของ B ไม่ได้ · guest ลบของ user ไม่ได้ · guest ลบของตัวเองได้
 *   - GET/actions/outcome (e1): session ของ user ต้องมี token ของเจ้าของ · session ของ guest ใช้ id เป็นกุญแจเหมือนเดิม
 */

import { FakeSessionsPool, makeSessionRow } from '../auth/testing/fake-sessions-pool';
import type { SessionOwner } from '../auth/session-owner';
import { SessionStore } from './session.store';
import { SessionNotFoundError, TraversalService } from './traversal.service';
import type { SessionState } from '../traversal-engine/types';

const USER_A: SessionOwner = { kind: 'user', userId: 'user-a' };
const USER_B: SessionOwner = { kind: 'user', userId: 'user-b' };
const GUEST: SessionOwner = { kind: 'guest', clientId: '11111111-1111-4111-8111-111111111111' };

function sessionState(sessionId: string): SessionState {
  return {
    sessionId,
    graphId: 'graph-x',
    currentNodeId: 'start',
    status: 'in_progress',
    variables: {},
    confidence: null,
    history: [],
  } as SessionState;
}

describe('SessionStore.create — เจ้าของแบบเดียว', () => {
  it('user → เก็บ user_id และ client_id เป็น null', async () => {
    const pool = new FakeSessionsPool([]);
    await new SessionStore(pool.asPool()).create(sessionState('s-user'), undefined, USER_A);
    expect(pool.rows[0]).toMatchObject({ session_id: 's-user', user_id: 'user-a', client_id: null });
  });

  it('guest → เก็บ client_id และ user_id เป็น null (flow เดิม)', async () => {
    const pool = new FakeSessionsPool([]);
    await new SessionStore(pool.asPool()).create(sessionState('s-guest'), undefined, GUEST);
    expect(pool.rows[0]).toMatchObject({ session_id: 's-guest', user_id: null, client_id: GUEST.kind === 'guest' ? GUEST.clientId : '' });
  });

  it('ไม่มีเจ้าของ → ทั้งคู่ null', async () => {
    const pool = new FakeSessionsPool([]);
    await new SessionStore(pool.asPool()).create(sessionState('s-none'));
    expect(pool.rows[0]).toMatchObject({ user_id: null, client_id: null });
  });
});

describe('SessionStore.delete (DELETE /traversal/sessions/:id)', () => {
  const rowA = makeSessionRow({ user_id: 'user-a', status: 'in_progress' });
  const rowG = makeSessionRow({ client_id: GUEST.kind === 'guest' ? GUEST.clientId : null, status: 'in_progress' });
  const setup = () => {
    const pool = new FakeSessionsPool([{ ...rowA }, { ...rowG }]);
    return { pool, store: new SessionStore(pool.asPool()) };
  };

  it('user B ลบ session ของ user A ไม่ได้ (false → 404)', async () => {
    const { pool, store } = setup();
    expect(await store.delete(rowA.session_id, USER_B)).toBe(false);
    expect(pool.has(rowA.session_id)).toBe(true);
  });

  it('guest ลบ session ของ user ไม่ได้ แม้มี client_id (user_id ไม่ใช่ NULL ถูกกันไว้)', async () => {
    const guestClient = GUEST.kind === 'guest' ? GUEST.clientId : '';
    const pool = new FakeSessionsPool([makeSessionRow({ user_id: 'user-a', client_id: guestClient, status: 'in_progress' })]);
    const id = pool.rows[0].session_id;
    expect(await new SessionStore(pool.asPool()).delete(id, GUEST)).toBe(false);
    expect(pool.has(id)).toBe(true);
  });

  it('เจ้าของลบของตัวเองได้ · guest ลบของตัวเองได้ (flow เดิม)', async () => {
    const { pool, store } = setup();
    expect(await store.delete(rowA.session_id, USER_A)).toBe(true);
    expect(await store.delete(rowG.session_id, GUEST)).toBe(true);
    expect(pool.rows).toHaveLength(0);
  });

  it('ลบซ้ำ → false', async () => {
    const { store } = setup();
    expect(await store.delete(rowG.session_id, GUEST)).toBe(true);
    expect(await store.delete(rowG.session_id, GUEST)).toBe(false);
  });
});

describe('TraversalService — ด่านเจ้าของของ GET / actions / outcome (e1)', () => {
  const userSession = makeSessionRow({ user_id: 'user-a', status: 'in_progress' });
  const guestSession = makeSessionRow({ client_id: GUEST.kind === 'guest' ? GUEST.clientId : null, status: 'in_progress' });
  const oldSession = makeSessionRow({ status: 'in_progress' }); // user_id และ client_id เป็น NULL ทั้งคู่ (แถวเก่า)

  /**
   * store ที่ findUserId ใช้ SessionStore จริง (ฐานข้อมูลจำลอง) ส่วน find() ถูกดักไว้:
   * คืน undefined เสมอ แต่บันทึกว่าถูกเรียกหรือไม่ → "ผ่านด่านเจ้าของแล้ว" = find ถูกเรียก (แล้ว 404 เพราะไม่มี session ในจำลอง)
   */
  function setup() {
    const pool = new FakeSessionsPool([{ ...userSession }, { ...guestSession }, { ...oldSession }]);
    const store = new SessionStore(pool.asPool());
    const find = jest.spyOn(store, 'find').mockResolvedValue(undefined);
    const service = new TraversalService({} as never, {} as never, store, {} as never, {} as never);
    return { service, find };
  }

  const calls: Array<[string, (s: TraversalService, id: string, userId?: string) => Promise<unknown>]> = [
    ['GET session', (s, id, userId) => s.getSession(id, userId)],
    ['POST actions', (s, id, userId) => s.submitAction(id, { type: 'continue' }, userId)],
    ['POST outcome', (s, id, userId) => s.submitOutcome(id, 'ซ่อมได้แล้ว', userId)],
  ];

  describe.each(calls)('%s', (_name, call) => {
    it('session ของ user: ไม่มี token → 404 และไม่แตะ session', async () => {
      const { service, find } = setup();
      await expect(call(service, userSession.session_id, undefined)).rejects.toThrow(SessionNotFoundError);
      expect(find).not.toHaveBeenCalled();
    });

    it('session ของ user: token ของ user อื่น → 404 และไม่แตะ session', async () => {
      const { service, find } = setup();
      await expect(call(service, userSession.session_id, 'user-b')).rejects.toThrow(SessionNotFoundError);
      expect(find).not.toHaveBeenCalled();
    });

    it('session ของ user: token ของเจ้าของ → ผ่านด่าน (เข้าไปค้น session ต่อ)', async () => {
      const { service, find } = setup();
      await expect(call(service, userSession.session_id, 'user-a')).rejects.toThrow(SessionNotFoundError);
      expect(find).toHaveBeenCalledTimes(1);
    });

    it('session ของ guest: ไม่มี token ก็ผ่านด่าน (ใช้ session id เป็นกุญแจเหมือนเดิม)', async () => {
      const { service, find } = setup();
      await expect(call(service, guestSession.session_id, undefined)).rejects.toThrow(SessionNotFoundError);
      expect(find).toHaveBeenCalledTimes(1);
    });

    it('session เก่าที่ไม่มีเจ้าของเลย (user_id = NULL): ผ่านด่านเหมือนเดิม', async () => {
      const { service, find } = setup();
      await expect(call(service, oldSession.session_id, undefined)).rejects.toThrow(SessionNotFoundError);
      expect(find).toHaveBeenCalledTimes(1);
    });
  });

  it('abandonSession: user B ลบของ A ไม่ได้ → SessionNotFoundError', async () => {
    const { service } = setup();
    await expect(service.abandonSession(userSession.session_id, USER_B)).rejects.toThrow(SessionNotFoundError);
  });

  it('abandonSession: เจ้าของลบได้ แล้วลบซ้ำ → SessionNotFoundError', async () => {
    const { service } = setup();
    await expect(service.abandonSession(userSession.session_id, USER_A)).resolves.toBeUndefined();
    await expect(service.abandonSession(userSession.session_id, USER_A)).rejects.toThrow(SessionNotFoundError);
  });
});
