import type { RenderedNode, TraversalAction } from '../api/types'

export type TrailMarker = 'dot' | 'switch-off'

export interface TrailEntry {
  nodeId: string
  text: string
  answerLabel: string
  marker: TrailMarker
}

export function toTrailEntry(node: RenderedNode, action: TraversalAction): TrailEntry {
  const passed = { nodeId: node.nodeId, text: node.text }

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