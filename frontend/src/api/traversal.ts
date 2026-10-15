import { request } from './http'
import type {
  GraphSummary,
  ManualSummary,
  ModelSelection,
  SessionResponse,
  SymptomSearchResponse,
  TraversalAction,
} from './types'

export interface HealthResponse {
  status: 'ok' | 'degraded'
  service: string
  database: string
  timestamp: string
  environment: string
}

// GET /health
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

// manualId ไม่ส่ง = ทุกผัง · ส่ง = เฉพาะผังของรุ่นนั้น
export async function listGraphs(manualId?: string): Promise<GraphSummary[]> {
  const query = manualId === undefined ? '' : `?manualId=${encodeURIComponent(manualId)}`
  return request<GraphSummary[]>(`/traversal/graphs${query}`)
}

export async function listManuals(): Promise<ManualSummary[]> {
  return request<ManualSummary[]>('/traversal/manuals')
}

export interface StartSessionOptions {
  /** ส่งเฉพาะตอนเริ่มจากผลค้นหา (ไว้คิดคะแนนความมั่นใจ) */
  query?: string
  /** รุ่นที่ผู้ใช้เลือก: ถ้าส่ง เซิร์ฟเวอร์ตรวจว่าผังเป็นของรุ่นนั้น (ไม่ใช่ → 400 GRAPH_MANUAL_MISMATCH) */
  manualId?: string
  /** ผู้ใช้ระบุรุ่นเอง หรือไม่ทราบรุ่น (บันทึกไว้แยกเคสตอนวัดผล) */
  modelSelection?: ModelSelection
}

export async function startSession(graphId: string, options: StartSessionOptions = {}): Promise<SessionResponse> {
  return request<SessionResponse>('/traversal/sessions', {
    method: 'POST',
    body: { graphId, ...options },
  })
}

// manualId ไม่ส่ง = ค้นทุกรุ่น · ส่ง = ค้นเฉพาะผังของรุ่นนั้น
export async function searchSymptoms(query: string, manualId?: string): Promise<SymptomSearchResponse> {
  return request<SymptomSearchResponse>('/symptom-search', {
    method: 'POST',
    body: { query, manualId },
  })
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/traversal/sessions/${encodeURIComponent(sessionId)}`)
}

export async function submitAction(
  sessionId: string,
  action: TraversalAction,
): Promise<SessionResponse> {
  return request<SessionResponse>(
    `/traversal/sessions/${encodeURIComponent(sessionId)}/actions`,
    { method: 'POST', body: action },
  )
}

export async function submitOutcome(sessionId: string, text: string): Promise<SessionResponse> {
  return request<SessionResponse>(
    `/traversal/sessions/${encodeURIComponent(sessionId)}/outcome`,
    { method: 'POST', body: { text } },
  )
}

export async function abandonSession(sessionId: string): Promise<void> {
  return request<void>(`/traversal/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}