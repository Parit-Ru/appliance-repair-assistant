import type { DraftStatus } from '../../../api/types'
import { DRAFT_STATUS_CLASSES, DRAFT_STATUS_LABELS } from '../../../lib/draftView'

/** ป้ายสถานะร่าง — สีเป็นตัวเสริม ความหมายอยู่ที่ข้อความเสมอ */
export function DraftStatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DRAFT_STATUS_CLASSES[status]}`}>
      {DRAFT_STATUS_LABELS[status]}
    </span>
  )
}
