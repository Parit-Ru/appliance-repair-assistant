export type {InputType,OutcomeKind,DeviceCategory,TraversalAction,NodeReference,RenderedNode,} from '../../../backend/src/traversal-engine/types'
import type { DeviceCategory, NodeReference, OutcomeKind, SessionStatus, RenderedNode, TraversalAction } from '../../../backend/src/traversal-engine/types'

export interface GraphSummary {
  graphId: string
  manualId: string
  entrySymptom: string
  entrySymptomTh?: string
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
}
export interface ManualSummary {
  manualId: string
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
  displayName?: string
  modelAliases?: string[]
  graphCount: number
}

export type ModelSelection = 'selected' | 'unknown'

interface SymptomMatch {
  graphId: string
  entrySymptom: string
  entrySymptomTh?: string
  deviceCategory: DeviceCategory
  score: number
  matchedText: string
}

export interface SymptomSearchResponse {
  query: string
  threshold: number
  bestScore: number | null
  matches: SymptomMatch[]
}

export interface SessionResponse {
  sessionId: string
  graphId: string
  status: SessionStatus
  node: RenderedNode
  equipment?: EquipmentItem[]
  confidence?: number | null
  outcome?: string | null
  displayText?: string | null
}

export interface EquipmentItem {
  equipmentId: string
  nameTh: string
  purposeTh: string
  sourcePage?: number
  authorNote?: string
}

export interface ApiErrorBody {
  statusCode: number
  code?: string
  message?: string
}

/** GET/DELETE/POST /history */
export interface HistoryGraphInfo {
  manualId: string
  entrySymptom: string
  entrySymptomTh?: string
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
  displayName?: string
}

export interface HistoryListItem {
  sessionId: string
  graphId: string
  startedAt: string
  outcomeKind: OutcomeKind | null
  graph: HistoryGraphInfo | null
}

export interface HistoryListResponse {
  items: HistoryListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface HistoryStep {
  node: RenderedNode
  action: TraversalAction
}

export type Role = 'user' | 'admin'

export interface AuthUser {
  id: string
  displayName: string
  role: Role
}

export interface AuthResponse {
  accessToken: string
  user: AuthUser & { email: string; createdAt: string }
}


export type OwnerType = 'user' | 'guest' | 'none'

export interface AdminFeedbackParams {
  helpful?: boolean
  from?: string
  to?: string
  page: number
}

export interface AdminFeedbackItem {
  sessionId: string
  helpful: boolean
  comment: string | null
  createdAt: string
  updatedAt: string
  graphId: string
  deviceCategory: DeviceCategory | null
  brand: string | null
  ownerType: OwnerType
}

export interface AdminFeedbackResponse {
  items: AdminFeedbackItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AdminSummary {
  window: { days: number; from: string; to: string }
  sessions: {
    total: number
    completed: number
    inProgress: number
    expiredUnfinished: number
    byOwner: { user: number; guest: number; none: number }
  }
  feedback: {
    total: number
    helpful: number
    notHelpful: number
    satisfactionRate: number | null
  }
  confidence: { average: number | null; sampleSize: number }
  outcomes: Record<OutcomeKind | 'unknown', number>
  topGraphs: Array<{ graphId: string; entrySymptomTh: string | null; count: number }>
  topDevices: Array<{ deviceCategory: DeviceCategory | 'unknown'; count: number }>
  perDay: Array<{ date: string; started: number; completed: number }>
}

export interface HistoryFeedback {
  helpful: boolean
  comment: string | null
}

export interface HistoryDetail {
  sessionId: string
  graphId: string
  startedAt: string
  modelSelection: ModelSelection | null
  confidence: number | null
  graph: HistoryGraphInfo | null
  outcomeKind: OutcomeKind | null
  available: boolean
  steps: HistoryStep[]
  finalNode: RenderedNode | null
  safetyWarnings: string[]
  reference: NodeReference | null
  outcome: string | null
  feedback: HistoryFeedback | null
}

export type DraftStatus = 'drafting' | 'ready' | 'failed' | 'rejected' | 'published'

interface DraftMeta {
  device_category: string
  brand: string
  model_pattern: string
  source_manual: string
  display_name?: string
  page_from: number
  page_to: number
}

export interface DraftNode {
  node_id: string
  type: string
  question?: string
  content?: string
  prompt?: string
  on_yes?: string
  on_no?: string
  next?: string
  on_invalid?: string
  input_type?: string
  pattern?: string
  store_as?: string
  outcome_kind?: string
  safety_critical?: boolean
  safety_warning?: string
  source_page?: number
}

export interface DraftGraph {
  graph_id: string
  entry_symptom: string
  entry_symptom_th?: string
  entry_symptom_aliases?: string[]
  severity?: string
  difficulty?: string
  entry_node: string
  nodes: DraftNode[]
}

export interface ValidationIssue {
  code: string
  message: string
  graphId?: string
  nodeId?: string
}

export interface ValidationReport {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  stats: { graphs: number; nodes: number }
  validatedAt: string
}

interface DraftPage {
  page: number
  text: string
}

export interface DraftSummary {
  id: string
  status: DraftStatus
  manualId: string
  brand: string
  modelPattern: string
  sourceManual: string
  pageFrom: number
  pageTo: number
  graphCount: number | null
  progress: { done: number; total: number }
  error: { code: string; message: string } | null
  validationCounts: { errors: number; warnings: number } | null
  createdAt: string
  updatedAt: string
}

export interface DraftDetail extends DraftSummary {
  meta: DraftMeta
  pages: DraftPage[]
  graphs: DraftGraph[] | null
  validation: ValidationReport | null
  llm: { model: string | null; promptVersion: string | null }
  reviewedAt: string | null
  publishedAt: string | null
}

export interface DraftUploadInput {
  file: File
  manualId: string
  deviceCategory: string
  brand: string
  modelPattern: string
  sourceManual: string
  displayName?: string
  pageFrom: number
  pageTo: number
}

export interface DraftPublishResult {
  id: string
  status: 'published'
  graphIds: string[]
  searchIndex: { indexed: boolean; reason?: string }
}
