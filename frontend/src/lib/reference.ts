import type { NodeReference } from '../api/types'

const EN_DASH = '–'

export function formatPages(pageRange: [number, number]): string {
  const [first, last] = pageRange
  if (first === last) return `หน้า ${first}`
  return `หน้า ${first}${EN_DASH}${last}`
}

export function formatSourceLine(reference: NodeReference, manualLabel?: string): string {
  const manual = manualLabel === undefined ? reference.source : `คู่มือ ${manualLabel}`
  return `ที่มาของขั้นตอนนี้: ${manual} ${formatPages(reference.pageRange)}`
}