import { describe, expect, it } from 'vitest'
import {
  EMPTY_VALUE,
  EXPIRED_UNFINISHED_LABEL,
  barPercent,
  deviceLabel,
  formatConfidence,
  formatPercent,
  outcomeLabel,
} from './adminView'

describe('ค่า null แสดงเป็น "-" ไม่ใช่ 0', () => {
  it('อัตราความพอใจ', () => {
    expect(formatPercent(null)).toBe(EMPTY_VALUE)
    expect(formatPercent(0)).toBe('0.0%') // 0 จริง ต่างจาก null
    expect(formatPercent(0.75)).toBe('75.0%')
    expect(formatPercent(0.8333)).toBe('83.3%')
  })

  it('ความมั่นใจเฉลี่ย', () => {
    expect(formatConfidence(null)).toBe(EMPTY_VALUE)
    expect(formatConfidence(0)).toBe('0.000')
    expect(formatConfidence(0.712)).toBe('0.712')
  })
})

describe('ป้าย', () => {
  it('ใช้คำว่า "เดินค้างแล้วหมดอายุ" ไม่ใช่ abandoned/ยกเลิก', () => {
    expect(EXPIRED_UNFINISHED_LABEL).toBe('เดินค้างแล้วหมดอายุ')
    expect(EXPIRED_UNFINISHED_LABEL).not.toMatch(/abandon|ยกเลิก/i)
  })

  it('ประเภทเครื่อง/ผลที่ไม่รู้จัก (ผังหาย) บอกตรงๆ ไม่เดา', () => {
    expect(deviceLabel('Microwave')).toBe('เตาไมโครเวฟ')
    expect(deviceLabel(null)).toContain('ไม่ทราบ')
    expect(deviceLabel('unknown')).toContain('ไม่ทราบ')
    expect(outcomeLabel('unknown')).toContain('ไม่ทราบ')
    expect(outcomeLabel('user_fixed')).toBe('แก้ได้แล้ว')
  })
})

describe('barPercent', () => {
  it('สัดส่วนต่อค่ามากสุด · 0 ไม่มีแท่ง · ค่าเล็กยังเห็นแท่ง', () => {
    expect(barPercent(50, 100)).toBe(50)
    expect(barPercent(100, 100)).toBe(100)
    expect(barPercent(0, 100)).toBe(0)
    expect(barPercent(1, 1000)).toBe(2)
    expect(barPercent(5, 0)).toBe(0)
  })
})
