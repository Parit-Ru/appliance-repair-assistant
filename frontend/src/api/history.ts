import { ownerHeaders } from '../lib/clientHeaders'
import { request } from './http'
import type { HistoryDetail, HistoryFeedback, HistoryListResponse } from './types'

/**
 * ทุกคำขอของหน้าประวัติบอกเจ้าของผ่าน ownerHeaders(): ล็อกอินอยู่ → token (แนบโดย http.ts) ไม่ส่ง X-Client-Id
 * guest → X-Client-Id ของเบราว์เซอร์นี้ · เซิร์ฟเวอร์ตอบเฉพาะ session ของเจ้าของนั้น
 */

// GET /history?page= — ใหม่สุดก่อนเสมอ ครั้งละ 10 รายการ (ค่าเริ่มต้นของเซิร์ฟเวอร์)
export async function listHistory(page: number): Promise<HistoryListResponse> {
  return request<HistoryListResponse>(`/history?page=${page}`, { headers: ownerHeaders() })
}

// GET /history/:id
export async function getHistory(sessionId: string): Promise<HistoryDetail> {
  return request<HistoryDetail>(`/history/${encodeURIComponent(sessionId)}`, { headers: ownerHeaders() })
}

// DELETE /history/:id (204)
export async function deleteHistory(sessionId: string): Promise<void> {
  return request<void>(`/history/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: ownerHeaders(),
  })
}

// POST /history/:id/feedback — ส่งซ้ำ = แก้ค่าเดิม
export async function submitFeedback(sessionId: string, feedback: HistoryFeedback): Promise<HistoryFeedback> {
  return request<HistoryFeedback>(`/history/${encodeURIComponent(sessionId)}/feedback`, {
    method: 'POST',
    body: feedback,
    headers: ownerHeaders(),
  })
}
