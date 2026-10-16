import { DEFAULT_SUMMARY_DAYS, SUMMARY_DAY_OPTIONS } from '../api/admin'
import type { AdminFeedbackParams } from '../api/types'

/**
 * พารามิเตอร์ของหน้าผู้ดูแลระบบที่เก็บใน URL (ฟังก์ชันล้วน เหมือน historyParams.ts)
 * อ่านแบบผ่อนปรน: ค่าที่ผิดรูปแบบถูกเมินแทนที่จะทำให้หน้าล้ม (backend ตรวจเข้มอีกชั้นและตอบ 400 ถ้าผิด)
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validDate(raw: string | null): string | undefined {
  if (raw === null || !DATE_PATTERN.test(raw)) return undefined
  return Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime()) ? undefined : raw
}

// ---------- /admin/feedback ----------

/** ?helpful=true|false&from=YYYY-MM-DD&to=YYYY-MM-DD&page= */
export function parseFeedbackParams(search: URLSearchParams): AdminFeedbackParams {
  const helpfulRaw = search.get('helpful')
  const page = Number(search.get('page'))

  return {
    helpful: helpfulRaw === 'true' ? true : helpfulRaw === 'false' ? false : undefined,
    from: validDate(search.get('from')),
    to: validDate(search.get('to')),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** แปลงกลับเป็น query string ของ URL — ค่าเริ่มต้นไม่ใส่ เพื่อให้ URL สั้น */
export function feedbackToSearchParams(params: AdminFeedbackParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.helpful !== undefined) search.set('helpful', String(params.helpful))
  if (params.from !== undefined) search.set('from', params.from)
  if (params.to !== undefined) search.set('to', params.to)
  if (params.page > 1) search.set('page', String(params.page))
  return search
}

/** เปลี่ยนตัวกรอง = กลับไปหน้า 1 เสมอ (เปลี่ยนหน้าอย่างเดียวไม่รีเซ็ต) */
export function patchFeedbackParams(
  current: AdminFeedbackParams,
  patch: Partial<AdminFeedbackParams>,
): AdminFeedbackParams {
  const changesFilter = 'helpful' in patch || 'from' in patch || 'to' in patch
  return { ...current, ...patch, page: changesFilter && !('page' in patch) ? 1 : (patch.page ?? current.page) }
}

export function hasFeedbackFilters(params: AdminFeedbackParams): boolean {
  return params.helpful !== undefined || params.from !== undefined || params.to !== undefined
}

// ---------- /admin/analytics ----------

/** ?days=7|30|90 (ค่าอื่น/ไม่ส่ง = 30) */
export function parseSummaryDays(search: URLSearchParams): number {
  const days = Number(search.get('days'))
  return (SUMMARY_DAY_OPTIONS as readonly number[]).includes(days) ? days : DEFAULT_SUMMARY_DAYS
}
