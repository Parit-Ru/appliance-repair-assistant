import { getStoredToken } from './authStorage'
import { getClientId } from './clientId'

/**
 * หัวข้อบอก "เจ้าของ" ของคำขอที่เกี่ยวกับ session/ประวัติ
 *
 * - ล็อกอินอยู่ → ไม่ส่ง X-Client-Id เลย (backend ตัดสินจาก token และไม่ดูหัวข้อนี้ · ไม่พึ่งมัน)
 * - guest      → ส่ง X-Client-Id ของเบราว์เซอร์เหมือนเดิมทุกประการ
 *
 * ใช้ร่วมกันโดย api/traversal.ts และ api/history.ts
 */
export function ownerHeaders(): Record<string, string> {
  return getStoredToken() === undefined ? { 'X-Client-Id': getClientId() } : {}
}
