import { describe, expect, it } from 'vitest'
import {
  feedbackToSearchParams,
  hasFeedbackFilters,
  parseFeedbackParams,
  parseSummaryDays,
  patchFeedbackParams,
} from './adminParams'

const q = (query: string) => new URLSearchParams(query)

describe('parseFeedbackParams', () => {
  it('ค่าเริ่มต้น', () => {
    expect(parseFeedbackParams(q(''))).toEqual({ helpful: undefined, from: undefined, to: undefined, page: 1 })
  })

  it('อ่านตัวกรองทั้งหมด', () => {
    expect(parseFeedbackParams(q('helpful=false&from=2026-10-01&to=2026-10-16&page=3'))).toEqual({
      helpful: false,
      from: '2026-10-01',
      to: '2026-10-16',
      page: 3,
    })
  })

  it('ค่าผิดรูปแบบถูกเมิน ไม่ทำให้ล้ม', () => {
    expect(parseFeedbackParams(q('helpful=maybe&from=01/10/2026&to=2026-13-40&page=-2'))).toEqual({
      helpful: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    })
    expect(parseFeedbackParams(q('page=1.5')).page).toBe(1)
    expect(parseFeedbackParams(q('page=abc')).page).toBe(1)
  })
})

describe('feedbackToSearchParams', () => {
  it('ไม่ใส่ค่าเริ่มต้น · round-trip ได้', () => {
    expect(feedbackToSearchParams({ page: 1 }).toString()).toBe('')
    const params = { helpful: true, from: '2026-10-01', to: '2026-10-02', page: 2 }
    expect(parseFeedbackParams(feedbackToSearchParams(params))).toEqual(params)
  })
})

describe('patchFeedbackParams', () => {
  const current = { helpful: true, page: 4 }

  it('เปลี่ยนตัวกรอง → กลับหน้า 1', () => {
    expect(patchFeedbackParams(current, { helpful: false }).page).toBe(1)
    expect(patchFeedbackParams(current, { from: '2026-10-01' }).page).toBe(1)
    expect(patchFeedbackParams(current, { helpful: undefined }).page).toBe(1)
  })

  it('เปลี่ยนหน้าอย่างเดียว → คงตัวกรอง', () => {
    expect(patchFeedbackParams(current, { page: 5 })).toEqual({ helpful: true, page: 5 })
  })
})

describe('hasFeedbackFilters', () => {
  it('true เมื่อมีตัวกรองอย่างใดอย่างหนึ่ง (false ก็นับ)', () => {
    expect(hasFeedbackFilters({ page: 1 })).toBe(false)
    expect(hasFeedbackFilters({ helpful: false, page: 1 })).toBe(true)
    expect(hasFeedbackFilters({ to: '2026-10-01', page: 1 })).toBe(true)
  })
})

describe('parseSummaryDays', () => {
  it('รับ 7/30/90 · อื่นๆ = 30', () => {
    expect(parseSummaryDays(q('days=7'))).toBe(7)
    expect(parseSummaryDays(q('days=90'))).toBe(90)
    expect(parseSummaryDays(q(''))).toBe(30)
    expect(parseSummaryDays(q('days=91'))).toBe(30)
    expect(parseSummaryDays(q('days=abc'))).toBe(30)
  })
})
