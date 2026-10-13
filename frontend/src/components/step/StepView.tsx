import type { ReactNode } from 'react'
import { CheckpointStep } from './CheckpointStep'
import { InputStep } from './InputStep'
import { InstructionStep } from './InstructionStep'
import { OutcomeStep } from './OutcomeStep'
import { SafetyGateStep } from './SafetyGateStep'
import type { StepProps } from './stepProps'

interface StepViewProps extends StepProps {
  outcomeActions?: ReactNode
  outcomeForm?: ReactNode
}

export function StepView({ outcomeActions, outcomeForm, ...stepProps }: StepViewProps) {
  const { node } = stepProps

  if (node.isTerminal) {
    return <OutcomeStep node={node} manualLabel={stepProps.manualLabel} form={outcomeForm} actions={outcomeActions} />
  }

  if (node.requiresSafetyConfirmation) {
    return <SafetyGateStep {...stepProps} />
  }

  if (node.type === 'checkpoint') {
    return <CheckpointStep {...stepProps} />
  }

  if (node.type === 'input') {
    return <InputStep {...stepProps} />
  }

  return <InstructionStep {...stepProps} />
}
