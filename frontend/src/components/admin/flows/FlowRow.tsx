import { Link } from 'react-router-dom'
import type { AdminFlowListItem } from '../../../api/types'
import { deletedByLine, editedByLine, flowTitle } from '../../../lib/flowView'
import { formatStartedAt } from '../../../lib/historyView'
import { DEVICE_CATEGORY_LABELS } from '../../../lib/labels'
import { LINK_CLASSES } from '../../ui/Button'

export function FlowRow({ item }: { item: AdminFlowListItem }) {
  const edited = editedByLine(item, formatStartedAt)
  const deleted = deletedByLine(item, formatStartedAt)

  return (
    <li className="space-y-1 border-b border-line py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={`/admin/flows/${encodeURIComponent(item.flowId)}`} className={`font-semibold ${LINK_CLASSES}`}>
          {flowTitle(item)}
        </Link>
        {item.status === 'deleted' && (
          <span className="rounded-full border border-danger/40 px-2.5 py-0.5 text-xs font-semibold text-danger">ลบแล้ว</span>
        )}
        {item.revision > 0 && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">แก้แล้ว {item.revision} ครั้ง</span>}
      </div>
      <p className="text-sm text-ink-soft">
        {DEVICE_CATEGORY_LABELS[item.deviceCategory]} · {item.brand} {item.displayName ?? item.modelPattern} · {item.stateCount} ขั้นตอน
      </p>
      <p className="break-all font-mono text-xs text-ink-faint">{item.flowId}</p>
      <p className="text-xs text-ink-faint">
        ตรวจแล้ว {item.sessionCount} ครั้ง{item.activeSessionCount > 0 ? ` · กำลังเดินอยู่ ${item.activeSessionCount}` : ''}
      </p>
      {edited !== null && <p className="text-xs text-ink-soft">{edited}</p>}
      {deleted !== null && <p className="text-xs text-danger">{deleted}</p>}
    </li>
  )
}
