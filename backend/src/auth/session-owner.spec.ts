import { InvalidClientIdError } from '../traversal/traversal.dto';
import { Role } from './role.enum';
import {
  ownerColumns,
  ownerWhere,
  resolveOptionalOwner,
  resolveRequiredOwner,
} from './session-owner';

const CLIENT = '11111111-1111-4111-8111-111111111111';
const USER = { sub: 'user-a', role: Role.User };

describe('resolveRequiredOwner', () => {
  it('ล็อกอิน → user (ไม่ต้องมี X-Client-Id)', () => {
    expect(resolveRequiredOwner(USER, undefined)).toEqual({ kind: 'user', userId: 'user-a' });
  });

  it('ล็อกอินแล้วไม่ดู X-Client-Id เลย (ส่งค่าเสียมาก็ไม่ล้ม และไม่ถูกลดเป็น guest)', () => {
    expect(resolveRequiredOwner(USER, 'not-a-uuid')).toEqual({ kind: 'user', userId: 'user-a' });
    expect(resolveRequiredOwner(USER, CLIENT)).toEqual({ kind: 'user', userId: 'user-a' });
  });

  it('guest + X-Client-Id ถูกต้อง → guest (ตัวพิมพ์เล็ก)', () => {
    expect(resolveRequiredOwner(undefined, CLIENT.toUpperCase())).toEqual({ kind: 'guest', clientId: CLIENT });
  });

  it('guest ไม่ส่ง / ส่งผิดรูป → InvalidClientIdError (400 เหมือนเดิม)', () => {
    expect(() => resolveRequiredOwner(undefined, undefined)).toThrow(InvalidClientIdError);
    expect(() => resolveRequiredOwner(undefined, 'nope')).toThrow(InvalidClientIdError);
  });
});

describe('resolveOptionalOwner', () => {
  it('ล็อกอิน → user', () => {
    expect(resolveOptionalOwner(USER, CLIENT)).toEqual({ kind: 'user', userId: 'user-a' });
  });

  it('guest ไม่ส่ง X-Client-Id → ไม่มีเจ้าของ (ใช้งานได้ แต่ไม่ปรากฏในประวัติ)', () => {
    expect(resolveOptionalOwner(undefined, undefined)).toBeUndefined();
  });

  it('guest ส่งผิดรูป → InvalidClientIdError', () => {
    expect(() => resolveOptionalOwner(undefined, 'nope')).toThrow(InvalidClientIdError);
  });
});

describe('ownerWhere — เงื่อนไข SQL ของเจ้าของ', () => {
  it('user → user_id = ?', () => {
    expect(ownerWhere({ kind: 'user', userId: 'user-a' })).toEqual({ sql: '(user_id = ?)', params: ['user-a'] });
  });

  it('guest → client_id = ? AND user_id IS NULL (กัน guest เห็น session ของ user)', () => {
    expect(ownerWhere({ kind: 'guest', clientId: CLIENT })).toEqual({
      sql: '(client_id = ? AND user_id IS NULL)',
      params: [CLIENT],
    });
  });
});

describe('ownerColumns — ค่าที่เขียนลง sessions ตอนสร้าง (เจ้าของแบบเดียว)', () => {
  it('user → user_id เท่านั้น client_id เป็น null', () => {
    expect(ownerColumns({ kind: 'user', userId: 'user-a' })).toEqual({ userId: 'user-a', clientId: null });
  });

  it('guest → client_id เท่านั้น user_id เป็น null', () => {
    expect(ownerColumns({ kind: 'guest', clientId: CLIENT })).toEqual({ userId: null, clientId: CLIENT });
  });

  it('ไม่มีเจ้าของ → ทั้งคู่ null', () => {
    expect(ownerColumns(undefined)).toEqual({ userId: null, clientId: null });
  });
});
