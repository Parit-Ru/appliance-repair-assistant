import { describe, expect, it } from 'vitest'
import { MAX_QUERY_LENGTH, checkQuery, formatScore, normalizeQuery } from './search'

describe('normalizeQuery', () => {
  it('ตัดช่องว่างหน้าหลัง แต่ไม่แตะช่องว่างกลางข้อความ', () => {
    expect(normalizeQuery('  แอร์ ไม่เย็น \n')).toBe('แอร์ ไม่เย็น')
  })
})

describe('checkQuery', () => {
  it('ข้อความปกติ ค้นหาได้', () => {
    expect(checkQuery('แอร์ไม่เย็น')).toBe('ok')
  })

  it('ว่างหรือมีแต่ช่องว่าง ค้นหาไม่ได้', () => {
    expect(checkQuery('')).toBe('empty')
    expect(checkQuery('   \t\n')).toBe('empty')
  })

  it('ยาวพอดีขีดจำกัด ยังค้นได้ เกินหนึ่งตัวอักษรค้นไม่ได้', () => {
    expect(checkQuery('ก'.repeat(MAX_QUERY_LENGTH))).toBe('ok')
    expect(checkQuery('ก'.repeat(MAX_QUERY_LENGTH + 1))).toBe('too-long')
  })

  it('นับความยาวหลังตัดช่องว่าง เหมือนเซิร์ฟเวอร์', () => {
    // ช่องว่างหน้าหลังไม่นับ จึงไม่ทำให้ข้อความที่ยาวพอดีขีดจำกัดกลายเป็นยาวเกิน
    expect(checkQuery(`  ${'ก'.repeat(MAX_QUERY_LENGTH)}  `)).toBe('ok')
  })
})

describe('formatScore', () => {
  it('แสดงทศนิยม 3 ตำแหน่งเสมอ', () => {
    expect(formatScore(0.812)).toBe('0.812')
    expect(formatScore(0.8)).toBe('0.800')
    expect(formatScore(1)).toBe('1.000')
  })
})
