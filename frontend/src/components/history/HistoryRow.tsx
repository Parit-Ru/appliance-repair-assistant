import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeleteHistory } from '../../api/queries'
import type { HistoryListItem } from '../../api/types'
import { formatStartedAt, historyTitle, STATUS_BADGE_CLASSES } from '../../lib/historyView'
import { DEVICE_CATEGORY_LABELS, HISTORY_STATUS_LABELS } from '../../lib/labels'
import { manualTitle } from '../../lib/models'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { DeleteConfirm } from './DeleteConfirm'

interface HistoryRowProps {
  item: HistoryListItem
}

export function HistoryRow({ item }: HistoryRowProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const remove = useDeleteHistory()
  const { flow, outcomeKind } = item
  const title = historyTitle(flow)

  return (
    <li className="border-b border-line py-3">
      <div className="flex items-start gap-2">
        <Link
          to={`/history/${item.sessionId}`}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{title}</span>

            {flow !== null && (
              <span className="block text-sm text-ink-soft">
                {DEVICE_CATEGORY_LABELS[flow.deviceCategory]} · {flow.brand}{' '}
                <code className="font-mono">{manualTitle(flow)}</code>
              </span>
            )}

            <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-faint">
              <time dateTime={item.startedAt}>{formatStartedAt(item.startedAt)}</time>
              {outcomeKind !== null && (
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[outcomeKind]}`}>
                  {HISTORY_STATUS_LABELS[outcomeKind]}
                </span>
              )}
            </span>
          </span>
          <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-faint" />
        </Link>

        {!isConfirming && (
          <Button variant="text" aria-label={`ลบรายการ ${title}`} onClick={() => setIsConfirming(true)}>
            ลบ
          </Button>
        )}
      </div>

      {isConfirming && (
        <DeleteConfirm
          onConfirm={() => remove.mutate(item.sessionId)}
          onCancel={() => {
            setIsConfirming(false)
            remove.reset()
          }}
          isDeleting={remove.isPending}
          error={remove.error}/>
      )}
    </li>
  )
}
