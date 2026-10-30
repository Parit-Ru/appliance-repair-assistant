import type { HistoryFeedback } from '../api/types'

export const MAX_QUERY_LENGTH = 200
export const MAX_OUTCOME_LENGTH = 1000
export const MAX_FEEDBACK_COMMENT_LENGTH = 500

type TextCheck = 'ok' | 'empty' | 'too-long'

/** ตัดช่องว่างหน้าหลังแล้วตรวจว่าว่างหรือยาวเกิน max (ใช้กับช่องค้นหา ช่องบันทึกผล และช่องความเห็น) */
export function checkText(raw: string, max: number): TextCheck {
  const text = raw.trim()
  if (text === '') return 'empty'
  if (text.length > max) return 'too-long'
  return 'ok'
}

/** ตัวนับใต้ช่องกรอก เช่น "12/500" (นับตามที่พิมพ์ ไม่ตัดช่องว่าง) */
export function formatCounter(raw: string, max: number): string {
  return `${raw.length}/${max}`
}

export function formatScore(score: number): string {
  return score.toFixed(3)
}

export function toFeedback(helpful: boolean, rawComment: string): HistoryFeedback {
  const comment = rawComment.trim()
  return { helpful, comment: comment === '' ? null : comment }
}

export function isSameFeedback(saved: HistoryFeedback | null, helpful: boolean | null, rawComment: string): boolean {
  if (saved === null || helpful === null) return false
  const current = toFeedback(helpful, rawComment)
  return saved.helpful === current.helpful && (saved.comment ?? null) === current.comment
}
