import { request } from './http'
import type { AdminFeedbackParams, AdminFeedbackResponse, AdminSummary } from './types'

/** จำนวนแถวต่อหน้าของรายการ feedback (เซิร์ฟเวอร์รับ 1–100) */
const ADMIN_PAGE_SIZE = 20

/** ช่วงวันที่ของสถิติที่เลือกได้ (เซิร์ฟเวอร์รับ 1–90) */
export const SUMMARY_DAY_OPTIONS = [7, 30, 90] as const
export const DEFAULT_SUMMARY_DAYS = 30

// GET /admin/feedback — ต้องเป็น admin (ไม่ใช่ → 401/403) หน้าจอซ่อนเมนูเป็น UX เท่านั้น
export async function getAdminFeedback(params: AdminFeedbackParams): Promise<AdminFeedbackResponse> {
  const search = new URLSearchParams()
  if (params.helpful !== undefined) search.set('helpful', String(params.helpful))
  if (params.from !== undefined) search.set('from', params.from)
  if (params.to !== undefined) search.set('to', params.to)
  search.set('page', String(params.page))
  search.set('pageSize', String(ADMIN_PAGE_SIZE))
  return request<AdminFeedbackResponse>(`/admin/feedback?${search.toString()}`)
}

// GET /admin/analytics/summary?days=
export async function getAdminSummary(days: number): Promise<AdminSummary> {
  return request<AdminSummary>(`/admin/analytics/summary?days=${days}`)
}
