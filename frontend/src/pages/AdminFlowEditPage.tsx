import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/http'
import { useAdminFlow, useUpdateAdminFlow } from '../api/queries'
import type { AdminFlowDetail } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { FlowConflictNotice } from '../components/admin/flows/FlowConflictNotice'
import { StateEditorCard } from '../components/admin/flows/StateEditorCard'
import { ErrorNotice } from '../components/ErrorNotice'
import { LoadingText } from '../components/LoadingText'
import { Button, LINK_CLASSES } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { buildEdits, changedStateIds, draftProblems, initialDrafts } from '../lib/flowEditor'
import type { StateDraft } from '../lib/flowEditor'
import { flowTitle } from '../lib/flowView'

export function AdminFlowEditPage() {
  const { id = '' } = useParams()
  const flow = useAdminFlow(id)
  const detailPath = `/admin/flows/${encodeURIComponent(id)}`

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ผู้ดูแลระบบ</h1>
        <p>
          <Link to={detailPath} className={LINK_CLASSES}>
            ← กลับไปดูแผนผังขั้นตอน (ไม่บันทึก)
          </Link>
        </p>
      </div>

      <AdminTabs />

      {flow.isPending && <LoadingText>กำลังโหลดแผนผังขั้นตอน</LoadingText>}
      {flow.isError && <ErrorNotice error={flow.error} onRetry={() => void flow.refetch()} />}

      {flow.data !== undefined && flow.data.status === 'deleted' && (
        <Notice tone="danger" title="แผนผังขั้นตอนนี้ถูกลบแล้ว">
          แก้ไขไม่ได้ กลับไปหน้ารายละเอียดเพื่อกู้คืนก่อน
        </Notice>
      )}

      {/* key = revision: a newer revision (after "load latest") starts a fresh form; refetching the same revision keeps the typing */}
      {flow.data !== undefined && flow.data.status === 'active' && (
        <EditBody
          key={flow.data.revision}
          detail={flow.data}
          detailPath={detailPath}
          onReloadLatest={async () => {
            await flow.refetch()
          }}
        />
      )}
    </div>
  )
}

interface EditBodyProps {
  detail: AdminFlowDetail
  detailPath: string
  onReloadLatest: () => Promise<void>
}

function EditBody({ detail, detailPath, onReloadLatest }: EditBodyProps) {
  const navigate = useNavigate()
  const states = detail.flow.states
  const [drafts, setDrafts] = useState(() => initialDrafts(states))
  const [isReloading, setIsReloading] = useState(false)
  const save = useUpdateAdminFlow(detail.flowId)

  const changedIds = changedStateIds(states, drafts)
  const problems = draftProblems(states, drafts)
  const hasProblems = Object.keys(problems).length > 0
  const canSave = changedIds.length > 0 && !hasProblems && !save.isPending

  // Leaving the page with unsaved edits asks the browser to confirm
  const dirty = changedIds.length > 0 && !save.isSuccess
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function patch(stateId: string, change: Partial<StateDraft>) {
    setDrafts((previous) => ({ ...previous, [stateId]: { ...previous[stateId], ...change } }))
  }

  function submit() {
    save.mutate(
      { expectedRevision: detail.revision, states: buildEdits(states, drafts) },
      { onSuccess: (result) => navigate(detailPath, { state: { savedStates: result.changedStates } }) },
    )
  }

  const conflict = save.error instanceof ApiError && save.error.code === 'FLOW_EDIT_CONFLICT' ? save.error : undefined
  const title = flowTitle({ entrySymptomTh: detail.flow.entry_symptom_th, entrySymptom: detail.flow.entry_symptom })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">แก้ข้อความ: {title}</h2>
        <p className="break-all font-mono text-xs text-ink-faint">{detail.flowId}</p>
      </header>

      <div className="rounded-xl border-2 border-dashed border-accent/60 bg-accent/10 p-4">
        <p className="font-semibold text-accent">บันทึกแล้วมีผลกับผู้ใช้ทันที</p>
        <p className="text-sm text-ink">
          แก้ได้เฉพาะข้อความของขั้นตอนที่มีอยู่ ส่วนการเพิ่ม/ลบขั้นตอนและเส้นทางแก้ไม่ได้ในหน้านี้ · ระบบเก็บข้อความเดิมและชื่อผู้แก้ไว้ทุกครั้ง · ระวังอย่าเอาคำเตือนความปลอดภัยออก
        </p>
      </div>

      {conflict !== undefined && (
        <FlowConflictNotice
          flowId={detail.flowId}
          message={conflict.message}
          isReloading={isReloading}
          onReloadLatest={() => {
            setIsReloading(true)
            void onReloadLatest().finally(() => setIsReloading(false))
          }}
        />
      )}
      {save.isError && conflict === undefined && <ErrorNotice error={save.error} />}

      <ol>
        {states.map((state) => (
          <StateEditorCard
            key={state.state_id}
            state={state}
            draft={drafts[state.state_id]}
            changed={changedIds.includes(state.state_id)}
            problem={problems[state.state_id]}
            activeCount={detail.usage.activeByState[state.state_id] ?? 0}
            disabled={save.isPending}
            onChange={(change) => patch(state.state_id, change)}
          />
        ))}
      </ol>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-canvas py-3">
        <Button onClick={submit} disabled={!canSave} isLoading={save.isPending}>
          บันทึก{changedIds.length > 0 ? ` (${changedIds.length} ขั้นตอน)` : ''}
        </Button>
        <Link to={detailPath} className={LINK_CLASSES}>
          ยกเลิก
        </Link>
        {changedIds.length === 0 && <span className="text-sm text-ink-faint">ยังไม่ได้แก้อะไร</span>}
        {hasProblems && <span className="text-sm text-danger">แก้ช่องที่มีข้อผิดพลาดก่อนบันทึก</span>}
      </div>
    </div>
  )
}
