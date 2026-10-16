import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearStoredAuth, resetAuthStorageForTests, storeAuth } from '../lib/authStorage'
import { ApiError, request, setUnauthorizedHandler } from './http'

const API = 'http://api.test'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

function lastHeaders(): Record<string, string> {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined
  return (init?.headers ?? {}) as Record<string, string>
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  resetAuthStorageForTests()
  clearStoredAuth()
})

afterEach(() => {
  setUnauthorizedHandler(undefined)
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('request: แนบ token', () => {
  it('ไม่ล็อกอิน → ไม่มี Authorization (guest ทำงานเหมือนเดิม) และยังส่ง X-Client-Id ที่ผู้เรียกใส่มา', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))
    await request('/history', { headers: { 'X-Client-Id': 'abc' } })
    expect(lastHeaders()).toEqual({ 'X-Client-Id': 'abc' })
  })

  it('ล็อกอินอยู่ → แนบ Authorization: Bearer <token>', async () => {
    storeAuth({ token: 'tok-1', user: { id: 'u1', displayName: 'A', role: 'user' } })
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await request('/history')
    expect(lastHeaders()).toEqual({ Authorization: 'Bearer tok-1' })
  })

  it('มี body → ใส่ Content-Type · anonymous → ไม่แนบ token แม้ล็อกอินอยู่', async () => {
    storeAuth({ token: 'tok-1', user: { id: 'u1', displayName: 'A', role: 'user' } })
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await request('/auth/login', { method: 'POST', body: { a: 1 }, anonymous: true })
    expect(lastHeaders()).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('request: 401', () => {
  const body = { statusCode: 401, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' }

  it('401 ที่แนบ token ไป → เรียกตัวจัดการครั้งเดียวพร้อม token ที่ใช้ และยังโยน ApiError ให้ผู้เรียก', async () => {
    storeAuth({ token: 'tok-1', user: { id: 'u1', displayName: 'A', role: 'user' } })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(jsonResponse(401, body))

    await expect(request('/history')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('tok-1')
  })

  it('401 ตอน guest (ไม่มี token) → ไม่เรียกตัวจัดการ (ไม่เด้ง ไม่วนซ้ำ)', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(jsonResponse(401, body))

    await expect(request('/history')).rejects.toBeInstanceOf(ApiError)
    expect(handler).not.toHaveBeenCalled()
  })

  it('401 ของ login (anonymous: รหัสผ่านผิด) → ไม่เรียกตัวจัดการแม้มี token เก่าค้างอยู่', async () => {
    storeAuth({ token: 'old', user: { id: 'u1', displayName: 'A', role: 'user' } })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(
      jsonResponse(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' }),
    )

    await expect(request('/auth/login', { method: 'POST', body: {}, anonymous: true })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('403 และ 404 ไม่ถือว่า token เสีย', async () => {
    storeAuth({ token: 'tok-1', user: { id: 'u1', displayName: 'A', role: 'user' } })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { statusCode: 403, code: 'FORBIDDEN', message: 'x' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { statusCode: 404, code: 'HISTORY_NOT_FOUND', message: 'x' }))

    await expect(request('/admin/feedback')).rejects.toMatchObject({ status: 403 })
    await expect(request('/history/x')).rejects.toMatchObject({ status: 404 })
    expect(handler).not.toHaveBeenCalled()
  })
})
