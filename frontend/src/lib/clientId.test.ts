import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const KEY = 'fixstep.clientId'

/** localStorage ปลอมในหน่วยความจำ (vitest รันใน node ไม่มี localStorage จริง) */
function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  })
  return store
}

/** โหลดโมดูลใหม่ทุกครั้ง เพราะ clientId.ts จำค่าไว้ในตัวแปรระดับโมดูล */
async function load() {
  vi.resetModules()
  return import('./clientId')
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('getClientId', () => {
  it('ยังไม่มี: สร้าง UUID และเก็บลง localStorage · เรียกซ้ำได้ค่าเดิม', async () => {
    const store = stubStorage()
    const { getClientId } = await load()

    const first = getClientId()

    expect(first).toMatch(UUID)
    expect(store.get(KEY)).toBe(first)
    expect(getClientId()).toBe(first)
  })

  it('มีอยู่แล้ว: ใช้ค่าเดิม (เปิดเว็บใหม่ก็ยังเป็น id เดิม) และแปลงเป็นตัวพิมพ์เล็ก', async () => {
    const store = stubStorage({ [KEY]: '3F2504E0-4F89-41D3-9A0C-0305E82C3301' })
    const { getClientId } = await load()

    expect(getClientId()).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
    expect(store.get(KEY)).toBe('3F2504E0-4F89-41D3-9A0C-0305E82C3301') // ไม่เขียนทับของเดิม
  })

  it('ค่าที่เก็บไว้เสีย (ไม่ใช่ UUID): สร้างใหม่และเขียนทับ', async () => {
    const store = stubStorage({ [KEY]: 'garbage' })
    const { getClientId } = await load()

    const id = getClientId()

    expect(id).toMatch(UUID)
    expect(store.get(KEY)).toBe(id)
  })

  it('localStorage โยน error ทั้งอ่านและเขียน (โหมดส่วนตัว/ปิดข้อมูลเว็บ): ยังได้ id และคงที่ตลอดอายุแท็บ', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const { getClientId } = await load()

    const first = getClientId()

    expect(first).toMatch(UUID)
    expect(getClientId()).toBe(first)
  })

  it('ไม่มี localStorage เลย (ReferenceError): ยังใช้งานได้', async () => {
    // vitest node: ไม่มี global localStorage อยู่แล้ว (stub ถูกล้างใน beforeEach)
    const { getClientId } = await load()

    expect(getClientId()).toMatch(UUID)
  })

  it('ไม่มี crypto.randomUUID: ประกอบ UUID v4 เอง', async () => {
    stubStorage()
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) })
    const { getClientId } = await load()

    const id = getClientId()

    expect(id).toMatch(UUID)
    expect(id[14]).toBe('4') // version 4
    expect('89ab').toContain(id[19]) // variant
  })
})

describe('isClientId', () => {
  it('รับเฉพาะ UUID', async () => {
    const { isClientId } = await load()

    expect(isClientId('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true)
    expect(isClientId('3f2504e0-4f89-41d3-9a0c-0305e82c33')).toBe(false)
    expect(isClientId('')).toBe(false)
    expect(isClientId(null)).toBe(false)
    expect(isClientId(42)).toBe(false)
  })
})

describe('คำขอที่แนบ X-Client-Id', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  function sent(): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, init }
  }

  it('เริ่ม session: แนบ X-Client-Id คู่กับ Content-Type และ body ไม่มี clientId', async () => {
    stubStorage()
    vi.resetModules()
    const { getClientId } = await import('./clientId')
    const { startSession } = await import('../api/traversal')

    await startSession('g1', { manualId: 'm1' })

    const { init } = sent()
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-Client-Id': getClientId() })
    expect(JSON.parse(init.body as string)).toEqual({ graphId: 'g1', manualId: 'm1' })
  })

  it('รายการประวัติ: แนบ X-Client-Id และส่งเฉพาะตัวกรองที่เลือก', async () => {
    stubStorage()
    vi.resetModules()
    const { getClientId } = await import('./clientId')
    const { listHistory } = await import('../api/history')

    await listHistory({ q: 'แอร์', category: 'Air Conditioner', brand: undefined, status: 'user_fixed', sort: 'oldest', page: 2 })

    const { url, init } = sent()
    const search = new URL(url).searchParams
    expect(new URL(url).pathname).toBe('/history')
    expect(search.get('q')).toBe('แอร์')
    expect(search.get('category')).toBe('Air Conditioner')
    expect(search.get('status')).toBe('user_fixed')
    expect(search.get('sort')).toBe('oldest')
    expect(search.get('page')).toBe('2')
    expect(search.has('brand')).toBe(false)
    expect(init.headers).toEqual({ 'X-Client-Id': getClientId() })
  })

  it('ลบ/ให้คะแนน: แนบ X-Client-Id', async () => {
    stubStorage()
    vi.resetModules()
    const { getClientId } = await import('./clientId')
    const { deleteHistory, submitFeedback } = await import('../api/history')

    await deleteHistory('s1')
    await submitFeedback('s1', { helpful: true, comment: null })

    const [[deleteUrl, deleteInit], [feedbackUrl, feedbackInit]] = fetchMock.mock.calls as [string, RequestInit][]
    expect(deleteUrl).toBe('http://api.test/history/s1')
    expect(deleteInit.method).toBe('DELETE')
    expect(deleteInit.headers).toEqual({ 'X-Client-Id': getClientId() })
    expect(feedbackUrl).toBe('http://api.test/history/s1/feedback')
    expect(feedbackInit.headers).toEqual({ 'Content-Type': 'application/json', 'X-Client-Id': getClientId() })
    expect(JSON.parse(feedbackInit.body as string)).toEqual({ helpful: true, comment: null })
  })

  it('ยกเลิกการตรวจ (DELETE /traversal/sessions/:id): แนบ X-Client-Id เพื่อให้เซิร์ฟเวอร์ตรวจเจ้าของได้', async () => {
    stubStorage()
    vi.resetModules()
    const { getClientId } = await import('./clientId')
    const { abandonSession } = await import('../api/traversal')

    await abandonSession('s 1')

    const { url, init } = sent()
    expect(url).toBe('http://api.test/traversal/sessions/s%201')
    expect(init.method).toBe('DELETE')
    // ไม่มี body จึงไม่มี Content-Type เกินมา
    expect(init.headers).toEqual({ 'X-Client-Id': getClientId() })
    expect(init.body).toBeUndefined()
  })
})
