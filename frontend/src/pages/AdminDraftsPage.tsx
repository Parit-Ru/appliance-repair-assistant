import { Link } from 'react-router-dom'
import { useAdminDrafts } from '../api/queries'
import type { DraftSummary } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { DraftStatusBadge } from '../components/admin/drafts/DraftStatusBadge'
import { UploadDraftForm } from '../components/admin/drafts/UploadDraftForm'
import { HistoryErrorNotice } from '../components/history/HistoryErrorNotice'
import { Icon } from '../components/ui/Icon'
import { draftFailureLabel } from '../lib/draftView'
import { formatStartedAt } from '../lib/historyView'

/**
 * หน้า "ร่างแผนผังขั้นตอน" (/admin/drafts) — อัปโหลด PDF + รายการร่าง
 * รายการถามสถานะเองทุก 3 วินาทีเฉพาะตอนมีร่างกำลังร่างอยู่ (useAdminDrafts)
 * ร่างทุกรายการผู้ใช้ทั่วไปมองไม่เห็นจนกว่าจะเผยแพร่ (อยู่คนละตารางกับแผนผังขั้นตอนที่ใช้งานจริง)
 */
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
          <p className="flex items-center gap-2 text-ink-soft">
            <Icon name="spinner" className="h-5 w-5 animate-spin" />
            กำลังโหลดรายการร่าง
          </p>
        )}
        {drafts.isError && <HistoryErrorNotice error={drafts.error} onRetry={() => void drafts.refetch()} />}

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
        <Link to={`/admin/drafts/${draft.id}`} className="font-mono text-accent underline-offset-4 hover:underline">
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
      {draft.graphCount !== null && (
        <p className="text-sm text-ink-soft">
          {draft.graphCount} แผนผังขั้นตอน
          {draft.validationCounts && ` · ข้อผิดพลาด ${draft.validationCounts.errors} · คำเตือน ${draft.validationCounts.warnings}`}
        </p>
      )}
      {draft.error && <p className="text-sm text-danger">{draftFailureLabel(draft.error.code)}</p>}
    </li>
  )
}
