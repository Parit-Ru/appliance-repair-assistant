import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

export function CheckpointStep({ node, onAction, isPending, manualLabel }: StepProps) {
  return (
    <StepCard label={STEP_KIND_LABELS.checkpoint} heading={node.text} reference={node.reference} manualLabel={manualLabel}>
      <div className="space-y-3">
        <Button variant="answer" disabled={isPending} onClick={() => onAction({ type: 'answer', value: 'yes' })}>
          ใช่
        </Button>
        <Button variant="answer" disabled={isPending} onClick={() => onAction({ type: 'answer', value: 'no' })}>
          ไม่ใช่
        </Button>
      </div>
    </StepCard>
  )
}
