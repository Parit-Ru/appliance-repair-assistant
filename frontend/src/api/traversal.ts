import { request } from './http'
import type { GraphSummary, SessionResponse, SymptomSearchResponse, TraversalAction } from './types'

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

export async function listGraphs(): Promise<GraphSummary[]> {
  return request<GraphSummary[]>('/traversal/graphs')
}

export async function startSession(graphId: string, query?: string): Promise<SessionResponse> {
  return request<SessionResponse>('/traversal/sessions', {
    method: 'POST',
    body: { graphId, query },
  })
}

export async function searchSymptoms(query: string): Promise<SymptomSearchResponse> {
  return request<SymptomSearchResponse>('/symptom-search', {
    method: 'POST',
    body: { query },
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