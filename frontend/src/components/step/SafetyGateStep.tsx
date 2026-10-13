import { useState } from 'react'
import { STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

export function SafetyGateStep({ node, onAction, isPending, manualLabel }: StepProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <StepCard
      label={STEP_KIND_LABELS.safety_instruction}
      tone="danger"
      notice={
        <Notice tone="danger" title="คำเตือนก่อนทำขั้นตอนนี้">
          {node.safetyWarning}
        </Notice>
      }
      heading={node.text}
      reference={node.reference}
      manualLabel={manualLabel}
    >
      <div className="space-y-4">
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={acknowledged} disabled={isPending} onChange={(event) => setAcknowledged(event.target.checked)} className="h-5 w-5 shrink-0 cursor-pointer accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed" />
          <span>ฉันอ่านคำเตือนแล้ว และจะทำตามก่อนลงมือ</span>
        </label>

        <Button variant="primary" disabled={!acknowledged || isPending} onClick={() => onAction({ type: 'confirm_safety' })}>
          ยืนยันและทำขั้นตอนนี้
        </Button>
      </div>
    </StepCard>
  )
}
