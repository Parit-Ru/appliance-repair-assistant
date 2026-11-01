import { Link } from 'react-router-dom'
import { LINK_CLASSES } from '../components/ui/Button'
import { useAdminDrafts } from '../api/queries'
import type { DraftSummary } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { DraftStatusBadge } from '../components/admin/drafts/DraftStatusBadge'
import { UploadDraftForm } from '../components/admin/drafts/UploadDraftForm'
import { ErrorNotice } from '../components/ErrorNotice'
import { Icon } from '../components/ui/Icon'
import { LoadingText } from '../components/LoadingText'
import { draftFailureLabel } from '../lib/draftView'
import { formatStartedAt } from '../lib/historyView'

export function AdminDraftsPage() {
  const drafts = useAdminDrafts()
  const items = drafts.data?.items

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ผู้ดูแลระบบ</h1>
        <p className="text-ink-soft">ให้ AI ร่างแผนผังขั้นตอนจากคู่มือ PDF → ระบบตรวจด้วยกฎ → ผู้ดูแลตรวจและอนุมัติ → ผู้ใช้จึงเห็น</p>
      </div>

      <AdminTabs />

      <UploadDraftForm />

      <section aria-label="รายการร่าง" className="space-y-3">
        <h2 className="text-lg font-semibold">ร่างทั้งหมด</h2>

        {drafts.isPending && (
          <LoadingText>กำลังโหลดรายการร่าง</LoadingText>
        )}
        {drafts.isError && <ErrorNotice error={drafts.error} onRetry={() => void drafts.refetch()} />}

        {items !== undefined && items.length === 0 && (
          <p className="rounded-xl border border-line bg-panel p-5 text-ink-soft">ยังไม่มีร่าง — อัปโหลดคู่มือด้านบนเพื่อเริ่ม</p>
        )}

        {items !== undefined && items.length > 0 && (
          <ul className="border-t border-line">
            {items.map((draft) => (
              <DraftRow key={draft.id} draft={draft} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function DraftRow({ draft }: { draft: DraftSummary }) {
  return (
    <li className="space-y-1 border-b border-line py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DraftStatusBadge status={draft.status} />
        <Link to={`/admin/drafts/${draft.id}`} className={`font-mono ${LINK_CLASSES}`}>
          {draft.manualId}
        </Link>
        <time dateTime={draft.createdAt} className="text-sm text-ink-faint">
          {formatStartedAt(draft.createdAt)}
        </time>
      </div>
      <p className="text-sm text-ink-soft">
        {draft.brand} {draft.modelPattern} · {draft.sourceManual} · หน้า {draft.pageFrom}–{draft.pageTo}
      </p>
      {draft.status === 'drafting' && (
        <p className="flex items-center gap-2 text-sm text-info">
          <Icon name="spinner" className="h-4 w-4 animate-spin" />
          AI กำลังร่าง {draft.progress.done}/{draft.progress.total} ช่วงหน้า
        </p>
      )}
      {draft.flowCount !== null && (
        <p className="text-sm text-ink-soft">
          {draft.flowCount} แผนผังขั้นตอน
          {draft.validationCounts && ` · ข้อผิดพลาด ${draft.validationCounts.errors} · คำเตือน ${draft.validationCounts.warnings}`}
        </p>
      )}
      {draft.error && <p className="text-sm text-danger">{draftFailureLabel(draft.error.code)}</p>}
    </li>
  )
}
