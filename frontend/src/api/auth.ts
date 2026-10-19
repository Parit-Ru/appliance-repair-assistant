import { request } from './http'
import type { AuthResponse, AuthUser } from './types'

/**
 * บัญชีผู้ใช้ — login/register ใช้ anonymous (ไม่แนบ token และ 401 = รหัสผ่านผิด ไม่ใช่ token เสีย)
 * หน้าจอเก็บเฉพาะ { id, displayName, role } ไม่เก็บอีเมล
 */

export interface Session {
  token: string
  user: AuthUser
}

/** หน้าจอเก็บเฉพาะ id / ชื่อที่แสดง / บทบาท (ไม่เก็บอีเมล) */
function toAuthUser({ id, displayName, role }: AuthUser): AuthUser {
  return { id, displayName, role }
}

function toSession(response: AuthResponse): Session {
  return { token: response.accessToken, user: toAuthUser(response.user) }
}

// POST /auth/login
export async function login(email: string, password: string): Promise<Session> {
  const response = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  })
  return toSession(response)
}

// POST /auth/register — สมัครแล้วได้ token ทันที (role เป็น user เสมอ ฝั่งหน้าจอไม่มีทางขอ role อื่น)
export async function register(email: string, password: string, displayName: string): Promise<Session> {
  const response = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
    anonymous: true,
  })
  return toSession(response)
}

// GET /auth/me — ยืนยัน token ที่เก็บไว้และอ่านข้อมูลล่าสุด (401 → http.ts ล้างการล็อกอินให้)
export async function getMe(): Promise<AuthUser> {
  return toAuthUser(await request<AuthUser>('/auth/me'))
}
