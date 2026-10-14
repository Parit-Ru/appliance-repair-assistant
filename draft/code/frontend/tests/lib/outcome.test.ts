import { describe, expect, it } from 'vitest'
import {
  MAX_OUTCOME_LENGTH,
  checkOutcome,
  formatOutcomeCounter,
  normalizeOutcome,
} from './outcome'

describe('normalizeOutcome', () => {
  it('ตัดช่องว่างหน้าหลัง แต่ไม่แตะช่องว่างและการขึ้นบรรทัดใหม่กลางข้อความ', () => {
    expect(normalizeOutcome('  แก้ได้แล้ว\nแอร์เย็นปกติ \n')).toBe('แก้ได้แล้ว\nแอร์เย็นปกติ')
  })
})

describe('checkOutcome', () => {
  it('ข้อความปกติ บันทึกได้', () => {
    expect(checkOutcome('ทำตามขั้นตอนแล้วแอร์กลับมาทำงานปกติ')).toBe('ok')
  })

  it('ว่างหรือมีแต่ช่องว่าง/ขึ้นบรรทัดใหม่ บันทึกไม่ได้', () => {
    expect(checkOutcome('')).toBe('empty')
    expect(checkOutcome('   \t\n')).toBe('empty')
  })

  it('ยาวพอดีเพดาน ยังบันทึกได้ เกินหนึ่งตัวอักษรบันทึกไม่ได้', () => {
    expect(checkOutcome('ก'.repeat(MAX_OUTCOME_LENGTH))).toBe('ok')
    expect(checkOutcome('ก'.repeat(MAX_OUTCOME_LENGTH + 1))).toBe('too-long')
  })

  it('นับความยาวหลังตัดช่องว่าง เหมือนเซิร์ฟเวอร์', () => {
    // ช่องว่างหน้าหลังไม่นับ จึงไม่ทำให้ข้อความที่ยาวพอดีเพดานกลายเป็นยาวเกิน
    expect(checkOutcome(`  ${'ก'.repeat(MAX_OUTCOME_LENGTH)}\n`)).toBe('ok')
  })

  it('เพดานเท่ากับของ backend (1000) — ถ้าฝั่งนั้นเปลี่ยน เทสนี้เตือนให้แก้ที่นี่ด้วย', () => {
    expect(MAX_OUTCOME_LENGTH).toBe(1000)
  })

  it('ไม่ตรวจเนื้อหา: ข้อความที่ดูเหมือน HTML หรือสคริปต์ผ่านเหมือนข้อความอื่น (หน้าจอแสดงเป็น text เฉยๆ)', () => {
    expect(checkOutcome('<script>alert(1)</script>')).toBe('ok')
  })
})

describe('formatOutcomeCounter', () => {
  it('แสดงจำนวนที่พิมพ์ต่อเพดาน', () => {
    expect(formatOutcomeCounter('')).toBe('0/1000')
    expect(formatOutcomeCounter('แอร์เย็นแล้ว')).toBe('12/1000')
  })

  it('นับตามที่พิมพ์จริง รวมช่องว่าง เพื่อเทียบกับ maxLength ของช่อง', () => {
    expect(formatOutcomeCounter('  ก  ')).toBe('5/1000')
  })
})
