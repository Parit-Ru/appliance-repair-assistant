import type { DeviceCategory, OutcomeKind, OwnerType } from '../api/types'
import { DEVICE_CATEGORY_LABELS, HISTORY_STATUS_LABELS } from './labels'

const EMPTY_VALUE = '-'

export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
  user: 'ผู้ใช้ที่เข้าสู่ระบบ',
  guest: 'ผู้เยี่ยมชม',
  none: 'ไม่ระบุเจ้าของ',
}

export const EXPIRED_UNFINISHED_LABEL = 'เดินค้างแล้วหมดอายุ'

export const NONE_OWNER_NOTE ='กลุ่ม "ไม่ระบุเจ้าของ" อาจรวมการตรวจจากโปรเจกต์เดิมที่ใช้ฐานข้อมูลเดียวกัน และการตรวจที่ไม่ได้ส่งรหัสเบราว์เซอร์มา'

export function formatPercent(rate: number | null): string {
  return rate === null ? EMPTY_VALUE : `${(rate * 100).toFixed(1)}%`
}

export function formatConfidence(value: number | null): string {
  return value === null ? EMPTY_VALUE : value.toFixed(3)
}

const numberFormatter = new Intl.NumberFormat('th-TH')

export function formatCount(value: number): string {
  return numberFormatter.format(value)
}

export function deviceLabel(category: DeviceCategory | 'unknown' | null): string {
  if (category === null || category === 'unknown') return 'ไม่ทราบประเภท (ผังถูกเปลี่ยนไปแล้ว)'
  return DEVICE_CATEGORY_LABELS[category]
}

export function outcomeLabel(kind: OutcomeKind | 'unknown'): string {
  return kind === 'unknown' ? 'ไม่ทราบ (ผังถูกเปลี่ยนไปแล้ว)' : HISTORY_STATUS_LABELS[kind]
}

export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.max(2, Math.round((value / max) * 100))
}

/** วันที่ 'YYYY-MM-DD' → '16 ต.ค.' (ปีไม่ใส่ เพราะอยู่ในช่วง N วันล่าสุดอยู่แล้ว) · ผิดรูปแบบ → คืนค่าเดิม */
const shortDateFormatter = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? date : shortDateFormatter.format(parsed)
}
