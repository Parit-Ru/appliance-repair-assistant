import type { DraftDetail, DraftFlow, DraftState, DraftStatus, ValidationIssue, ValidationReport } from '../api/types'
import { DEVICE_CATEGORIES } from './labels'

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  drafting: 'กำลังร่าง',
  ready: 'รอตรวจ',
  failed: 'ร่างไม่สำเร็จ',
  rejected: 'ปฏิเสธแล้ว',
  published: 'เผยแพร่แล้ว',
}

export const DRAFT_STATUS_CLASSES: Record<DraftStatus, string> = {
  drafting: 'border-info/40 text-info',
  ready: 'border-accent/40 text-accent',
  failed: 'border-danger/40 text-danger',
  rejected: 'border-line text-ink-faint',
  published: 'border-success/40 text-success',
}

const FAILURE_LABELS: Record<string, string> = {
  LLM_NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่า LLM บนเซิร์ฟเวอร์ (AUTHORING_LLM_MODEL / GROQ_API_KEY)',
  LLM_TIMEOUT: 'LLM ไม่ตอบภายในเวลาที่กำหนด',
  LLM_HTTP: 'เรียก LLM ไม่สำเร็จ (เครือข่ายหรือโควตาของผู้ให้บริการ)',
  LLM_BAD_RESPONSE: 'คำตอบของ LLM อ่านไม่ได้หรือถูกตัดกลางคัน',
  LLM_PARSE_ERROR: 'คำตอบของ LLM ไม่ตรงรูปแบบที่กำหนด (ระบบไม่ซ่อมหรือเดาให้)',
  NO_FLOWS_FOUND: 'LLM ไม่พบเนื้อหาการแก้ปัญหาในหน้าที่เลือก',
  INTERRUPTED: 'งานถูกขัดจังหวะเพราะเซิร์ฟเวอร์เริ่มทำงานใหม่',
  INTERNAL_ERROR: 'เกิดข้อผิดพลาดภายในระหว่างร่าง',
  REJECTED: 'ผู้ดูแลระบบปฏิเสธร่างนี้',
}

export function draftFailureLabel(code: string): string {
  return FAILURE_LABELS[code] ?? `ข้อผิดพลาดรหัส ${code}`
}

export function canReject(status: DraftStatus): boolean {
  return status === 'ready' || status === 'failed'
}

const STATE_TYPE_LABELS: Record<string, string> = {
  checkpoint: 'คำถาม ใช่/ไม่ใช่',
  instruction: 'ขั้นตอนให้ผู้ใช้ทำ',
  input: 'ถามข้อมูล',
  resolution: 'จบ: แก้ได้/ปกติ',
  escalation: 'จบ: ส่งต่อช่าง',
}

export function stateTypeLabel(type: string): string {
  return STATE_TYPE_LABELS[type] ?? `ชนิดไม่รู้จัก (${type})`
}

export function stateText(state: DraftState): string {
  return state.question ?? state.content ?? state.prompt ?? ''
}
interface PathLine {
  stateId: string
  text: string
  unreachable: boolean
}

function edgesText(state: DraftState): string {
  switch (state.type) {
    case 'checkpoint':
      return `ใช่ → ${state.on_yes ?? '?'} · ไม่ใช่ → ${state.on_no ?? '?'}`
    case 'instruction':
      return `ถัดไป → ${state.next ?? '?'}`
    case 'input':
      return `ถัดไป → ${state.next ?? '?'}${state.on_invalid ? ` · ตอบไม่ผ่าน → ${state.on_invalid}` : ''}`
    case 'resolution':
    case 'escalation':
      return `■ จบ (${state.outcome_kind ?? 'ไม่ระบุผล'})`
    default:
      return ''
  }
}

function targetsOf(state: DraftState): string[] {
  return [state.on_yes, state.on_no, state.next, state.on_invalid].filter((t): t is string => typeof t === 'string' && t !== '')
}

export function pathLines(flow: DraftFlow): PathLine[] {
  const byId = new Map(flow.states.map((n) => [n.state_id, n]))
  const order: string[] = []
  const seen = new Set<string>()
  const queue = byId.has(flow.initial_state) ? [flow.initial_state] : []
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (seen.has(id) || !byId.has(id)) continue
    seen.add(id)
    order.push(id)
    for (const target of targetsOf(byId.get(id) as DraftState)) if (!seen.has(target)) queue.push(target)
  }

  const line = (state: DraftState, unreachable: boolean): PathLine => ({
    stateId: state.state_id,
    text: `${state.state_id === flow.initial_state ? '▶ ' : ''}${state.state_id} · ${stateTypeLabel(state.type)}${state.safety_critical ? ' ⚠' : ''} — ${edgesText(state)}`,
    unreachable,
  })

  return [
    ...order.map((id) => line(byId.get(id) as DraftState, false)),
    ...flow.states.filter((n) => !seen.has(n.state_id)).map((n) => line(n, true)),
  ]
}

const RISK_WARNING_CODES = ['W_STATE_RISK', 'W_PAGE_RISK']

export function riskWarnings(report: ValidationReport | null): ValidationIssue[] {
  return report === null ? [] : report.warnings.filter((w) => RISK_WARNING_CODES.includes(w.code))
}

interface StateIssues {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export function issuesForState(report: ValidationReport | null, flowId: string, stateId: string): StateIssues {
  const match = (i: ValidationIssue) => i.flowId === flowId && i.stateId === stateId
  return { errors: report?.errors.filter(match) ?? [], warnings: report?.warnings.filter(match) ?? [] }
}

export function issuesForFlow(report: ValidationReport | null, flowId: string): StateIssues {
  const match = (i: ValidationIssue) => i.flowId === flowId && i.stateId === undefined
  return { errors: report?.errors.filter(match) ?? [], warnings: report?.warnings.filter(match) ?? [] }
}

export function issueLocation(issue: ValidationIssue): string {
  if (issue.flowId === undefined) return 'ทั้งคู่มือ'
  return issue.stateId === undefined ? issue.flowId : `${issue.flowId} / ${issue.stateId}`
}

interface PublishGate {
  enabled: boolean
  reason: string | null
  acknowledgedWarnings: boolean
}

export function publishGate(draft: Pick<DraftDetail, 'status' | 'validation'>, reviewed: boolean, warningsAcknowledged: boolean): PublishGate {
  const errors = draft.validation?.errors.length ?? 0
  const warnings = draft.validation?.warnings.length ?? 0
  const ack = warnings > 0 && warningsAcknowledged

  let reason: string | null = null
  if (draft.status !== 'ready') reason = 'เผยแพร่ได้เฉพาะร่างที่รอตรวจ'
  else if (draft.validation === null) reason = 'ยังไม่มีรายงานการตรวจ'
  else if (errors > 0) reason = `ยังมีข้อผิดพลาด ${errors} ข้อ — แก้ให้หมดก่อน (ไม่มีทางข้ามการตรวจ)`
  else if (!reviewed) reason = 'ติ๊กยืนยันว่าตรวจข้อความทุกสถานะและด่านความปลอดภัยแล้ว'
  else if (warnings > 0 && !warningsAcknowledged) reason = `ติ๊กรับทราบคำเตือน ${warnings} ข้อ`

  return { enabled: reason === null, reason, acknowledgedWarnings: ack }
}

export const MAX_DRAFT_PAGES = 10

export interface UploadFormValues {
  file: { name: string; type: string } | null
  manualId: string
  deviceCategory: string
  brand: string
  modelPattern: string
  sourceManual: string
  displayName: string
  pageFrom: string
  pageTo: string
}

export type UploadFormErrors = Partial<Record<keyof UploadFormValues, string>>

export function validateUploadForm(values: UploadFormValues): UploadFormErrors {
  const errors: UploadFormErrors = {}

  if (values.file === null) errors.file = 'เลือกไฟล์ PDF'
  else if (values.file.type !== 'application/pdf' && !values.file.name.toLowerCase().endsWith('.pdf')) errors.file = 'ต้องเป็นไฟล์ PDF'

  const manualId = values.manualId.trim()
  if (!/^[a-z0-9_]{3,60}$/.test(manualId)) errors.manualId = 'ใช้ได้เฉพาะ a-z 0-9 และ _ ยาว 3–60 ตัว'

  if (!(DEVICE_CATEGORIES as string[]).includes(values.deviceCategory)) errors.deviceCategory = 'เลือกประเภทเครื่อง'

  const required: Array<[keyof UploadFormValues, string, number]> = [
    ['brand', 'ยี่ห้อ', 40],
    ['modelPattern', 'รุ่น', 60],
    ['sourceManual', 'ชื่อคู่มือ', 200],
  ]
  for (const [key, label, max] of required) {
    const value = String(values[key]).trim()
    if (value === '') errors[key] = `กรอก${label}`
    else if (value.length > max) errors[key] = `${label}ยาวเกิน ${max} ตัวอักษร`
  }
  if (values.displayName.trim().length > 120) errors.displayName = 'ชื่อที่แสดงยาวเกิน 120 ตัวอักษร'

  const from = Number(values.pageFrom)
  const to = Number(values.pageTo)
  if (!/^\d+$/.test(values.pageFrom.trim()) || from < 1) errors.pageFrom = 'เลขหน้าเริ่ม (จำนวนเต็ม ≥ 1)'
  if (!/^\d+$/.test(values.pageTo.trim()) || to < 1) errors.pageTo = 'เลขหน้าสุดท้าย (จำนวนเต็ม ≥ 1)'
  if (errors.pageFrom === undefined && errors.pageTo === undefined) {
    if (to < from) errors.pageTo = 'หน้าสุดท้ายต้องไม่น้อยกว่าหน้าเริ่ม'
    else if (to - from + 1 > MAX_DRAFT_PAGES) errors.pageTo = `เลือกได้ไม่เกิน ${MAX_DRAFT_PAGES} หน้าต่อร่าง`
  }

  return errors
}

export function isDemoManualId(manualId: string): boolean {
  return manualId.trim().startsWith('demo_')
}

export function pageTextOf(draft: Pick<DraftDetail, 'pages'>, page: number | undefined): string | undefined {
  if (page === undefined) return undefined
  return draft.pages.find((p) => p.page === page)?.text
}
