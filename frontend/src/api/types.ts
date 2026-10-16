export type {
  InputType,
  OutcomeKind,
  DeviceCategory,
  TraversalAction,
  NodeReference,
  RenderedNode,
} from '../../../backend/src/traversal-engine/types'

import type {
  DeviceCategory,
  NodeReference,
  OutcomeKind,
  SessionStatus,
  RenderedNode,
  TraversalAction,
} from '../../../backend/src/traversal-engine/types'


//รายการอาการ 1 รายการ ที่ GET /traversal/graphs ส่งกลับมาเป็น array

export interface GraphSummary {
  graphId: string
  manualId: string
  entrySymptom: string
  entrySymptomTh?: string
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
}

// คู่มือ/รุ่น 1 รายการ ที่ GET /traversal/manuals ส่งกลับมาเป็น array
// displayName/modelAliases ไม่มี = ผู้พัฒนายังไม่เติม ให้แสดง modelPattern แทน (ห้ามเดาชื่อ)
export interface ManualSummary {
  manualId: string
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
  displayName?: string
  modelAliases?: string[]
  graphCount: number
}

// ผู้ใช้ระบุรุ่นเอง (selected) หรือบอกว่าไม่ทราบรุ่นแล้วเลือกรุ่นที่ใกล้เคียงเอง (unknown)
export type ModelSelection = 'selected' | 'unknown'

// ผังขั้นตอน 1 รายการที่ POST /symptom-search ส่งกลับมาในฟิลด์ matches
export interface SymptomMatch {
  graphId: string
  entrySymptom: string
  entrySymptomTh?: string
  deviceCategory: DeviceCategory
  score: number
  matchedText: string
}

// POST /symptom-search ส่งกลับมา 
export interface SymptomSearchResponse {
  query: string
  threshold: number
  bestScore: number | null
  matches: SymptomMatch[]
}


// สิ่งที่ POST /traversal/sessions และ GET /traversal/sessions/:id ส่งกลับมา

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

// ============================================================
// ประวัติการซ่อม (GET/DELETE/POST /history…) — รูปร่างตรงกับ backend/src/history/history.dto.ts
// ============================================================

export type HistorySort = 'newest' | 'oldest'

/** ตัวกรอง/การเรียง/หน้า ของรายการประวัติ (ที่ URL เก็บไว้ ดู lib/historyParams.ts) */
export interface HistoryParams {
  /** ข้อความค้นหา ว่าง = ไม่ค้นหา */
  q: string
  category: DeviceCategory | undefined
  brand: string | undefined
  /** = outcome_kind ของโหนดสุดท้าย */
  status: OutcomeKind | undefined
  sort: HistorySort
  page: number
}

// ข้อมูลผังของแถวประวัติ ใช้ symptomName() และ manualTitle() ตัวเดิมได้ (displayName ไม่มี = แสดง modelPattern)
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
  /** เวลาเริ่มตรวจ (ISO 8601) */
  startedAt: string
  /** null = หาโหนดสุดท้ายในผังปัจจุบันไม่ได้ (ผังถูกเปลี่ยนหลัง seed ใหม่) */
  outcomeKind: OutcomeKind | null
  /** null = ผังนี้ไม่มีในระบบแล้ว */
  graph: HistoryGraphInfo | null
}

export interface HistoryListResponse {
  items: HistoryListItem[]
  total: number
  /** หน้าที่เซิร์ฟเวอร์ส่งจริง (ถ้าขอเกินหน้าสุดท้ายจะถูกดึงกลับมาหน้าสุดท้าย) */
  page: number
  pageSize: number
  totalPages: number
  facets: {
    categories: DeviceCategory[]
    brands: string[]
  }
}

export interface HistoryStep {
  node: RenderedNode
  action: TraversalAction
}

// ============================================================
// บัญชีผู้ใช้ (POST /auth/register, /auth/login, GET /auth/me)
// ============================================================

export type Role = 'user' | 'admin'

/**
 * ผู้ใช้ที่ล็อกอิน เฉพาะที่หน้าจอต้องใช้แสดงผล (ไม่เก็บอีเมล)
 * role ใช้ซ่อน/แสดงเมนูเท่านั้น (UX) · สิทธิ์จริงตัดสินที่ backend จาก token
 */
export interface AuthUser {
  id: string
  displayName: string
  role: Role
}

/** response ของ register / login */
export interface AuthResponse {
  accessToken: string
  user: AuthUser & { email: string; createdAt: string }
}

// ============================================================
// หน้าผู้ดูแลระบบ (GET /admin/feedback, /admin/analytics/summary)
// ============================================================

export type OwnerType = 'user' | 'guest' | 'none'

export interface AdminFeedbackParams {
  /** undefined = ทั้งหมด */
  helpful?: boolean
  /** YYYY-MM-DD (เวลาไทย) */
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
  /** null = ผังนี้ไม่มีในระบบแล้ว */
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
    /** เดินค้างแล้วหมดอายุ — ไม่ใช่ "ยกเลิก" (การยกเลิกลบแถวทิ้ง นับไม่ได้) */
    expiredUnfinished: number
    byOwner: { user: number; guest: number; none: number }
  }
  feedback: {
    total: number
    helpful: number
    notHelpful: number
    /** null = ยังไม่มีคะแนน (ห้ามแสดงเป็น 0) */
    satisfactionRate: number | null
  }
  /** average เป็น null เมื่อไม่มีตัวอย่าง (ห้ามแสดงเป็น 0) */
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
  /** null = session นี้ไม่ได้ผ่านหน้าเลือกรุ่น (ห้ามเติมเป็น 'selected') */
  modelSelection: ModelSelection | null
  /** null = ไม่มีคะแนน (ไม่ใช่ 0 ไม่ใช่ "ต่ำ") */
  confidence: number | null
  graph: HistoryGraphInfo | null
  outcomeKind: OutcomeKind | null
  /** false = ผัง/โหนดที่เคยผ่านเปลี่ยนไปแล้ว อ่านขั้นตอนย้อนหลังไม่ได้ */
  available: boolean
  steps: HistoryStep[]
  finalNode: RenderedNode | null
  safetyWarnings: string[]
  reference: NodeReference | null
  /** ข้อความผลลัพธ์ที่ผู้ใช้บันทึกเอง */
  outcome: string | null
  feedback: HistoryFeedback | null
}
