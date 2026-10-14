import { describe, expect, it } from 'vitest'
import { describeError } from './errors'
import { ApiError } from '../api/http'

// ข้อความของเซิร์ฟเวอร์เขียนไว้ให้นักพัฒนาอ่าน ห้ามหลุดไปถึงผู้ใช้
// ใส่คำนี้ไว้ในทุกเคส แล้วตรวจว่าไม่โผล่ในหัวข้อหรือคำอธิบาย
const SERVER_MESSAGE = 'ข้อความภายในสำหรับนักพัฒนา'

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, code, SERVER_MESSAGE)
}

describe('describeError — ข้อผิดพลาดที่ระบบรู้จัก', () => {
  it('ต่อเซิร์ฟเวอร์ไม่ได้ ให้ลองใหม่', () => {
    const result = describeError(apiError(0, 'NETWORK_ERROR'))
    expect(result.title).toBe('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    expect(result.recovery).toBe('retry')
  })

  it('ข้ามคำเตือน ให้อยู่ขั้นเดิม', () => {
    const result = describeError(apiError(400, 'SAFETY_CONFIRMATION_REQUIRED'))
    expect(result.title).toBe('เซิร์ฟเวอร์ไม่ให้ข้ามขั้นตอนนี้')
    expect(result.recovery).toBe('stay')
  })

  it('คำสั่งไม่ตรงกับขั้นปัจจุบัน ให้ดึงสถานะล่าสุดมาใหม่', () => {
    const result = describeError(apiError(400, 'INVALID_ACTION'))
    expect(result.title).toBe('หน้าจอไม่ตรงกับเซิร์ฟเวอร์')
    expect(result.recovery).toBe('reload-session')
  })

  it('การตรวจจบไปแล้ว ให้ดึงสถานะล่าสุดมาใหม่', () => {
    const result = describeError(apiError(409, 'SESSION_COMPLETED'))
    expect(result.title).toBe('การตรวจนี้จบไปแล้ว')
    expect(result.recovery).toBe('reload-session')
  })

  it('ไม่พบการตรวจ ให้กลับไปเลือกอาการ', () => {
    const result = describeError(apiError(404, 'SESSION_NOT_FOUND'))
    expect(result.title).toBe('ไม่พบการตรวจนี้')
    expect(result.recovery).toBe('back-to-symptoms')
  })

  it('ไม่พบผังขั้นตอน ให้กลับไปเลือกอาการ', () => {
    const result = describeError(apiError(404, 'GRAPH_NOT_FOUND'))
    expect(result.title).toBe('ไม่พบอาการนี้')
    expect(result.recovery).toBe('back-to-symptoms')
  })
})

describe('describeError — ค้นหาอาการ', () => {
  it('คำค้นใช้ไม่ได้ (400 INVALID_QUERY) ให้แก้ข้อความแล้วค้นใหม่ ไม่ต้องทำอะไรเพิ่ม', () => {
    const result = describeError(apiError(400, 'INVALID_QUERY'))
    expect(result.title).toBe('ข้อความที่พิมพ์ใช้ค้นหาไม่ได้')
    expect(result.recovery).toBe('stay')
  })

  it('ระบบค้นหากำลังโหลด (503 SEARCH_NOT_READY) ให้รอแล้วลองใหม่', () => {
    const result = describeError(apiError(503, 'SEARCH_NOT_READY'))
    expect(result.title).toBe('ระบบค้นหากำลังเริ่มทำงาน')
    expect(result.recovery).toBe('retry')
  })

  it('ระบบค้นหาปิดอยู่ (503 SEARCH_UNAVAILABLE) ให้ใช้หน้าอาการทั้งหมดแทน ไม่ใช่ลองใหม่', () => {
    // รอแล้วก็ไม่หาย ถ้าบอกให้ลองใหม่ ผู้ใช้จะกดซ้ำโดยไม่มีวันสำเร็จ
    const result = describeError(apiError(503, 'SEARCH_UNAVAILABLE'))
    expect(result.title).toBe('ระบบค้นหาไม่พร้อมใช้งานตอนนี้')
    expect(result.detail).toContain('อาการทั้งหมด')
    expect(result.recovery).toBe('stay')
  })

  it('400 ที่ไม่มี code (JSON ผิดไวยากรณ์ Express ตอบเอง) ไม่ขึ้นว่า "ระบบไม่รู้จัก"', () => {
    const result = describeError(apiError(400, 'UNKNOWN_ERROR'))
    expect(result.title).toBe('เซิร์ฟเวอร์อ่านคำขอไม่ได้')
    expect(result.recovery).toBe('retry')
  })
})

describe('describeError — บันทึกผลลัพธ์', () => {
  it('ข้อความใช้ไม่ได้ (400 INVALID_OUTCOME) ให้แก้ข้อความแล้วบันทึกใหม่ บอกเพดานความยาว', () => {
    const result = describeError(apiError(400, 'INVALID_OUTCOME'))
    expect(result.title).toBe('ข้อความผลลัพธ์บันทึกไม่ได้')
    expect(result.detail).toContain('1000')
    expect(result.recovery).toBe('stay')
  })

  it('การตรวจยังไม่จบ (409 SESSION_NOT_COMPLETED) ให้ดึงสถานะล่าสุดมาใหม่', () => {
    const result = describeError(apiError(409, 'SESSION_NOT_COMPLETED'))
    expect(result.title).toBe('การตรวจนี้ยังไม่จบ')
    expect(result.recovery).toBe('reload-session')
  })

  it('บันทึกไปแล้ว (409 OUTCOME_ALREADY_SUBMITTED) ให้ดึงข้อความที่บันทึกไว้มาดู ไม่ใช่ลองส่งใหม่', () => {
    // ลองส่งใหม่ได้ 409 เดิมซ้ำเสมอ ผู้ใช้ต้องได้ทางไปดูของที่บันทึกไว้
    const result = describeError(apiError(409, 'OUTCOME_ALREADY_SUBMITTED'))
    expect(result.title).toBe('การตรวจนี้บันทึกผลไปแล้ว')
    expect(result.recovery).toBe('reload-session')
  })

  it('ไม่ปนกับรหัสเดิมที่คล้ายกัน: SESSION_COMPLETED ของ /actions ยังเป็นข้อความเดิม', () => {
    expect(describeError(apiError(409, 'SESSION_COMPLETED')).title).toBe('การตรวจนี้จบไปแล้ว')
    expect(describeError(apiError(400, 'INVALID_ACTION')).title).toBe('หน้าจอไม่ตรงกับเซิร์ฟเวอร์')
  })
})

describe('describeError — ข้อมูลขั้นตอนไม่สมบูรณ์ (500)', () => {
  // สองรหัสนี้หมายถึงข้อมูลในฐานข้อมูลผิด ผู้ใช้แก้เองไม่ได้
  // จึงแสดงรหัสไว้ให้แจ้งผู้ดูแลระบบ
  it.each(['GRAPH_NODE_MISSING', 'GRAPH_SCHEMA_UNSUPPORTED'])(
    '%s แสดงรหัส แล้วให้กลับไปเลือกอาการ',
    (code) => {
      const result = describeError(apiError(500, code))
      expect(result.title).toBe('ข้อมูลขั้นตอนของอาการนี้ไม่สมบูรณ์')
      expect(result.recovery).toBe('back-to-symptoms')
      expect(result.code).toBe(code)
    },
  )
})

describe('describeError — ข้อผิดพลาดที่ระบบไม่รู้จัก', () => {
  const UNKNOWN_TITLE = 'เกิดข้อผิดพลาดที่ระบบไม่รู้จัก'

  it('ApiError รหัสอื่น ให้ลองใหม่', () => {
    const result = describeError(apiError(500, 'UNKNOWN_ERROR'))
    expect(result.title).toBe(UNKNOWN_TITLE)
    expect(result.recovery).toBe('retry')
  })

  it('Error ธรรมดาที่ไม่ใช่ ApiError ให้ลองใหม่', () => {
    const result = describeError(new Error(SERVER_MESSAGE))
    expect(result.title).toBe(UNKNOWN_TITLE)
    expect(result.recovery).toBe('retry')
  })

  it('ค่าที่ไม่ใช่ Error เลย ก็ไม่พัง', () => {
    expect(describeError('ข้อความเฉยๆ').title).toBe(UNKNOWN_TITLE)
    expect(describeError(undefined).title).toBe(UNKNOWN_TITLE)
    expect(describeError(null).title).toBe(UNKNOWN_TITLE)
  })
})

describe('describeError — กติการ่วม', () => {
  const ALL_CASES: unknown[] = [
    apiError(0, 'NETWORK_ERROR'),
    apiError(400, 'SAFETY_CONFIRMATION_REQUIRED'),
    apiError(400, 'INVALID_ACTION'),
    apiError(409, 'SESSION_COMPLETED'),
    apiError(404, 'SESSION_NOT_FOUND'),
    apiError(404, 'GRAPH_NOT_FOUND'),
    apiError(400, 'INVALID_QUERY'),
    apiError(503, 'SEARCH_NOT_READY'),
    apiError(503, 'SEARCH_UNAVAILABLE'),
    apiError(400, 'INVALID_OUTCOME'),
    apiError(409, 'SESSION_NOT_COMPLETED'),
    apiError(409, 'OUTCOME_ALREADY_SUBMITTED'),
    apiError(400, 'UNKNOWN_ERROR'),
    apiError(500, 'GRAPH_NODE_MISSING'),
    apiError(500, 'GRAPH_SCHEMA_UNSUPPORTED'),
    apiError(500, 'UNKNOWN_ERROR'),
    new Error(SERVER_MESSAGE),
  ]

  it('ทุกกรณีมีคำอธิบาย และไม่เอาข้อความของเซิร์ฟเวอร์มาแสดง', () => {
    for (const error of ALL_CASES) {
      const result = describeError(error)
      expect(result.detail.length).toBeGreaterThan(0)
      expect(result.title).not.toContain(SERVER_MESSAGE)
      expect(result.detail).not.toContain(SERVER_MESSAGE)
    }
  })

  it('แสดงรหัสเฉพาะกรณีข้อมูลขั้นตอนไม่สมบูรณ์เท่านั้น', () => {
    const withCode = ALL_CASES.filter((error) => describeError(error).code !== undefined)
    expect(withCode).toHaveLength(2)
  })
})