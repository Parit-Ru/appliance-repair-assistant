import type { ManualSummary } from '../api/types'

function normalizeModel(text: string): string {
  return text.toUpperCase().replace(/[\s\-_]/g, '')
}

function matchesPattern(input: string, pattern: string): boolean {
  const a = normalizeModel(input)
  const p = normalizeModel(pattern)
  if (a === '' || p === '') return false

  const length = Math.min(a.length, p.length)
  for (let i = 0; i < length; i += 1) {
    if (p[i] !== '*' && p[i] !== a[i]) return false
  }
  return true
}

type ModelFields = Pick<ManualSummary, 'modelPattern' | 'modelAliases'>

function patternsOf(manual: ModelFields): string[] {
  return [...manual.modelPattern.split('/'), ...(manual.modelAliases ?? [])].map((s) => s.trim()).filter((s) => s !== '')
}

export function manualMatches(manual: ModelFields, input: string): boolean {
  return patternsOf(manual).some((pattern) => matchesPattern(input, pattern))
}

/** ชื่อที่แสดงให้ผู้ใช้: displayName ถ้าผู้พัฒนาเติมแล้ว ไม่งั้น modelPattern (ไม่เดาชื่อ) */
export function manualTitle(manual: Pick<ManualSummary, 'displayName' | 'modelPattern'>): string {
  return manual.displayName ?? manual.modelPattern
}
