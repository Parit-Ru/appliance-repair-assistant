import type { RenderedState, ExecutionAction } from '../api/types'

export type TrailMarker = 'dot' | 'switch-off'

export interface TrailEntry {
  stateId: string
  text: string
  answerLabel: string
  marker: TrailMarker
}

export function toTrailEntry(state: RenderedState, action: ExecutionAction): TrailEntry {
  const passed = { stateId: state.stateId, text: state.text }

  switch (action.type) {
    case 'answer':
      return {
        ...passed,
        answerLabel: action.value === 'yes' ? 'ตอบ ใช่' : 'ตอบ ไม่ใช่',
        marker: 'dot',
      }

    case 'continue':
      return { ...passed, answerLabel: 'ไปต่อแล้ว', marker: 'dot' }

    case 'confirm_safety':
      return { ...passed, answerLabel: 'ยืนยันคำเตือนแล้ว', marker: 'switch-off' }

    case 'input':
      return { ...passed, answerLabel: `กรอก ${action.value}`, marker: 'dot' }
  }
}