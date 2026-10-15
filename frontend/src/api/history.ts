import { getClientId } from '../lib/clientId'
import { request } from './http'
import type { HistoryDetail, HistoryFeedback, HistoryListResponse, HistoryParams } from './types'

/** จำนวนแถวต่อหน้าของรายการประวัติ (เซิร์ฟเวอร์รับ 1–50) */
export const HISTORY_PAGE_SIZE = 10

/** ทุกคำขอของหน้าประวัติแนบ id ของเบราว์เซอร์นี้ เซิร์ฟเวอร์ตอบเฉพาะ session ของ id นี้ */
function clientHeaders(): Record<string, string> {
  return { 'X-Client-Id': getClientId() }
}

// GET /history
export async function listHistory(params: HistoryParams): Promise<HistoryListResponse> {
  const search = new URLSearchParams()
  if (params.q !== '') search.set('q', params.q)
  if (params.category !== undefined) search.set('category', params.category)
  if (params.brand !== undefined) search.set('brand', params.brand)
  if (params.status !== undefined) search.set('status', params.status)
  search.set('sort', params.sort)
  search.set('page', String(params.page))
  search.set('pageSize', String(HISTORY_PAGE_SIZE))

  return request<HistoryListResponse>(`/history?${search.toString()}`, { headers: clientHeaders() })
}

// GET /history/:id
export async function getHistory(sessionId: string): Promise<HistoryDetail> {
  return request<HistoryDetail>(`/history/${encodeURIComponent(sessionId)}`, { headers: clientHeaders() })
}

// DELETE /history/:id (204)
export async function deleteHistory(sessionId: string): Promise<void> {
  return request<void>(`/history/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: clientHeaders(),
  })
}

// POST /history/:id/feedback — ส่งซ้ำ = แก้ค่าเดิม
export async function submitFeedback(sessionId: string, feedback: HistoryFeedback): Promise<HistoryFeedback> {
  return request<HistoryFeedback>(`/history/${encodeURIComponent(sessionId)}/feedback`, {
    method: 'POST',
    body: feedback,
    headers: clientHeaders(),
  })
}
