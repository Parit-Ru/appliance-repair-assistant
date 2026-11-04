import type { AdminFlowState, AdminFlowStateEdit } from '../api/types'

export const MAX_STATE_TEXT_LENGTH = 2000

type TextKey = 'question' | 'prompt' | 'content'

// Same keys as the backend and as the user-facing flow
const TEXT_KEY_BY_TYPE: Record<string, TextKey> = {
  checkpoint: 'question',
  input: 'prompt',
  instruction: 'content',
  resolution: 'content',
  escalation: 'content',
}

const TEXT_LABEL_BY_TYPE: Record<string, string> = {
  checkpoint: 'คำถาม (ผู้ใช้ตอบ ใช่ / ไม่ใช่)',
  input: 'ข้อความที่ขอให้ผู้ใช้กรอก',
  instruction: 'ข้อความขั้นตอนที่ให้ผู้ใช้ทำ',
  resolution: 'ข้อความตอนจบ (แก้ได้ / ปกติ)',
  escalation: 'ข้อความตอนจบ (ส่งต่อช่าง)',
}

export function textLabelOf(type: string): string {
  return TEXT_LABEL_BY_TYPE[type] ?? 'ข้อความ'
}

export interface StateDraft {
  text: string
  safetyWarning: string
}

export type Drafts = Record<string, StateDraft>

export function currentText(state: AdminFlowState): string {
  const key = TEXT_KEY_BY_TYPE[state.type]
  return (key === undefined ? undefined : state[key]) ?? ''
}

export function initialDrafts(states: AdminFlowState[]): Drafts {
  const drafts: Drafts = {}
  for (const state of states) drafts[state.state_id] = { text: currentText(state), safetyWarning: state.safety_warning ?? '' }
  return drafts
}

function isChanged(state: AdminFlowState, draft: StateDraft): boolean {
  if (draft.text.trim() !== currentText(state).trim()) return true
  return state.safety_critical && draft.safetyWarning.trim() !== (state.safety_warning ?? '').trim()
}

export function changedStateIds(states: AdminFlowState[], drafts: Drafts): string[] {
  return states.filter((state) => isChanged(state, drafts[state.state_id])).map((state) => state.state_id)
}

/** Problems that block saving, per state id (the backend checks the same rules again) */
export function draftProblems(states: AdminFlowState[], drafts: Drafts): Record<string, string> {
  const problems: Record<string, string> = {}
  for (const state of states) {
    const draft = drafts[state.state_id]
    if (draft.text.trim() === '') problems[state.state_id] = 'ข้อความต้องไม่ว่าง'
    else if (draft.text.length > MAX_STATE_TEXT_LENGTH) problems[state.state_id] = `ข้อความยาวเกิน ${MAX_STATE_TEXT_LENGTH} ตัวอักษร`
    else if (state.safety_critical && draft.safetyWarning.trim() === '') problems[state.state_id] = 'คำเตือนความปลอดภัยต้องไม่ว่าง'
    else if (state.safety_critical && draft.safetyWarning.length > MAX_STATE_TEXT_LENGTH) problems[state.state_id] = `คำเตือนยาวเกิน ${MAX_STATE_TEXT_LENGTH} ตัวอักษร`
  }
  return problems
}

/** Only the changed states, each with the text key that matches its type */
export function buildEdits(states: AdminFlowState[], drafts: Drafts): AdminFlowStateEdit[] {
  const edits: AdminFlowStateEdit[] = []
  for (const state of states) {
    const draft = drafts[state.state_id]
    const key = TEXT_KEY_BY_TYPE[state.type]
    if (key === undefined || !isChanged(state, draft)) continue
    const edit: AdminFlowStateEdit = { state_id: state.state_id, [key]: draft.text }
    if (state.safety_critical) edit.safety_warning = draft.safetyWarning
    edits.push(edit)
  }
  return edits
}
