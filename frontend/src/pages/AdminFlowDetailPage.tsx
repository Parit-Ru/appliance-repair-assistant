import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAdminFlow, useDeleteAdminFlow, useRestoreAdminFlow } from '../api/queries'
import type { AdminFlowDetail } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { FlowDeleteConfirm } from '../components/admin/flows/FlowDeleteConfirm'
import { FlowStructure } from '../components/admin/flows/FlowStructure'
import { ErrorNotice } from '../components/ErrorNotice'
import { LoadingText } from '../components/LoadingText'
import { Button, LINK_CLASSES } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { deletedByLine, editedByLine, flowTitle } from '../lib/flowView'
import { formatStartedAt } from '../lib/historyView'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'

export function AdminFlowDetailPage() {
  const { id = '' } = useParams()
  const flow = useAdminFlow(id)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ผู้ดูแลระบบ</h1>
        <p>
          <Link to="/admin/flows" className={LINK_CLASSES}>
            ← กลับไปรายการแผนผังขั้นตอน
          </Link>
        </p>
      </div>

      <AdminTabs />

      {flow.isPending && <LoadingText>กำลังโหลดแผนผังขั้นตอน</LoadingText>}
      {flow.isError && <ErrorNotice error={flow.error} onRetry={() => void flow.refetch()} />}
      {flow.data !== undefined && <FlowBody detail={flow.data} />}
    </div>
  )
}

function FlowBody({ detail }: { detail: AdminFlowDetail }) {
  const title = flowTitle({ entrySymptomTh: detail.flow.entry_symptom_th, entrySymptom: detail.flow.entry_symptom })
  const edited = editedByLine(detail, formatStartedAt)
  const deleted = deletedByLine(detail, formatStartedAt)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const remove = useDeleteAdminFlow(detail.flowId)
  const restore = useRestoreAdminFlow(detail.flowId)
  const location = useLocation()
  const savedState = (location.state as { savedStates?: unknown } | null)?.savedStates
  const saved = typeof savedState === 'number' ? savedState : undefined
  const savedStructure = (location.state as { savedStructure?: unknown } | null)?.savedStructure

  return (
    <div className="space-y-6">
      <header className="space-y-2 rounded-xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {detail.status === 'deleted' && (
            <span className="rounded-full border border-danger/40 px-2.5 py-0.5 text-xs font-semibold text-danger">ลบแล้ว</span>
          )}
        </div>
        <p className="text-sm text-ink-soft">{detail.flow.entry_symptom}</p>
        <p className="text-sm text-ink-soft">
          {DEVICE_CATEGORY_LABELS[detail.deviceCategory]} · {detail.brand} {detail.displayName ?? detail.modelPattern} · {detail.sourceManual}
        </p>
        <p className="text-xs text-ink-faint">
          <span className="break-all font-mono">{detail.flowId}</span> · หน้า {detail.flow.page_range[0]}–{detail.flow.page_range[1]}
          {detail.flow.severity ? ` · ความรุนแรง ${detail.flow.severity}` : ''}
          {detail.flow.difficulty ? ` · ความยาก ${detail.flow.difficulty}` : ''}
        </p>
        {detail.flow.entry_symptom_aliases.length > 0 && (
          <p className="text-xs text-ink-faint">คำที่ผู้ใช้อาจพิมพ์: {detail.flow.entry_symptom_aliases.join(' · ')}</p>
        )}
        <p className="text-sm text-ink-soft">
          ตรวจแล้ว {detail.usage.sessions} ครั้ง (จบ {detail.usage.completed}) · ความเห็น {detail.usage.feedback} รายการ
        </p>
        <p className="text-xs text-ink-faint">
          {edited ?? 'ยังไม่เคยถูกแก้ไขโดยผู้ดูแล'}
          {detail.revision > 0 ? ` (แก้แล้ว ${detail.revision} ครั้ง)` : ''}
        </p>
        {deleted !== null && <p className="text-sm text-danger">{deleted}</p>}
      </header>

      {saved !== undefined && (
        <div role="status">
          <Notice tone="info" title="บันทึกแล้ว">
            {saved === 0 ? 'ไม่มีข้อความที่เปลี่ยน จึงไม่ได้บันทึกอะไร' : `แก้ข้อความ ${saved} ขั้นตอนแล้ว ผู้ใช้เห็นข้อความใหม่ทันที`}
          </Notice>
        </div>
      )}

      {typeof savedStructure === 'boolean' && (
        <div role="status">
          <Notice tone="info" title="บันทึกแล้ว">
            {savedStructure ? 'แก้โครงสร้างผังแล้ว ผู้ใช้เห็นผังใหม่ทันที' : 'โครงสร้างไม่เปลี่ยน จึงไม่ได้บันทึกอะไร'}
          </Notice>
        </div>
      )}

      {detail.status === 'active' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link to={`/admin/flows/${encodeURIComponent(detail.flowId)}/edit`} className={`${LINK_CLASSES} font-semibold`}>
              แก้ไขข้อความของขั้นตอน
            </Link>
            <Link to={`/admin/flows/${encodeURIComponent(detail.flowId)}/structure`} className={`${LINK_CLASSES} font-semibold`}>
              แก้โครงสร้าง (เพิ่ม/ลบขั้นตอน เส้นทาง)
            </Link>
            {!isConfirmingDelete && (
              <Button variant="secondary" onClick={() => setIsConfirmingDelete(true)}>
                ลบแผนผังนี้
              </Button>
            )}
          </div>
          {isConfirmingDelete && (
            <FlowDeleteConfirm
              title={title}
              activeSessions={Object.values(detail.usage.activeByState).reduce((sum, count) => sum + count, 0)}
              isDeleting={remove.isPending}
              error={remove.error}
              onCancel={() => {
                setIsConfirmingDelete(false)
                remove.reset()
              }}
              onConfirm={() => remove.mutate(undefined, { onSuccess: () => setIsConfirmingDelete(false) })}
            />
          )}
        </div>
      )}

      {detail.status === 'deleted' && (
        <div className="space-y-3">
          <Notice tone="danger" title="แผนผังขั้นตอนนี้ถูกลบแล้ว">
            ผู้ใช้ไม่เห็นและเริ่มตรวจใหม่ไม่ได้ แต่ประวัติและสถิติเดิมยังอยู่ · แก้ไขข้อความไม่ได้จนกว่าจะกู้คืน
          </Notice>
          <Button variant="primary" onClick={() => restore.mutate()} isLoading={restore.isPending}>
            กู้คืนแผนผังนี้
          </Button>
          {restore.isError && <ErrorNotice error={restore.error} />}
        </div>
      )}

      {restore.isSuccess && !restore.data.searchIndex.indexed && (
        <Notice tone="info" title="กู้คืนแล้ว แต่ระบบค้นหายังไม่อัปเดต">
          {restore.data.searchIndex.reason ?? 'ดัชนีค้นหายังไม่ถูกอัปเดต'} · ผู้ใช้ยังเลือกอาการนี้จากรายการได้
        </Notice>
      )}

      <FlowStructure detail={detail} />
    </div>
  )
}
