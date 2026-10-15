import type { HistoryGraphInfo, OutcomeKind } from '../api/types'
import { manualTitle } from './models'
import { symptomName } from './symptoms'

/**
 * ตัวช่วยแสดงผลของหน้า "ประวัติการซ่อม" (ฟังก์ชันล้วน ไม่แตะ React และไม่เรียก API)
 */

/** ระยะเวลาที่ session ที่จบแล้วถูกเก็บ ต้องตรงกับ COMPLETED_SESSION_TTL_DAYS ใน backend/src/traversal/session.store.ts */
export const HISTORY_RETENTION_DAYS = 90

/** ข้อความเมื่อผัง/โหนดของรายการนี้เปลี่ยนไปหลังตรวจ (seed ผังใหม่) จนอ่านย้อนหลังไม่ได้ */
export const GRAPH_CHANGED_MESSAGE = 'ข้อมูลผังเปลี่ยนไปแล้ว ดูรายละเอียดไม่ได้'

/** ป้ายสถานะ: สีเสริมเท่านั้น ความหมายอยู่ที่ข้อความของป้ายเสมอ (ไม่พึ่งสีอย่างเดียว) */
export const STATUS_BADGE_CLASSES: Record<OutcomeKind, string> = {
  user_fixed: 'border-success/40 text-success',
  normal_behavior: 'border-info/40 text-info',
  handoff_informed: 'border-accent/40 text-accent',
  handoff_unknown: 'border-accent/40 text-accent',
}

// ปีพุทธศักราชตามค่าเริ่มต้นของ th-TH (ตรงกับที่ใช้ในเอกสารโครงงาน)
const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

/** วันเวลาเริ่มตรวจ ตามเขตเวลาของเครื่องผู้ใช้ · อ่านไม่ได้ = ข้อความว่าง (ไม่ขึ้น "Invalid Date") */
export function formatStartedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

/** ชื่ออาการของแถว/หัวหน้า · ผังหาย = ข้อความ "ข้อมูลผังเปลี่ยนไปแล้ว" (ไม่เดาชื่ออาการ) */
export function historyTitle(graph: HistoryGraphInfo | null): string {
  return graph === null ? GRAPH_CHANGED_MESSAGE : symptomName(graph)
}

/** ชื่อรุ่นที่แสดง: displayName ถ้ามี ไม่งั้น modelPattern (ใช้กฎเดียวกับหน้าอื่น) */
export function historyModelName(graph: HistoryGraphInfo): string {
  return manualTitle(graph)
}
