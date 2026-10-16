import { createContext, useContext } from 'react'
import type { AuthUser } from '../api/types'

/**
 * สถานะการเข้าสู่ระบบที่หน้าจอเห็น
 *
 * - verifying  มี token ที่จำไว้ กำลังยืนยันกับ GET /auth/me (ยังไม่รู้ว่าใช้ได้หรือไม่)
 * - guest      ไม่ได้ล็อกอิน — ใช้งานได้ทุกอย่างเหมือนเดิมผ่าน X-Client-Id
 * - user       ล็อกอินแล้ว (user หรือ admin ดูที่ user.role)
 *
 * ทั้งหมดเป็น UX เท่านั้น: การตรวจสิทธิ์จริงอยู่ที่ backend
 */
export type AuthStatus = 'verifying' | 'guest' | 'user'

export interface AuthContextValue {
  status: AuthStatus
  /** มีเมื่อ status เป็น user หรือ verifying (ค่าที่จำไว้ระหว่างยืนยัน) */
  user: AuthUser | undefined
  /** เข้าสู่ระบบ — ล้างแคชของผู้ใช้เดิมก่อนเสมอ · ผิดพลาดโยน ApiError (INVALID_CREDENTIALS ฯลฯ) */
  login: (email: string, password: string) => Promise<void>
  /** สมัครแล้วเข้าสู่ระบบทันที */
  register: (email: string, password: string, displayName: string) => Promise<void>
  /** ออกจากระบบ — ล้าง token และแคชทั้งหมด แล้วกลับหน้าแรก */
  logout: () => void
}

/**
 * ค่าเริ่มต้นเมื่อไม่มี AuthProvider (เช่น เทสต์ที่ render หน้าเดี่ยวๆ) = guest
 * จึงเหมือนพฤติกรรมก่อนมีระบบบัญชีทุกประการ
 */
const GUEST_VALUE: AuthContextValue = {
  status: 'guest',
  user: undefined,
  login: () => Promise.reject(new Error('ต้องอยู่ใน AuthProvider')),
  register: () => Promise.reject(new Error('ต้องอยู่ใน AuthProvider')),
  logout: () => undefined,
}

export const AuthContext = createContext<AuthContextValue>(GUEST_VALUE)

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

/** ตัวระบุตัวตนสำหรับ key ของแคช: id ผู้ใช้ หรือ 'guest' — ผู้ใช้คนละคนจึงไม่มีทางแชร์แคชกัน */
export function useIdentity(): string {
  return useContext(AuthContext).user?.id ?? 'guest'
}
