import type { GraphSummary } from '../api/types'
import { formatScore } from '../lib/search'
import { symptomName } from '../lib/symptoms'
import { Icon } from './ui/Icon'

interface SymptomRowProps {
  summary: Pick<GraphSummary, 'graphId' | 'entrySymptom' | 'entrySymptomTh'>
  isStarting: boolean
  disabled: boolean
  onSelect: (graphId: string) => void
  score?: number
  matchedText?: string
}

const BASE_CLASSES = 'flex min-h-12 w-full items-center gap-3 px-1 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function SymptomRow({ summary, isStarting, disabled, onSelect, score, matchedText }: SymptomRowProps) {
  const stateClasses = isStarting ? 'cursor-wait' : disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-panel'
  const classes = `${BASE_CLASSES} ${stateClasses}`

  return (
    <li className="border-b border-line">
      <button type="button" disabled={isStarting || disabled} aria-busy={isStarting || undefined} className={classes} onClick={() => onSelect(summary.graphId)}>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{symptomName(summary)}</span>

          <span className="block text-sm text-ink-faint">{summary.entrySymptom}</span>
          {score !== undefined && (
            <span className="mt-1 block text-sm text-ink-soft">
              คะแนนความคล้าย <span className="font-mono">{formatScore(score)}</span>
              {matchedText !== undefined && <> · ใกล้กับ “{matchedText}”</>}
            </span>
          )}
        </span>

        {isStarting ? (
          <span className="flex shrink-0 items-center gap-2 text-sm text-accent">
            <Icon name="spinner" className="h-4 w-4 animate-spin" />
            กำลังเริ่ม
          </span>
        ) : (
          <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-faint" />
        )}
      </button>
    </li>
  )
}
