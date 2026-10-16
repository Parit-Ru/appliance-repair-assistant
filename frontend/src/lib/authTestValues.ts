import type { AuthContextValue } from './authContext'

/** ค่า AuthContext สำเร็จรูปสำหรับเทสต์ (ใช้ร่วมกันหลายไฟล์) — ไม่ถูกใช้ในโค้ดจริง */
const noop = async () => undefined

export const GUEST: AuthContextValue = {
  status: 'guest',
  user: undefined,
  login: noop,
  register: noop,
  logout: () => undefined,
}

export const USER_A: AuthContextValue = {
  ...GUEST,
  status: 'user',
  user: { id: 'user-a', displayName: 'สมชาย', role: 'user' },
}

export const USER_B: AuthContextValue = {
  ...GUEST,
  status: 'user',
  user: { id: 'user-b', displayName: 'สมหญิง', role: 'user' },
}

export const ADMIN: AuthContextValue = {
  ...GUEST,
  status: 'user',
  user: { id: 'admin-1', displayName: 'แอดมิน', role: 'admin' },
}

export const VERIFYING: AuthContextValue = { ...USER_A, status: 'verifying' }
