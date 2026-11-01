import { Link, useParams } from 'react-router-dom'
import { LINK_CLASSES } from '../components/ui/Button'
import { useAdminDraft } from '../api/queries'
import type { DraftDetail } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { DraftActions } from '../components/admin/drafts/DraftActions'
import { DraftFlowCard } from '../components/admin/drafts/DraftFlowCard'
import { DraftJsonEditor } from '../components/admin/drafts/DraftJsonEditor'
import { DraftStatusBadge } from '../components/admin/drafts/DraftStatusBadge'
import { ValidationReportPanel } from '../components/admin/drafts/ValidationReportPanel'
import { ErrorNotice } from '../components/ErrorNotice'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { LoadingText } from '../components/LoadingText'
import { canReject, draftFailureLabel } from '../lib/draftView'
import { formatStartedAt } from '../lib/historyView'

export function AdminDraftReviewPage() {
  const { id = '' } = useParams()
  const draft = useAdminDraft(id)
  const data = draft.data

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ผู้ดูแลระบบ</h1>
        <p>
          <Link to="/admin/drafts" className={LINK_CLASSES}>
            ← กลับไปรายการร่าง
          </Link>
        </p>
      </div>

      <AdminTabs />

      {draft.isPending && (
        <LoadingText>กำลังโหลดร่าง</LoadingText>
      )}
      {draft.isError && <ErrorNotice error={draft.error} onRetry={() => void draft.refetch()} />}

      {data !== undefined && <DraftBody draft={data} onRefresh={() => void draft.refetch()} />}
    </div>
  )
}

function DraftBody({ draft, onRefresh }: { draft: DraftDetail; onRefresh: () => void }) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-xl font-semibold">{draft.manualId}</h2>
          <DraftStatusBadge status={draft.status} />
        </div>
        <p className="text-sm text-ink-soft">
          {draft.meta.brand} {draft.meta.model_pattern} · {draft.meta.source_manual} · หน้า {draft.meta.page_from}–{draft.meta.page_to}
          {draft.meta.display_name ? ` · ชื่อที่แสดง: ${draft.meta.display_name}` : ''}
        </p>
        <p className="text-xs text-ink-faint">
          สร้างเมื่อ {formatStartedAt(draft.createdAt)} · โมเดล {draft.llm.model ?? '-'} · prompt {draft.llm.promptVersion ?? '-'}
        </p>
      </header>

      {draft.status === 'published' ? (
        <Notice tone="info" title="เผยแพร่แล้ว">
          แผนผังขั้นตอนจากร่างนี้ผู้ใช้เห็นแล้ว{draft.publishedAt ? ` (เมื่อ ${formatStartedAt(draft.publishedAt)})` : ''} · ลบได้ด้วย SQL เท่านั้น (ดู docs/authoring-step5.md)
        </Notice>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-accent/60 bg-accent/10 p-4">
          <p className="font-semibold text-accent">ร่างโดย AI · ยังไม่เผยแพร่</p>
          <p className="text-sm text-ink">ผู้ใช้ทั่วไปมองไม่เห็นร่างนี้ เนื้อหาอาจผิดจากคู่มือ — ต้องตรวจทุกสถานะเทียบหน้าต้นฉบับก่อนอนุมัติ</p>
        </div>
      )}

      {draft.status === 'drafting' && (
        <p role="status" className="flex items-center gap-2 text-info">
          <Icon name="spinner" className="h-5 w-5 animate-spin" />
          AI กำลังร่าง {draft.progress.done}/{draft.progress.total} ช่วงหน้า — หน้านี้อัปเดตเองทุก 3 วินาที
        </p>
      )}

      {draft.error && (
        <Notice tone="danger" title={draft.status === 'rejected' ? 'ปฏิเสธแล้ว' : 'ร่างไม่สำเร็จ'}>
          <p>{draftFailureLabel(draft.error.code)}</p>
          {draft.error.message && <p className="mt-1 text-sm text-ink-soft">{draft.error.message}</p>}
          <p className="mt-1 font-mono text-xs">รหัส: {draft.error.code}</p>
        </Notice>
      )}

      {draft.flows !== null && (
        <>
          <ValidationReportPanel report={draft.validation} />

          <section aria-label="แผนผังขั้นตอนในร่าง" className="space-y-4">
            <h2 className="text-lg font-semibold">แผนผังขั้นตอนในร่าง ({draft.flows.length})</h2>
            {draft.flows.map((flow) => (
              <DraftFlowCard key={flow.flow_id} flow={flow} draft={draft} />
            ))}
          </section>

          {draft.status === 'ready' && <DraftJsonEditor key={draft.updatedAt} draftId={draft.id} flows={draft.flows} />}
        </>
      )}

      {(draft.status === 'ready' || canReject(draft.status)) && <DraftActions draft={draft} onRefresh={onRefresh} />}
    </div>
  )
}
