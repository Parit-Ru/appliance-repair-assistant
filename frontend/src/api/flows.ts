import { request } from './http'
import type { AdminFlowDetail, AdminFlowListParams, AdminFlowListResponse, AdminFlowRestoreResult, AdminFlowStateEdit, AdminFlowUpdateResult } from './types'

/** DELETE /admin/flows/:id — soft delete (204): hidden from users, history and running sessions stay readable */
export async function deleteAdminFlow(flowId: string): Promise<void> {
  return request<void>(`/admin/flows/${encodeURIComponent(flowId)}`, { method: 'DELETE' })
}

/** POST /admin/flows/:id/restore */
export async function restoreAdminFlow(flowId: string): Promise<AdminFlowRestoreResult> {
  return request<AdminFlowRestoreResult>(`/admin/flows/${encodeURIComponent(flowId)}/restore`, { method: 'POST' })
}

/** PUT /admin/flows/:id — edits the text of existing states; the backend rejects a stale expectedRevision with 409 */
export async function updateAdminFlow(flowId: string, expectedRevision: number, states: AdminFlowStateEdit[]): Promise<AdminFlowUpdateResult> {
  return request<AdminFlowUpdateResult>(`/admin/flows/${encodeURIComponent(flowId)}`, { method: 'PUT', body: { expectedRevision, states } })
}

/** GET /admin/flows  admin only — hiding the menu is UX, the backend enforces the role */
export async function listAdminFlows(params: AdminFlowListParams): Promise<AdminFlowListResponse> {
  const search = new URLSearchParams()
  if (params.q !== undefined) search.set('q', params.q)
  if (params.deviceCategory !== undefined) search.set('deviceCategory', params.deviceCategory)
  search.set('status', params.status)
  search.set('page', String(params.page))
  return request<AdminFlowListResponse>(`/admin/flows?${search.toString()}`)
}

/** GET /admin/flows/:id */
export async function getAdminFlow(flowId: string): Promise<AdminFlowDetail> {
  return request<AdminFlowDetail>(`/admin/flows/${encodeURIComponent(flowId)}`)
}
