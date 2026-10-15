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
  Severity,
  Difficulty,
  SessionStatus,
  RenderedNode,
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
  severity?: Severity
  difficulty?: Difficulty
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
