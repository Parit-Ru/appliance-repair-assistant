import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredAuth,
  getStoredToken,
  parseStoredAuth,
  readStoredAuth,
  resetAuthStorageForTests,
  storeAuth,
} from './authStorage'

const AUTH = { token: 'tok', user: { id: 'u1', displayName: 'สมชาย', role: 'user' as const } }

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseStoredAuth', () => {
  it('รับข้อมูลที่ถูกต้อง', () => {
    expect(parseStoredAuth(JSON.stringify(AUTH))).toEqual(AUTH)
  })

  it.each([
    ['ไม่มี', null],
    ['ไม่ใช่ JSON', '{oops'],
    ['ไม่ใช่ object', '"x"'],
    ['token ว่าง', JSON.stringify({ ...AUTH, token: '' })],
    ['ไม่มี user', JSON.stringify({ token: 'x' })],
    ['role ไม่รู้จัก', JSON.stringify({ token: 'x', user: { id: 'u', displayName: 'a', role: 'root' } })],
    ['id ว่าง', JSON.stringify({ token: 'x', user: { id: '', displayName: 'a', role: 'user' } })],
  ])('ปฏิเสธ: %s', (_name, raw) => {
    expect(parseStoredAuth(raw)).toBeNull()
  })

  it('ไม่เก็บอีเมลหรือช่องอื่นที่ไม่รู้จัก', () => {
    const parsed = parseStoredAuth(
      JSON.stringify({ token: 'x', user: { id: 'u', displayName: 'a', role: 'user', email: 'a@b.com' } }),
    )
    expect(parsed?.user).toEqual({ id: 'u', displayName: 'a', role: 'user' })
  })
})

describe('เก็บ/อ่าน/ล้าง', () => {
  beforeEach(() => {
    resetAuthStorageForTests()
  })

  it('เขียนแล้วอ่านกลับได้ และ getStoredToken ตรงกัน · ล้างแล้วหาย', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)

    expect(readStoredAuth()).toBeNull()
    storeAuth(AUTH)
    expect(storage.data.has('fixstep.auth')).toBe(true)
    expect(getStoredToken()).toBe('tok')

    clearStoredAuth()
    expect(getStoredToken()).toBeUndefined()
    expect(storage.data.has('fixstep.auth')).toBe(false)
  })

  it('อ่านค่าที่เคยเก็บไว้ตอนเปิดแอป', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'fixstep.auth': JSON.stringify(AUTH) }))
    expect(readStoredAuth()).toEqual(AUTH)
  })

  it('ข้อมูลเสียใน localStorage → ถือว่าไม่ได้ล็อกอิน', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'fixstep.auth': '{broken' }))
    expect(readStoredAuth()).toBeNull()
  })

  it('localStorage ใช้ไม่ได้ (โยน error) → ยังล็อกอินอยู่ในหน่วยความจำของแท็บนี้ ไม่ล้ม', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    vi.stubGlobal('localStorage', broken)

    expect(readStoredAuth()).toBeNull()
    expect(() => storeAuth(AUTH)).not.toThrow()
    expect(getStoredToken()).toBe('tok')
    expect(() => clearStoredAuth()).not.toThrow()
    expect(getStoredToken()).toBeUndefined()
  })
})
