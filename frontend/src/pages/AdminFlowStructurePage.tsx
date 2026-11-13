import { useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/http'
import { useAdminFlow, useUpdateAdminFlowStructure } from '../api/queries'
import type { AdminFlowDetail } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { FlowConflictNotice } from '../components/admin/flows/FlowConflictNotice'
import { ErrorNotice } from '../components/ErrorNotice'
import { LoadingText } from '../components/LoadingText'
import { Button, LINK_CLASSES } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { flowTitle } from '../lib/flowView'

/** The editable part of a flow as JSON: same shape the draft editor uses (author_note and null values are left out) */
function formatStructure(detail: AdminFlowDetail): string {
  const states = detail.flow.states.map((state) =>
    Object.fromEntries(Object.entries(state).filter(([key, value]) => value !== null && value !== undefined && key !== 'author_note')),
  )
  return JSON.stringify({ initial_state: detail.flow.initial_state, states }, null, 2)
}

export function AdminFlowStructurePage() {
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

      {/* key = revision: a newer revision (after "load latest") starts a fresh editor */}
      {flow.data !== undefined && flow.data.status === 'active' && (
        <StructureEditor
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

interface StructureEditorProps {
  detail: AdminFlowDetail
  detailPath: string
  onReloadLatest: () => Promise<void>
}

function StructureEditor({ detail, detailPath, onReloadLatest }: StructureEditorProps) {
  const navigate = useNavigate()
  const textareaId = useId()
  const hintId = useId()
  const original = formatStructure(detail)
  const [text, setText] = useState(original)
  const [acknowledged, setAcknowledged] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const save = useUpdateAdminFlowStructure(detail.flowId)

  const changed = text !== original
  const title = flowTitle({ entrySymptomTh: detail.flow.entry_symptom_th, entrySymptom: detail.flow.entry_symptom })
  const conflict = save.error instanceof ApiError && save.error.code === 'FLOW_EDIT_CONFLICT' ? save.error : undefined
  const needsAcknowledge = save.error instanceof ApiError && save.error.code === 'FLOW_STRUCTURE_WARNINGS_UNACKNOWLEDGED'

  function submit() {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setLocalError(`JSON ไม่ถูกต้อง: ${err instanceof Error ? err.message : 'อ่านไม่ได้'}`)
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setLocalError('ต้องเป็น object ที่มี initial_state และ states')
      return
    }
    const { initial_state, states } = parsed as { initial_state?: unknown; states?: unknown }
    if (typeof initial_state !== 'string' || !Array.isArray(states)) {
      setLocalError('ต้องมี initial_state (ข้อความ) และ states (อาร์เรย์)')
      return
    }
    setLocalError(null)
    save.mutate(
      { expectedRevision: detail.revision, acknowledgedWarnings: acknowledged, initial_state, states: states as Array<Record<string, unknown>> },
      { onSuccess: (result) => navigate(detailPath, { state: { savedStructure: result.changed } }) },
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">แก้โครงสร้าง: {title}</h2>
        <p className="break-all font-mono text-xs text-ink-faint">{detail.flowId}</p>
      </header>

      <div className="rounded-xl border-2 border-dashed border-accent/60 bg-accent/10 p-4">
        <p className="font-semibold text-accent">บันทึกแล้วมีผลกับผู้ใช้ทันที</p>
        <p className="text-sm text-ink">
          เพิ่ม/ลบขั้นตอนและแก้เส้นทางได้ (on_yes, on_no, next, on_invalid) ระบบตรวจโครงสร้างทั้งผังก่อนบันทึก (เดินถึงทุกขั้น ไปถึงจุดจบได้ ตัวแปรครบ ด่านความปลอดภัย) ถ้าไม่ผ่านจะไม่บันทึก · ลบขั้นตอนที่มีผู้ใช้กำลังเดินอยู่ไม่ได้ · ระบบเก็บฉบับเดิมและชื่อผู้แก้ไว้ทุกครั้ง ·
          state_id ใช้ได้เฉพาะ a-z 0-9 และ _ (แนะนำให้ขึ้นต้นด้วย n เหมือนผังที่สร้างจากคู่มือ)
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

      <section aria-label="แก้โครงสร้างผัง" className="space-y-3 rounded-xl border border-line bg-panel p-5">
        <p id={hintId} className="text-sm text-ink-soft">
          แก้ JSON ด้านล่าง: ฟิลด์ระดับผัง (อาการ ความรุนแรง หน้าต้นฉบับ) แก้ที่นี่ไม่ได้ ระบบใช้ค่าเดิม · author_note ไม่แสดงและคงไว้ให้เอง
        </p>
        <label htmlFor={textareaId} className="sr-only">
          JSON ของโครงสร้างผัง
        </label>
        <textarea
          id={textareaId}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setLocalError(null)
          }}
          aria-describedby={hintId}
          spellCheck={false}
          rows={24}
          disabled={save.isPending}
          className="w-full rounded-lg border border-line bg-canvas p-3 font-mono text-xs text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {localError && (
          <p role="alert" className="text-sm text-danger">
            {localError}
          </p>
        )}
        {needsAcknowledge && (
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" />
            <span>ฉันอ่านคำเตือนด้านบนแล้ว และยืนยันว่าตั้งใจ (ติ๊กแล้วกดบันทึกอีกครั้ง)</span>
          </label>
        )}
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-canvas py-3">
        <Button onClick={submit} disabled={!changed || save.isPending || (needsAcknowledge && !acknowledged)} isLoading={save.isPending}>
          ตรวจและบันทึก
        </Button>
        <Button
          variant="secondary"
          disabled={!changed || save.isPending}
          onClick={() => {
            setText(original)
            setLocalError(null)
          }}
        >
          คืนค่าเดิม
        </Button>
        <Link to={detailPath} className={LINK_CLASSES}>
          ยกเลิก
        </Link>
        {!changed && <span className="text-sm text-ink-faint">ยังไม่ได้แก้อะไร</span>}
      </div>
    </div>
  )
}
