import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startSession } from '../api/traversal'
import { modelSelectionFromState, otherSymptomsPath, restartVariables, startOptions } from './modelSelection'

/** ดักสิ่งที่ส่งไปเซิร์ฟเวอร์จริงๆ (ผ่าน request → fetch) เพื่อดูว่า body มี/ไม่มี modelSelection */
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://api.test')
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ sessionId: 's_new' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function sentBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as RequestInit
  return JSON.parse(init.body as string) as Record<string, unknown>
}

describe('startOptions: เริ่มตรวจจากหน้ารายการอาการ', () => {
  it('ดูรายการทุกรุ่น (ไม่มี ?manual=): ส่งแค่ manualId ของอาการที่กด ไม่มีคีย์ modelSelection', () => {
    // useChosenModel คืน 'selected' เป็นค่าเริ่มต้นเมื่อไม่มี ?unknown=1 ต้องไม่หลุดไปกับการเริ่มตรวจ
    const options = startOptions({ manualId: undefined, modelSelection: 'selected' }, 'm_ac')
    expect(options).toEqual({ manualId: 'm_ac' })
    expect('modelSelection' in options).toBe(false)
  })

  it('มีรุ่นที่เลือกไว้: ส่งรุ่นนั้นและ modelSelection ตามที่เลือก', () => {
    expect(startOptions({ manualId: 'm_wt', modelSelection: 'selected' }, 'm_wt')).toEqual({ manualId: 'm_wt', modelSelection: 'selected' })
    expect(startOptions({ manualId: 'm_wt', modelSelection: 'unknown' }, 'm_wt')).toEqual({ manualId: 'm_wt', modelSelection: 'unknown' })
  })

  it('ข้อมูลที่ส่งถึงเซิร์ฟเวอร์ (POST /traversal/sessions): มี manualId และไม่มี modelSelection', async () => {
    await startSession('g_ac_1', startOptions({ manualId: undefined, modelSelection: 'selected' }, 'm_ac'))

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/traversal/sessions')
    expect(sentBody()).toEqual({ graphId: 'g_ac_1', manualId: 'm_ac' })
    expect('modelSelection' in sentBody()).toBe(false)
  })

  it('เลือกรุ่นจากหน้าเลือกรุ่น: ข้อมูลที่ส่งมี modelSelection ตามที่เลือก', async () => {
    await startSession('g_wt_1', startOptions({ manualId: 'm_wt', modelSelection: 'unknown' }, 'm_wt'))
    expect(sentBody()).toEqual({ graphId: 'g_wt_1', manualId: 'm_wt', modelSelection: 'unknown' })
  })
})

describe('modelSelectionFromState: อ่านค่าจาก navigate state', () => {
  const cases: Array<[unknown, 'selected' | 'unknown' | undefined, string]> = [
    [{ modelSelection: 'selected' }, 'selected', 'เลือกรุ่นเอง'],
    [{ modelSelection: 'unknown' }, 'unknown', 'ไม่ทราบรุ่น'],
    [undefined, undefined, 'ไม่มี state (แท็บใหม่) ต้องเป็น undefined ไม่ใช่ selected'],
    [null, undefined, 'state เป็น null'],
    [{}, undefined, 'state ว่าง'],
    [{ modelSelection: undefined }, undefined, 'เริ่มจากรายการทุกรุ่น (useStartSymptom ส่ง undefined)'],
    [{ modelSelection: 'อะไรก็ไม่รู้' }, undefined, 'ค่าที่ไม่รู้จักไม่ถูกเชื่อ'],
  ]
  for (const [state, expected, why] of cases) {
    it(`${JSON.stringify(state)} → ${String(expected)} (${why})`, () => {
      expect(modelSelectionFromState(state)).toBe(expected)
    })
  }
})

describe('restartVariables: "เริ่มอาการนี้ใหม่" ต้องคงค่า modelSelection เดิม', () => {
  /** จำลองสิ่งที่ useStartSession ทำกับตัวแปร: แยก graphId ออก ส่งที่เหลือเป็น options */
  async function restart(state: unknown) {
    const { graphId, ...options } = restartVariables('g_ac_1', 'm_ac', modelSelectionFromState(state))
    await startSession(graphId, options)
  }

  it('เริ่มจากรายการทุกรุ่น (ไม่มีค่า): เริ่มใหม่แล้วยังไม่มี modelSelection ไม่กลายเป็น selected', async () => {
    await restart({ modelSelection: undefined })
    expect(sentBody()).toEqual({ graphId: 'g_ac_1', manualId: 'm_ac' })
    expect('modelSelection' in sentBody()).toBe(false)
  })

  it('เปิดลิงก์ session ในแท็บใหม่ (state หาย): ไม่เติมเป็น selected', async () => {
    await restart(undefined)
    expect('modelSelection' in sentBody()).toBe(false)
  })

  it('ไม่ทราบรุ่น: เริ่มใหม่แล้วยังเป็น unknown', async () => {
    await restart({ modelSelection: 'unknown' })
    expect(sentBody()).toEqual({ graphId: 'g_ac_1', manualId: 'm_ac', modelSelection: 'unknown' })
  })

  it('เลือกรุ่นเอง: เริ่มใหม่แล้วยังเป็น selected', async () => {
    await restart({ modelSelection: 'selected' })
    expect(sentBody()).toEqual({ graphId: 'g_ac_1', manualId: 'm_ac', modelSelection: 'selected' })
  })
})

describe('otherSymptomsPath: "ตรวจอาการอื่น"', () => {
  it('เริ่มจากรายการทุกรุ่น → กลับรายการทุกรุ่น (ไม่พาไปหน้าของรุ่นที่จะกลายเป็น selected)', () => {
    expect(otherSymptomsPath('m_ac', undefined)).toBe('/symptoms/all')
  })
  it('เลือกรุ่นแล้ว → หน้าเลือกอาการของรุ่นเดิม พก unknown=1 ถ้าไม่ทราบรุ่น', () => {
    expect(otherSymptomsPath('m_ac', 'selected')).toBe('/symptoms?manual=m_ac')
    expect(otherSymptomsPath('m_ac', 'unknown')).toBe('/symptoms?manual=m_ac&unknown=1')
  })
  it('ยังไม่รู้รุ่น (รายการผังยังโหลดไม่เสร็จ) → หน้าเลือกเครื่อง', () => {
    expect(otherSymptomsPath(undefined, 'selected')).toBe('/devices')
  })
})
