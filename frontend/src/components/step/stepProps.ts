import type { RenderedNode, TraversalAction } from '../../api/types'

export interface StepProps {
  node: RenderedNode
  onAction: (action: TraversalAction) => void
  isPending: boolean
  manualLabel?: string
}