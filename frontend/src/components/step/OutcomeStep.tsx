import type { ReactNode } from 'react'
import type { OutcomeKind } from '../../api/types'
import { OUTCOME_TITLES } from '../../lib/labels'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { StepCard } from './StepCard'
import type { StepProps } from './stepProps'

interface OutcomeStepProps extends Pick<StepProps, 'node' | 'manualLabel'> {
  form?: ReactNode
  actions?: ReactNode
}

const OUTCOME_COLOR_CLASSES: Record<OutcomeKind, string> = {
  user_fixed: 'text-success',
  normal_behavior: 'text-info',
  handoff_informed: 'text-accent',
  handoff_unknown: 'text-accent',
}

const OUTCOME_ICONS: Record<OutcomeKind, IconName> = {
  user_fixed: 'success',
  normal_behavior: 'info',
  handoff_informed: 'wrench',
  handoff_unknown: 'wrench',
}

export function OutcomeStep({ node, manualLabel, form, actions }: OutcomeStepProps) {
  const kind: OutcomeKind = node.outcomeKind ?? 'handoff_unknown'
  const headingClasses = ['flex items-start gap-2 font-semibold', OUTCOME_COLOR_CLASSES[kind]].join(' ')

  return (
    <StepCard
      heading={
        <span className={headingClasses}>
          <Icon name={OUTCOME_ICONS[kind]} className="mt-1 h-5 w-5 shrink-0" />
          {OUTCOME_TITLES[kind]}
        </span>
      }
      reference={node.reference}
      manualLabel={manualLabel}
    >
      <p className="leading-relaxed">{node.text}</p>
      {form !== undefined && <div className="mt-5 border-t border-line pt-5">{form}</div>}
      {actions !== undefined && <div className="mt-5 space-y-3">{actions}</div>}
    </StepCard>
  )
}
