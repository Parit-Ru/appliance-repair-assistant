import type { ReactNode } from 'react'
import type { NodeReference } from '../../api/types'
import { ReferenceLine } from './ReferenceLine'

type StepCardTone = 'default' | 'danger'

interface StepCardProps {
  label?: string
  heading: ReactNode
  tone?: StepCardTone
  notice?: ReactNode
  reference: NodeReference
  manualLabel?: string
  children?: ReactNode
}

const TONE_CLASSES: Record<StepCardTone, string> = {
  default: 'border border-line',
  danger: 'border-2 border-danger',
}

export function StepCard({ label, heading, tone = 'default', notice, reference, manualLabel, children }: StepCardProps) {
  const classes = ['rounded-xl bg-panel p-5 md:p-6', TONE_CLASSES[tone]].join(' ')

  return (
    <section className={classes}>
      {label !== undefined && <p className="mb-2 text-sm text-ink-soft">{label}</p>}

      {notice !== undefined && <div className="mb-4">{notice}</div>}

      <h2 tabIndex={-1} aria-live="polite" className="text-lg leading-relaxed outline-none">
        {heading}
      </h2>

      {children !== undefined && <div className="mt-5">{children}</div>}

      <ReferenceLine reference={reference} manualLabel={manualLabel} />
    </section>
  )
}
