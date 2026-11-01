import type { ReactNode } from 'react'
import type { OutcomeKind, RenderedState } from '../../api/types'
import type { TrailEntry, TrailMarker } from '../../lib/trail'
import { Icon } from '../ui/Icon'

interface PathRailProps {
  entries: TrailEntry[]
  current: RenderedState
  children: ReactNode
}

const OUTCOME_MARKER_CLASSES: Record<OutcomeKind, string> = {
  user_fixed: 'bg-success',
  normal_behavior: 'bg-info',
  handoff_informed: 'bg-accent',
  handoff_unknown: 'bg-accent',
}

const LINE_CLASSES = 'absolute left-3 w-px -translate-x-1/2 bg-ink-faint/50'

const MARKER_BOX_CLASSES = 'absolute left-0 flex w-6 items-center justify-center bg-canvas'

function PastMarker({ marker }: { marker: TrailMarker }) {
  if (marker === 'switch-off') {
    return <Icon name="switch-off" className="h-5 w-3 text-ink-faint" />
  }
  return <span className="h-3 w-3 rounded-full border-2 border-ink-faint" />
}

function CurrentMarker({ state }: { state: RenderedState }) {
  if (state.isTerminal) {
    const kind: OutcomeKind = state.outcomeKind ?? 'handoff_unknown'
    return <span className={`h-3 w-3 rounded-sm ${OUTCOME_MARKER_CLASSES[kind]}`} />
  }
  if (state.requiresSafetyConfirmation) {
    return <Icon name="switch-on" className="h-5 w-3 text-danger" />
  }
  return <span className="h-3 w-3 rounded-full bg-accent" />
}

export function PathRail({ entries, current, children }: PathRailProps) {
  const hasPast = entries.length > 0

  return (
    <ol aria-label="เส้นทางการตรวจ">
      {entries.map((entry, index) => (
        <li key={`${index}-${entry.stateId}`} className="relative pb-6 pl-8 md:pl-10">
          <span aria-hidden className={`${LINE_CLASSES} bottom-0 ${index === 0 ? 'top-3' : 'top-0'}`} />
          <span aria-hidden className={`${MARKER_BOX_CLASSES} top-0 h-6`}>
            <PastMarker marker={entry.marker} />
          </span>
          <p className="line-clamp-2 text-sm leading-6 text-ink-soft">{entry.text}</p>
          <p className="text-sm leading-6 text-ink">{entry.answerLabel}</p>
        </li>
      ))}

      <li aria-current="step" className="relative pl-8 md:pl-10">
        {hasPast && <span aria-hidden className={`${LINE_CLASSES} top-0 h-6 md:h-7`} />}
        <span aria-hidden className={`${MARKER_BOX_CLASSES} top-5 h-5 md:top-6`}>
          <CurrentMarker state={current} />
        </span>

        {children}
      </li>
    </ol>
  )
}
