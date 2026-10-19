export const MAX_OUTCOME_LENGTH = 1000

export function normalizeOutcome(raw: string): string {
  return raw.trim()
}

type OutcomeCheck = 'ok' | 'empty' | 'too-long'

export function checkOutcome(raw: string): OutcomeCheck {
  const text = normalizeOutcome(raw)
  if (text === '') return 'empty'
  if (text.length > MAX_OUTCOME_LENGTH) return 'too-long'
  return 'ok'
}

export function formatOutcomeCounter(raw: string): string {
  return `${raw.length}/${MAX_OUTCOME_LENGTH}`
}
