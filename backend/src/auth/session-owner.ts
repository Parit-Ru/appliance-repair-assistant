/**
 * session-owner.ts — "ใครเป็นเจ้าของ session" และเงื่อนไข SQL ของมัน (ที่เดียวของทั้งระบบ)
 *
 * เจ้าของมีได้แบบเดียวต่อ session (migration 011):
 *   user  = ล็อกอินอยู่ → เก็บ user_id, client_id เป็น NULL
 *   guest = ไม่ได้ล็อกอิน → เก็บ client_id (จาก X-Client-Id), user_id เป็น NULL
 *
 * เงื่อนไขอ่าน/ลบ:
 *   user  → user_id = ?
 *   guest → client_id = ? AND user_id IS NULL
 * ส่วน AND user_id IS NULL ของ guest คือหัวใจ: ต่อให้ใครรู้ client_id ของเบราว์เซอร์ที่ผู้ใช้เคยล็อกอินอยู่
 * (เช่น ล็อกเอาต์แล้วใช้เครื่องเดียวกันแบบ guest) ก็มองไม่เห็นและลบ session ที่เป็นของ user ไม่ได้
 *
 * ผู้ใช้ที่ล็อกอินแล้วจะ "ไม่ดู" X-Client-Id เลย (ไม่แม้แต่ตรวจรูปแบบ) → ไม่มีทางสลับไปเป็น guest ด้วยหัวข้อนี้
 * ไม่มีการ "claim" session ของ guest มาเป็นของ user (ตัดสินใจไว้แล้ว)
 *
 * ข้อความ SQL ที่คืนจาก ownerWhere() เป็นค่าคงที่ในไฟล์นี้ ไม่ประกอบจาก input ค่าจริงทั้งหมดส่งเป็นพารามิเตอร์ (?)
 */

import { parseOptionalClientId, parseRequiredClientId } from '../traversal/traversal.dto';
import type { AuthUser } from './jwt-auth.guard';

export type SessionOwner =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; clientId: string };

/**
 * เจ้าของจาก request ที่ต้องมีเจ้าของเสมอ (ประวัติ, ยกเลิก session)
 * ล็อกอิน → user · ไม่ล็อกอิน → ต้องมี X-Client-Id ที่เป็น UUID ไม่งั้น InvalidClientIdError (400)
 */
export function resolveRequiredOwner(user: AuthUser | undefined, clientIdHeader: unknown): SessionOwner {
  if (user) {
    return { kind: 'user', userId: user.sub };
  }
  return { kind: 'guest', clientId: parseRequiredClientId(clientIdHeader) };
}

/**
 * เจ้าของตอนเริ่ม session: ไม่มีเลยก็ได้ (ไม่ล็อกอินและไม่ส่ง X-Client-Id = ใช้งานได้ แต่ไม่ปรากฏในประวัติของใคร)
 * ส่ง X-Client-Id ผิดรูปตอนเป็น guest → InvalidClientIdError (400) เหมือนเดิม
 */
export function resolveOptionalOwner(
  user: AuthUser | undefined,
  clientIdHeader: unknown,
): SessionOwner | undefined {
  if (user) {
    return { kind: 'user', userId: user.sub };
  }
  const clientId = parseOptionalClientId(clientIdHeader);
  return clientId === undefined ? undefined : { kind: 'guest', clientId };
}

/** เงื่อนไข WHERE ของเจ้าของ (ครอบด้วยวงเล็บ ต่อท้าย AND ได้เลย) พร้อมพารามิเตอร์ตามลำดับ */
export function ownerWhere(owner: SessionOwner): { sql: string; params: string[] } {
  if (owner.kind === 'user') {
    return { sql: '(user_id = ?)', params: [owner.userId] };
  }
  return { sql: '(client_id = ? AND user_id IS NULL)', params: [owner.clientId] };
}

/** ค่าที่ต้องเขียนลงคอลัมน์ user_id / client_id ตอนสร้าง session (อย่างใดอย่างหนึ่ง หรือทั้งคู่ NULL ถ้าไม่มีเจ้าของ) */
export function ownerColumns(owner: SessionOwner | undefined): { userId: string | null; clientId: string | null } {
  if (owner === undefined) {
    return { userId: null, clientId: null };
  }
  return owner.kind === 'user'
    ? { userId: owner.userId, clientId: null }
    : { userId: null, clientId: owner.clientId };
}
