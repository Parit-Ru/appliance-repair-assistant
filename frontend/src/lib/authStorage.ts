/**
 * ที่เก็บ token การเข้าสู่ระบบ — localStorage + สำเนาในหน่วยความจำ
 *
 * ใช้ localStorage (ตัดสินใจไว้แล้ว) เพื่อให้ผู้ใช้ยังอยู่ในระบบหลังรีเฟรชหน้า
 * ข้อแลกเปลี่ยน: ถ้าเว็บมีช่องโหว่ XSS สคริปต์ที่แทรกเข้ามาอ่าน token ได้
 * (React escape ข้อความให้อยู่แล้ว และ demo รันบน localhost) · ทางที่ปลอดภัยกว่าคือ httpOnly cookie ซึ่งต้องแก้ backend
 *
 * เก็บ { token, user } เพื่อให้ชื่อบนแถบเมนูขึ้นทันทีก่อน GET /auth/me ตอบ (ค่านั้นเป็นแค่ตัวแสดงผล
 * สิทธิ์จริงตัดสินที่ backend จาก token เสมอ)
 *
 * เหมือน clientId.ts: ทุกการอ่าน/เขียนอยู่ใน try/catch เพราะ localStorage อาจใช้ไม่ได้ (โหมดส่วนตัวบางตัว,
 * ปิดข้อมูลเว็บ) ถ้าเขียนไม่ได้จะจำไว้ในหน่วยความจำของแท็บนี้ (ล็อกอินอยู่จนปิดแท็บ) แทนการทำให้ล็อกอินล้ม
 *
 * http.ts อ่าน token จาก getStoredToken() ทุกคำขอ จึงได้ค่าล่าสุดทันทีที่ login/logout โดยไม่ต้องรอ React render
 */

import type { AuthUser, Role } from '../api/types'

const STORAGE_KEY = 'fixstep.auth'

export interface StoredAuth {
  token: string
  user: AuthUser
}

/** สำเนาในหน่วยความจำ: undefined = ยังไม่ได้โหลด · null = โหลดแล้วและไม่มี */
let memory: StoredAuth | null | undefined

function isRole(value: unknown): value is Role {
  return value === 'user' || value === 'admin'
}

/** ตรวจรูปร่างของข้อมูลที่อ่านจาก localStorage (อาจถูกแก้มือ/เสีย) */
function parseStoredAuth(raw: string | null): StoredAuth | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { token, user } = value as { token?: unknown; user?: unknown }
    if (typeof token !== 'string' || token === '') return null
    if (typeof user !== 'object' || user === null) return null
    const { id, displayName, role } = user as { id?: unknown; displayName?: unknown; role?: unknown }
    if (typeof id !== 'string' || id === '' || typeof displayName !== 'string' || !isRole(role)) return null
    return { token, user: { id, displayName, role } }
  } catch {
    return null
  }
}

function load(): StoredAuth | null {
  if (memory !== undefined) return memory
  try {
    memory = parseStoredAuth(localStorage.getItem(STORAGE_KEY))
  } catch {
    memory = null
  }
  return memory
}

/** การล็อกอินที่จำไว้ (ไม่มี = null) */
export function readStoredAuth(): StoredAuth | null {
  return load()
}

/** token ปัจจุบัน (ไม่มี = undefined) — http.ts เรียกทุกคำขอ */
export function getStoredToken(): string | undefined {
  return load()?.token
}

export function storeAuth(auth: StoredAuth): void {
  memory = auth
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  } catch {
    // เก็บไม่ได้: ใช้ในหน่วยความจำของแท็บนี้ต่อไป
  }
}

export function clearStoredAuth(): void {
  memory = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ลบไม่ได้: สำเนาในหน่วยความจำถูกล้างแล้ว
  }
}
