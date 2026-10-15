import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/http'
import { describeError } from './errors'
import {
  MAX_FEEDBACK_COMMENT_LENGTH,
  checkComment,
  formatCommentCounter,
  isSameFeedback,
  normalizeComment,
  toFeedback,
} from './feedback'

describe('MAX_FEEDBACK_COMMENT_LENGTH', () => {
  it('เพดาน 500 ตัวอักษร ตรงกับที่ backend รับ (ค่าที่ตกลงไว้)', () => {
    expect(MAX_FEEDBACK_COMMENT_LENGTH).toBe(500)
  })
})

describe('toFeedback: สิ่งที่ส่งไปเซิร์ฟเวอร์', () => {
  it('ไม่ใส่ข้อความ → comment เป็น null (ไม่ใช่สตริงว่าง)', () => {
    expect(toFeedback(true, '')).toEqual({ helpful: true, comment: null })
    expect(toFeedback(false, '   ')).toEqual({ helpful: false, comment: null })
  })

  it('ตัดช่องว่างหน้าหลัง และคงข้อความที่เหลือ', () => {
    expect(toFeedback(false, '  ทำตามแล้วยังไม่หาย  ')).toEqual({ helpful: false, comment: 'ทำตามแล้วยังไม่หาย' })
  })
})

describe('checkComment', () => {
  it('ว่างก็ส่งได้ (ไม่บังคับ)', () => {
    expect(checkComment('')).toBe('ok')
    expect(checkComment('   ')).toBe('ok')
  })

  it('500 ตัวผ่าน 501 ตัวไม่ผ่าน (นับหลังตัดช่องว่างหน้าหลัง)', () => {
    expect(checkComment('ก'.repeat(500))).toBe('ok')
    expect(checkComment('ก'.repeat(501))).toBe('too-long')
    expect(checkComment(`  ${'ก'.repeat(500)}  `)).toBe('ok')
  })
})

describe('isSameFeedback: ไว้ขึ้น "บันทึกแล้ว" และปิดปุ่มบันทึกเมื่อไม่มีอะไรเปลี่ยน', () => {
  const saved = { helpful: true, comment: 'ดีมาก' }

  it('ยังไม่เคยบันทึก หรือยังไม่ได้เลือก 👍/👎 → ไม่ตรง', () => {
    expect(isSameFeedback(null, true, 'ดีมาก')).toBe(false)
    expect(isSameFeedback(saved, null, 'ดีมาก')).toBe(false)
  })

  it('ค่าเท่ากัน (ช่องว่างหน้าหลังไม่นับ) → ตรง', () => {
    expect(isSameFeedback(saved, true, 'ดีมาก')).toBe(true)
    expect(isSameFeedback(saved, true, '  ดีมาก ')).toBe(true)
  })

  it('เปลี่ยน 👍/👎 หรือข้อความ → ไม่ตรง', () => {
    expect(isSameFeedback(saved, false, 'ดีมาก')).toBe(false)
    expect(isSameFeedback(saved, true, 'ดีมากๆ')).toBe(false)
    expect(isSameFeedback(saved, true, '')).toBe(false)
  })

  it('บันทึกไว้โดยไม่มีข้อความ (null) ตรงกับช่องว่าง', () => {
    expect(isSameFeedback({ helpful: false, comment: null }, false, '')).toBe(true)
    expect(isSameFeedback({ helpful: false, comment: null }, false, '   ')).toBe(true)
  })
})

describe('ตัวช่วยอื่น', () => {
  it('normalizeComment ตัดช่องว่างหน้าหลัง · counter นับตามที่พิมพ์จริง', () => {
    expect(normalizeComment('  x ')).toBe('x')
    expect(formatCommentCounter('สวัสดี')).toBe('6/500')
  })
})

describe('describeError: INVALID_FEEDBACK', () => {
  it('บอกเพดาน 500 และให้แก้แล้วบันทึกใหม่ (อยู่ขั้นเดิม)', () => {
    const described = describeError(new ApiError(400, 'INVALID_FEEDBACK', 'comment ยาวเกิน'))

    expect(described.detail).toContain('500')
    expect(described.recovery).toBe('stay')
  })
})
