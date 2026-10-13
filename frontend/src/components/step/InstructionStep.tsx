import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

export function InstructionStep({ node, onAction, isPending, manualLabel }: StepProps) {
  return (
    <StepCard label={STEP_KIND_LABELS.instruction} heading={node.text} reference={node.reference} manualLabel={manualLabel}>
      <Button variant="primary" disabled={isPending} onClick={() => onAction({ type: 'continue' })}>
        ถัดไป
      </Button>
    </StepCard>
  )
}
