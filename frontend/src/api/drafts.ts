import { request } from './http'
import type { DraftDetail, DraftFlow, DraftPublishResult, DraftSummary, DraftUploadInput } from './types'

export const DRAFT_POLL_MS = 3000

/** POST /admin/drafts (multipart) → 202 { id, status: 'drafting' } */
export async function uploadDraft(input: DraftUploadInput): Promise<{ id: string; status: 'drafting' }> {
  const form = new FormData()
  form.append('manualId', input.manualId)
  form.append('deviceCategory', input.deviceCategory)
  form.append('brand', input.brand)
  form.append('modelPattern', input.modelPattern)
  form.append('sourceManual', input.sourceManual)
  if (input.displayName !== undefined && input.displayName !== '') form.append('displayName', input.displayName)
  form.append('pageFrom', String(input.pageFrom))
  form.append('pageTo', String(input.pageTo))
  form.append('file', input.file, input.file.name)
  return request('/admin/drafts', { method: 'POST', body: form })
}

/** GET /admin/drafts */
export async function listDrafts(): Promise<{ items: DraftSummary[] }> {
  return request('/admin/drafts')
}

/** GET /admin/drafts/:id */
export async function getDraft(id: string): Promise<DraftDetail> {
  return request(`/admin/drafts/${encodeURIComponent(id)}`)
}

/** PUT /admin/drafts/:id — แก้แผนผัง แล้ว backend ตรวจใหม่ (ผลตรวจมาจาก backend เท่านั้น) */
export async function updateDraft(id: string, flows: DraftFlow[]): Promise<DraftDetail> {
  return request(`/admin/drafts/${encodeURIComponent(id)}`, { method: 'PUT', body: { flows } })
}

/** POST /admin/drafts/:id/reject */
export async function rejectDraft(id: string, reason: string): Promise<DraftDetail> {
  const trimmed = reason.trim()
  return request(`/admin/drafts/${encodeURIComponent(id)}/reject`, { method: 'POST', body: trimmed === '' ? {} : { reason: trimmed } })
}

/** POST /admin/drafts/:id/publish — acknowledgedWarnings: ผู้ตรวจยืนยันว่าอ่านคำเตือนแล้ว (backend ตรวจซ้ำเสมอ) */
export async function publishDraft(id: string, acknowledgedWarnings: boolean): Promise<DraftPublishResult> {
  return request(`/admin/drafts/${encodeURIComponent(id)}/publish`, { method: 'POST', body: { acknowledgedWarnings } })
}
