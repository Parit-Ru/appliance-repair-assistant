import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './http'

/** แทนที่ fetch ของจริงด้วยตัวปลอม จะได้ทดสอบโดยไม่ต้องมีเซิร์ฟเวอร์ */
function mockFetch(impl: () => Promise<Response> | Response) {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// คืนของปลอมทั้งหมดหลังจบแต่ละเทส ไม่งั้นเทสถัดไปจะได้รับผลข้างเคียง
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('request', () => {
  it('คืนค่า JSON เมื่อเซิร์ฟเวอร์ตอบสำเร็จ และต่อ URL จาก VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
    const spy = mockFetch(() => jsonResponse(200, [{ graphId: 'g1' }]))

    const result = await request<{ graphId: string }[]>('/traversal/graphs')

    expect(result).toEqual([{ graphId: 'g1' }])
    expect(spy).toHaveBeenCalledWith('http://localhost:3000/traversal/graphs', expect.anything())
  })

  it('โยน ApiError ที่มี status และ code เมื่อเซิร์ฟเวอร์ตอบ 400 พร้อม code', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
    mockFetch(() =>
      jsonResponse(400, {
        statusCode: 400,
        code: 'SAFETY_CONFIRMATION_REQUIRED',
        message: 'ต้องยืนยันก่อน',
      }),
    )

    const error = await request('/traversal/sessions/abc/actions', {
      method: 'POST',
      body: { type: 'continue' },
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).code).toBe('SAFETY_CONFIRMATION_REQUIRED')
  })

  it('ยังโยน ApiError เมื่อตอบ 500 แต่ body ไม่ใช่ JSON', async () => {
    // เกิดได้จริงเมื่อ Render ส่งหน้า error กลับมาเป็น HTML
    // ถ้าโค้ดแปลง JSON โดยไม่ดักไว้ จะพังด้วย error คนละเรื่อง แล้วหาสาเหตุยาก
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
    mockFetch(() => new Response('<html>Internal Server Error</html>', { status: 500 }))

    const error = await request('/traversal/graphs').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
  })

  it('โยน ApiError code NETWORK_ERROR เมื่อเชื่อมต่อไม่ได้', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    const error = await request('/traversal/graphs').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('NETWORK_ERROR')
  })

  it('โยน error ที่บอกชื่อตัวแปร เมื่อไม่ได้ตั้ง VITE_API_URL', async () => {
    // นี่คือบั๊กเดิมของ lib/api.ts ที่ถอยไปใช้ localhost เงียบๆ
    // ทำให้เว็บที่ deploy แล้วเรียกเซิร์ฟเวอร์ในเครื่องของผู้ใช้ โดยไม่มีอะไรบอกสาเหตุ
    vi.stubEnv('VITE_API_URL', '')
    mockFetch(() => jsonResponse(200, {}))

    const error = await request('/traversal/graphs').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('VITE_API_URL')
  })
})