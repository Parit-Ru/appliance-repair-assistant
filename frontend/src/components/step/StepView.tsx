import type { ReactNode } from 'react'
import type { RenderedNode, TraversalAction } from '../../api/types'
import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { InputStep } from './InputStep'
import { OutcomeStep } from './OutcomeStep'
import { SafetyGateStep } from './SafetyGateStep'
import { StepCard } from './StepCard'

/** props ที่ทุกชนิดขั้นตอนรับ (InputStep / SafetyGateStep / OutcomeStep import ชนิดนี้จากไฟล์นี้) */
export interface StepProps {
  node: RenderedNode
  onAction: (action: TraversalAction) => void
  isPending: boolean
  manualLabel?: string
}

interface StepViewProps extends StepProps {
  outcomeActions?: ReactNode
  outcomeForm?: ReactNode
}

/** เลือกหน้าตาของขั้นตอนตามชนิดโหนดที่เซิร์ฟเวอร์ส่งมา (ไม่ตัดสินขั้นถัดไปเอง แค่ส่ง action กลับไป) */
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

/** คำถาม ใช่/ไม่ใช่ */
function CheckpointStep({ node, onAction, isPending, manualLabel }: StepProps) {
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

/** ขั้นตอนให้ผู้ใช้ทำ (ที่ไม่ต้องยืนยันความปลอดภัย) */
function InstructionStep({ node, onAction, isPending, manualLabel }: StepProps) {
  return (
    <StepCard label={STEP_KIND_LABELS.instruction} heading={node.text} reference={node.reference} manualLabel={manualLabel}>
      <Button variant="primary" disabled={isPending} onClick={() => onAction({ type: 'continue' })}>
        ถัดไป
      </Button>
    </StepCard>
  )
}
