import { describe, expect, it } from 'vitest'
import type { HistoryParams } from '../api/types'
import {
  DEFAULT_HISTORY_PARAMS,
  applyPatch,
  clearFilters,
  hasActiveFilters,
  MAX_HISTORY_SEARCH_LENGTH,
  parseHistoryParams,
  toSearchParams,
} from './historyParams'

function parse(query: string): HistoryParams {
  return parseHistoryParams(new URLSearchParams(query))
}

describe('parseHistoryParams', () => {
  it('ไม่มี query: ค่าเริ่มต้น (ใหม่สุดก่อน หน้า 1 ไม่มีตัวกรอง)', () => {
    expect(parse('')).toEqual(DEFAULT_HISTORY_PARAMS)
  })

  it('อ่านค่าที่ถูกต้องครบ', () => {
    expect(parse('q=%E0%B9%81%E0%B8%AD%E0%B8%A3%E0%B9%8C&category=Refrigerator&brand=Samsung&status=handoff_unknown&sort=oldest&page=3')).toEqual({
      q: 'แอร์',
      category: 'Refrigerator',
      brand: 'Samsung',
      status: 'handoff_unknown',
      sort: 'oldest',
      page: 3,
    })
  })

  it('ค่าที่ไม่รู้จัก (พิมพ์ URL เอง) ถูกปัดทิ้งเป็นค่าเริ่มต้น ไม่ส่งต่อไปเซิร์ฟเวอร์', () => {
    expect(parse('category=Toaster&status=done&sort=random&page=abc')).toEqual(DEFAULT_HISTORY_PARAMS)
  })

  it.each(['0', '-1', '1.5', '', 'NaN', '99999999999999999999'])('page=%s → หน้า 1', (page) => {
    expect(parse(`page=${page}`).page).toBe(1)
  })

  it('ตัดช่องว่างหน้าหลัง และตัดคำค้นที่ยาวเกิน', () => {
    expect(parse('q=%20%20x%20%20').q).toBe('x')
    expect(parse(`q=${'a'.repeat(MAX_HISTORY_SEARCH_LENGTH + 50)}`).q).toHaveLength(MAX_HISTORY_SEARCH_LENGTH)
    expect(parse('brand=%20').brand).toBeUndefined()
  })
})

describe('toSearchParams', () => {
  it('ค่าเริ่มต้นไม่ถูกเขียนลง URL', () => {
    expect(toSearchParams(DEFAULT_HISTORY_PARAMS).toString()).toBe('')
  })

  it('เขียนกลับแล้วอ่านได้ค่าเดิม (round trip)', () => {
    const params: HistoryParams = {
      q: 'น้ำไม่ไหล',
      category: 'Washing Machine',
      brand: 'Samsung',
      status: 'user_fixed',
      sort: 'oldest',
      page: 4,
    }
    expect(parseHistoryParams(toSearchParams(params))).toEqual(params)
  })

  it('page=1 และ sort=newest ไม่ถูกเขียน', () => {
    const search = toSearchParams({ ...DEFAULT_HISTORY_PARAMS, status: 'user_fixed' })
    expect(search.toString()).toBe('status=user_fixed')
  })
})

describe('applyPatch', () => {
  const onPage3: HistoryParams = { ...DEFAULT_HISTORY_PARAMS, page: 3, status: 'user_fixed' }

  it('แก้ตัวกรอง/การเรียง → กลับหน้า 1', () => {
    expect(applyPatch(onPage3, { brand: 'LG' }).page).toBe(1)
    expect(applyPatch(onPage3, { sort: 'oldest' }).page).toBe(1)
    expect(applyPatch(onPage3, { q: 'แอร์' }).page).toBe(1)
  })

  it('เปลี่ยนหน้าอย่างเดียว → คงตัวกรองเดิม', () => {
    expect(applyPatch(onPage3, { page: 4 })).toEqual({ ...onPage3, page: 4 })
  })

  it('ล้างตัวกรองรายตัวด้วย undefined', () => {
    expect(applyPatch(onPage3, { status: undefined }).status).toBeUndefined()
  })
})

describe('hasActiveFilters / clearFilters', () => {
  it('การเรียงและหน้าไม่นับเป็นตัวกรอง', () => {
    expect(hasActiveFilters({ ...DEFAULT_HISTORY_PARAMS, sort: 'oldest', page: 5 })).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_HISTORY_PARAMS, q: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_HISTORY_PARAMS, category: 'Television' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_HISTORY_PARAMS, brand: 'LG' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_HISTORY_PARAMS, status: 'handoff_informed' })).toBe(true)
  })

  it('ล้างตัวกรองทั้งหมด คงการเรียงไว้ กลับหน้า 1', () => {
    const cleared = clearFilters({ q: 'x', category: 'Television', brand: 'LG', status: 'user_fixed', sort: 'oldest', page: 3 })
    expect(cleared).toEqual({ ...DEFAULT_HISTORY_PARAMS, sort: 'oldest' })
  })
})
