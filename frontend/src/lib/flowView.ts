import type { AdminFlowDetail, AdminFlowState, DraftFlow } from '../api/types'

/** The text key of a state depends on its type (same keys as the user-facing flow) */
export function adminStateText(state: AdminFlowState): string {
  return state.question ?? state.content ?? state.prompt ?? ''
}

/** Adapter so the existing path view (draftView.pathLines) can render a published flow */
export function toPathFlow(detail: AdminFlowDetail): DraftFlow {
  return {
    flow_id: detail.flow.flow_id,
    entry_symptom: detail.flow.entry_symptom,
    initial_state: detail.flow.initial_state,
    states: detail.flow.states.map((state) => ({
      ...state,
      safety_warning: state.safety_warning ?? undefined,
    })),
  }
}

export function flowTitle(item: { entrySymptomTh: string | null; entrySymptom: string }): string {
  return item.entrySymptomTh ?? item.entrySymptom
}

/** "แก้ล่าสุดโดย X เมื่อ ..." — null when the flow has never been edited */
export function editedByLine(item: { editedAt: string | null; editedByName: string | null }, format: (iso: string) => string): string | null {
  if (item.editedAt === null) return null
  return `แก้ล่าสุดโดย ${item.editedByName ?? 'ผู้ดูแลที่ไม่ทราบชื่อ'} เมื่อ ${format(item.editedAt)}`
}

export function deletedByLine(item: { deletedAt: string | null; deletedByName: string | null }, format: (iso: string) => string): string | null {
  if (item.deletedAt === null) return null
  return `ลบโดย ${item.deletedByName ?? 'ผู้ดูแลที่ไม่ทราบชื่อ'} เมื่อ ${format(item.deletedAt)}`
}

/** The outgoing edges and the outcome of a state as short Thai phrases (read-only in the editor too) */
export function stateEdgeTexts(state: AdminFlowState): string[] {
  return [
    state.on_yes && `ใช่ → ${state.on_yes}`,
    state.on_no && `ไม่ใช่ → ${state.on_no}`,
    state.next && `ถัดไป → ${state.next}`,
    state.on_invalid && `ตอบไม่ผ่าน → ${state.on_invalid}`,
    state.outcome_kind && `ผล: ${state.outcome_kind}`,
  ].filter((edge): edge is string => typeof edge === 'string')
}
