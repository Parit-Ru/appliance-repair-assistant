import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDeleteHistory, useHistoryDetail, useSubmitFeedback } from '../api/queries'
import type { HistoryDetail } from '../api/types'
import { DeleteConfirm } from '../components/history/DeleteConfirm'
import { FeedbackButtons } from '../components/history/FeedbackButtons'
import { HistoryErrorNotice } from '../components/history/HistoryErrorNotice'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { ReferenceLine } from '../components/step/ReferenceLine'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { formatStartedAt, GRAPH_CHANGED_MESSAGE, historyTitle, STATUS_BADGE_CLASSES } from '../lib/historyView'
import { DEVICE_CATEGORY_LABELS, HISTORY_STATUS_LABELS } from '../lib/labels'
import { otherSymptomsPath } from '../lib/modelSelection'
import { manualTitle } from '../lib/models'
import { formatScore } from '../lib/search'
import { toTrailEntry } from '../lib/trail'
import { useSlowWait } from '../lib/useSlowWait'
import { useStartSymptom } from '../lib/useStartSymptom'

/**
 * หน้ารายละเอียดการตรวจย้อนหลัง (/history/:sessionId)
 *
 * แสดงเฉพาะสิ่งที่ API ส่งมา: ชื่ออาการ, ผลการตรวจ (ข้อความของโหนดสุดท้ายตามคู่มือ), คำเตือนความปลอดภัยตามโหนดที่ผ่าน
 * (กล่องแดง เฉพาะเมื่อมี), คะแนน, ขั้นตอนที่ผ่านมา, แหล่งอ้างอิง, ข้อความที่ผู้ใช้บันทึกเอง และคะแนนที่ผู้ใช้ให้
 *
 * ไม่มีหัวข้อ "สาเหตุที่เป็นไปได้" เพราะระบบไม่ได้เก็บข้อมูลนี้ไว้ (ไม่ใส่หัวข้อว่าง)
 * ไม่เขียนคำแนะนำศูนย์บริการเอง: กรณีหลักฐานไม่เพียงพอ ใช้ข้อความของโหนดสุดท้ายที่เซิร์ฟเวอร์ส่งมา
 * confidence เป็น null = "ไม่มีคะแนน" (ไม่แสดงเป็น 0 หรือ "ต่ำ")
 */

const LINK_CLASSES = 'text-accent underline-offset-4 hover:underline'
const SECTION_CLASSES = 'rounded-xl border border-line bg-panel p-5'

export function HistoryDetailPage() {
  const { sessionId = '' } = useParams()
  // key: เปลี่ยน id แล้วฟอร์ม/สถานะยืนยันลบเริ่มใหม่ ไม่ติดค่าของรายการก่อนหน้า
  return <HistoryDetailView key={sessionId} sessionId={sessionId} />
}

function BackLink() {
  return (
    <Link to="/history" className={LINK_CLASSES}>
      ← ประวัติการซ่อม
    </Link>
  )
}

function HistoryDetailView({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const detail = useHistoryDetail(sessionId)
  const feedback = useSubmitFeedback(sessionId)
  const remove = useDeleteHistory()
  const { start, isStarting, error: startError } = useStartSymptom()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const isSlow = useSlowWait(detail.isPending)

  if (detail.isPending) {
    return (
      <div className="space-y-6">
        <BackLink />
        {isSlow && <SlowServerNotice />}
        <p className="flex items-center gap-2 text-ink-soft">
          <Icon name="spinner" className="h-5 w-5 animate-spin" />
          กำลังโหลดรายละเอียด
        </p>
      </div>
    )
  }

  if (detail.isError) {
    return (
      <div className="space-y-6">
        <BackLink />
        <HistoryErrorNotice error={detail.error} onRetry={() => void detail.refetch()} />
      </div>
    )
  }

  const data: HistoryDetail = detail.data
  const { graph } = data
  const title = historyTitle(graph)

  function handleDelete() {
    remove.mutate(sessionId, { onSuccess: () => navigate('/history', { replace: true }) })
  }

  /** เริ่มอาการเดิมใหม่ พาค่ารุ่นเดิมไปตามเดิม: modelSelection เป็น null ก็ไม่ส่ง (เซิร์ฟเวอร์บันทึกเป็น NULL เหมือนเดิม) */
  function handleRestart() {
    if (graph === null) return
    start(data.graphId, { manualId: graph.manualId, modelSelection: data.modelSelection ?? undefined })
  }

  // ไม่ทราบว่ามาจากหน้าเลือกรุ่น (modelSelection null) → กลับรายการทุกรุ่น ไม่พาไปหน้าของรุ่นที่จะถูกบันทึกเป็น 'selected'
  // ตรงกับที่หน้าตรวจอาการทำ (otherSymptomsPath) ป้ายจึงไม่อ้างว่า "ของรุ่นนี้" ในกรณีนั้น
  const isModelScoped = data.modelSelection !== null && graph !== null
  const otherSymptomPath = otherSymptomsPath(graph?.manualId, data.modelSelection ?? undefined)

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {graph !== null && (
          <p className="text-sm text-ink-soft">
            {DEVICE_CATEGORY_LABELS[graph.deviceCategory]} · {graph.brand}{' '}
            <code className="font-mono">{manualTitle(graph)}</code>
          </p>
        )}
        <p className="text-sm text-ink-faint">
          เริ่มตรวจ <time dateTime={data.startedAt}>{formatStartedAt(data.startedAt)}</time>
        </p>
      </header>

      {!data.available && (
        <Notice tone="info" title={GRAPH_CHANGED_MESSAGE}>
          ผังขั้นตอนของรายการนี้ถูกเปลี่ยนหลังจากที่ตรวจ จึงแสดงผลการตรวจย้อนหลังไม่ได้ ระบบไม่แสดงขั้นตอนที่อาจไม่ตรงกับตอนนั้น
        </Notice>
      )}

      {/* คำเตือนความปลอดภัย: มีเฉพาะเมื่อผังของโหนดที่ผ่านมีคำเตือนจริง (ข้อความมาจากผังตรงๆ) */}
      {data.available && data.safetyWarnings.length > 0 && (
        <Notice tone="danger" title="คำเตือนด้านความปลอดภัย">
          <ul className="list-inside list-disc space-y-1">
            {data.safetyWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Notice>
      )}

      {data.available && data.finalNode !== null && data.outcomeKind !== null && (
        <section className={SECTION_CLASSES}>
          <p className="text-sm text-ink-soft">ผลการตรวจ</p>
          <p className="mt-1">
            <span className={`rounded-full border px-2 py-0.5 text-sm font-semibold ${STATUS_BADGE_CLASSES[data.outcomeKind]}`}>
              {HISTORY_STATUS_LABELS[data.outcomeKind]}
            </span>
          </p>
          <p className="mt-3 leading-relaxed">{data.finalNode.text}</p>

          {data.reference !== null && (
            <ReferenceLine
              reference={data.reference}
              manualLabel={graph === null ? undefined : `${graph.brand} ${manualTitle(graph)}`}
            />
          )}
        </section>
      )}

      {data.available && (
        <section className={SECTION_CLASSES}>
          <p className="text-sm text-ink-soft">ความมั่นใจ</p>
          {data.confidence === null ? (
            <p className="mt-1">ไม่มีคะแนน</p>
          ) : (
            <p className="mt-1">
              คะแนนความคล้ายกับที่พิมพ์ค้นหา <span className="font-mono">{formatScore(data.confidence)}</span>{' '}
              <span className="text-sm text-ink-faint">(แสดงเป็นข้อมูลประกอบเท่านั้น)</span>
            </p>
          )}
        </section>
      )}

      {data.available && data.steps.length > 0 && (
        <section className={SECTION_CLASSES}>
          <h2 className="font-semibold">ขั้นตอนที่ผ่านมา</h2>
          <ol className="mt-3 space-y-3">
            {data.steps.map((step, index) => {
              const entry = toTrailEntry(step.node, step.action)
              return (
                <li key={`${entry.nodeId}-${index}`} className="flex gap-3">
                  <span className="w-6 shrink-0 text-right font-mono text-sm text-ink-faint">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="leading-relaxed">{entry.text}</p>
                    <p className="text-sm text-ink-soft">{entry.answerLabel}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {data.outcome !== null && (
        <section className={SECTION_CLASSES}>
          <h2 className="font-semibold">ผลที่คุณบันทึกไว้</h2>
          <p className="mt-2 whitespace-pre-wrap break-words">{data.outcome}</p>
        </section>
      )}

      {data.available && (
        <FeedbackButtons
          saved={data.feedback}
          onSubmit={(value) => feedback.mutate(value)}
          isSending={feedback.isPending}
          error={feedback.error}
        />
      )}

      {startError !== null && <HistoryErrorNotice error={startError} />}

      <div className="space-y-3">
        {graph !== null && (
          <Button variant="primary" className="w-full" onClick={handleRestart} isLoading={isStarting}>
            ตรวจอาการนี้อีกครั้ง
          </Button>
        )}
        <Button variant="secondary" className="w-full" onClick={() => navigate(otherSymptomPath)} disabled={isStarting}>
          {isModelScoped ? 'ตรวจอาการอื่นของรุ่นนี้' : 'ตรวจอาการอื่น'}
        </Button>
      </div>

      <div className="border-t border-line pt-3">
        {isConfirmingDelete ? (
          <DeleteConfirm
            onConfirm={handleDelete}
            onCancel={() => {
              setIsConfirmingDelete(false)
              remove.reset()
            }}
            isDeleting={remove.isPending}
            error={remove.error}
          />
        ) : (
          <Button variant="text" onClick={() => setIsConfirmingDelete(true)}>
            ลบรายการนี้ออกจากประวัติ
          </Button>
        )}
      </div>
    </div>
  )
}
