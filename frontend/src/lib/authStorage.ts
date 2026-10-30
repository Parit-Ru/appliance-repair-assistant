import type { AuthUser, Role } from '../api/types'

const STORAGE_KEY = 'fixstep.auth'

export interface StoredAuth {
  token: string
  user: AuthUser
}

let memory: StoredAuth | null | undefined

function isRole(value: unknown): value is Role {
  return value === 'user' || value === 'admin'
}

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

export function readStoredAuth(): StoredAuth | null {
  if (memory !== undefined) return memory
  try {
    memory = parseStoredAuth(localStorage.getItem(STORAGE_KEY))
  } catch {
    memory = null
  }
  return memory
}

export function getStoredToken(): string | undefined {
  return readStoredAuth()?.token
}

export function storeAuth(auth: StoredAuth): void {
  memory = auth
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  } catch {
    // เก็บไม่ได้ (โหมดส่วนตัว/ถูกบล็อก): ใช้ค่าในหน่วยความจำของแท็บนี้ต่อไป
  }
}

export function clearStoredAuth(): void {
  memory = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ลบไม่ได้: ค่าในหน่วยความจำถูกล้างแล้ว
  }
}
