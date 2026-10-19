/**
 * ตัวช่วยเรื่องการเด้งไปหน้าเข้าสู่ระบบและกลับมา (ฟังก์ชันล้วน)
 */

/**
 * ?next= ต้องเป็น path ภายในแอปเท่านั้น (ขึ้นต้นด้วย / แต่ไม่ใช่ // หรือ /\) กันลิงก์ที่พาไปเว็บอื่นหลังล็อกอิน
 * ไม่ผ่านหรือไม่มี = undefined (ผู้เรียกใช้หน้าแรกแทน)
 */
export function safeNext(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return undefined
  // หน้าล็อกอิน/สมัครเองไม่ใช่ปลายทางที่มีความหมาย (กันวน)
  if (/^\/(login|register)(\/|\?|$)/.test(raw)) return undefined
  return raw
}

type LoginReason = 'expired' | 'login-required'

/** URL ของหน้าเข้าสู่ระบบ พร้อมเหตุผลและปลายทางที่จะกลับมา (path ที่ไม่ปลอดภัย/เป็นหน้าล็อกอินเองจะไม่ถูกใส่) */
export function loginUrl(reason: LoginReason | undefined, next: string | undefined): string {
  const params = new URLSearchParams()
  if (reason !== undefined) params.set('reason', reason)
  const safe = safeNext(next)
  if (safe !== undefined) params.set('next', safe)
  const query = params.toString()
  return query === '' ? '/login' : `/login?${query}`
}
