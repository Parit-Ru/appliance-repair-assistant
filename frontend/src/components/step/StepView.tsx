import type { ReactNode } from 'react'
import type { RenderedState, ExecutionAction } from '../../api/types'
import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { InputStep } from './InputStep'
import { OutcomeStep } from './OutcomeStep'
import { SafetyGateStep } from './SafetyGateStep'
import { StepCard } from './StepCard'

export interface StepProps {
  state: RenderedState
  onAction: (action: ExecutionAction) => void
  isPending: boolean
  manualLabel?: string
}

interface StepViewProps extends StepProps {
  outcomeActions?: ReactNode
  outcomeForm?: ReactNode
}

export function StepView({ outcomeActions, outcomeForm, ...stepProps }: StepViewProps) {
  const { state } = stepProps

  if (state.isTerminal) {
    return <OutcomeStep state={state} manualLabel={stepProps.manualLabel} form={outcomeForm} actions={outcomeActions} />
  }

  if (state.requiresSafetyConfirmation) {
    return <SafetyGateStep {...stepProps} />
  }

  if (state.type === 'checkpoint') {
    return <CheckpointStep {...stepProps} />
  }

  if (state.type === 'input') {
    return <InputStep {...stepProps} />
  }

  return <InstructionStep {...stepProps} />
}

function CheckpointStep({ state, onAction, isPending, manualLabel }: StepProps) {
  return (
    <StepCard label={STEP_KIND_LABELS.checkpoint} heading={state.text} reference={state.reference} manualLabel={manualLabel}>
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

function InstructionStep({ state, onAction, isPending, manualLabel }: StepProps) {
  return (
    <StepCard label={STEP_KIND_LABELS.instruction} heading={state.text} reference={state.reference} manualLabel={manualLabel}>
      <Button variant="primary" disabled={isPending} onClick={() => onAction({ type: 'continue' })}>
        ถัดไป
      </Button>
    </StepCard>
  )
}
