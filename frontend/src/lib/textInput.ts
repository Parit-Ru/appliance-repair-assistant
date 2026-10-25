import type { HistoryFeedback } from '../api/types'

export const MAX_QUERY_LENGTH = 200

// ตัดช่องว่างหน้าหลัง
export function normalizeQuery(raw: string): string {
  return raw.trim()
}

type QueryCheck = 'ok' | 'empty' | 'too-long'

export function checkQuery(raw: string): QueryCheck {
  const query = normalizeQuery(raw)
  if (query === '') return 'empty'
  if (query.length > MAX_QUERY_LENGTH) return 'too-long'
  return 'ok'
}

export function formatScore(score: number): string {
  return score.toFixed(3)
}

export const MAX_FEEDBACK_COMMENT_LENGTH = 500

function normalizeComment(raw: string): string {
  return raw.trim()
}

type CommentCheck = 'ok' | 'too-long'

export function checkComment(raw: string): CommentCheck {
  return normalizeComment(raw).length > MAX_FEEDBACK_COMMENT_LENGTH ? 'too-long' : 'ok'
}

export function formatCommentCounter(raw: string): string {
  return `${raw.length}/${MAX_FEEDBACK_COMMENT_LENGTH}`
}

export function toFeedback(helpful: boolean, rawComment: string): HistoryFeedback {
  const comment = normalizeComment(rawComment)
  return { helpful, comment: comment === '' ? null : comment }
}

export function isSameFeedback(saved: HistoryFeedback | null, helpful: boolean | null, rawComment: string): boolean {
  if (saved === null || helpful === null) return false
  const current = toFeedback(helpful, rawComment)
  return saved.helpful === current.helpful && (saved.comment ?? null) === current.comment
}
