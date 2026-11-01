import { ownerHeaders } from '../lib/clientHeaders'
import { request } from './http'
import type { FlowSummary, ManualSummary, ModelSelection, SessionResponse, SymptomSearchResponse, ExecutionAction } from './types'

interface HealthResponse {
  status: 'ok' | 'degraded'
  service: string
  database: string
  timestamp: string
  environment: string
}

/** GET /health */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

/** manualId ไม่ส่ง = ทุกผัง · ส่ง = เฉพาะผังของรุ่นนั้น */
export async function listFlows(manualId?: string): Promise<FlowSummary[]> {
  const query = manualId === undefined ? '' : `?manualId=${encodeURIComponent(manualId)}`
  return request<FlowSummary[]>(`/execution/flows${query}`)
}

export async function listManuals(): Promise<ManualSummary[]> {
  return request<ManualSummary[]>('/execution/manuals')
}

interface StartSessionOptions {
  query?: string
  manualId?: string
  modelSelection?: ModelSelection
}

export async function startSession(flowId: string, options: StartSessionOptions = {}): Promise<SessionResponse> {
  return request<SessionResponse>('/execution/sessions', {
    method: 'POST',
    body: { flowId, ...options },
    headers: ownerHeaders(),
  })
}

/** manualId ไม่ส่ง = ค้นทุกรุ่น · ส่ง = ค้นเฉพาะผังของรุ่นนั้น */
export async function searchSymptoms(query: string, manualId?: string): Promise<SymptomSearchResponse> {
  return request<SymptomSearchResponse>('/symptom-search', {
    method: 'POST',
    body: { query, manualId },
  })
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/execution/sessions/${encodeURIComponent(sessionId)}`)
}

export async function submitAction(
  sessionId: string,
  action: ExecutionAction,
): Promise<SessionResponse> {
  return request<SessionResponse>(
    `/execution/sessions/${encodeURIComponent(sessionId)}/actions`,
    { method: 'POST', body: action },
  )
}

export async function submitOutcome(sessionId: string, text: string): Promise<SessionResponse> {
  return request<SessionResponse>(
    `/execution/sessions/${encodeURIComponent(sessionId)}/outcome`,
    { method: 'POST', body: { text } },
  )
}

export async function abandonSession(sessionId: string): Promise<void> {
  return request<void>(`/execution/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: ownerHeaders(),
  })
}