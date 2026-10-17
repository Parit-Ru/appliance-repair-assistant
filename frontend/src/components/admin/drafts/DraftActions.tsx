import { useId, useState } from 'react'
import { usePublishDraft, useRejectDraft, useRetryDraft } from '../../../api/queries'
import type { DraftDetail } from '../../../api/types'
import { canReject, canRetry, publishGate } from '../../../lib/draftView'
import { HistoryErrorNotice } from '../../history/HistoryErrorNotice'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'

const CHECKBOX_CLASSES = 'mt-1 h-5 w-5 shrink-0 accent-accent'

/**
 * ลองร่างใหม่ / ปฏิเสธ / เผยแพร่
 *
 * การเผยแพร่: ต้องติ๊ก "ตรวจแล้ว" เสมอ และถ้ามีคำเตือนต้องติ๊กรับทราบคำเตือน (ส่ง acknowledgedWarnings: true)
 * ปุ่มปิดเมื่อมีข้อผิดพลาด — เป็น UX เท่านั้น: backend ตรวจซ้ำทุกครั้ง error = ปฏิเสธเด็ดขาด ไม่มี override
 */
export function DraftActions({ draft, onRefresh }: { draft: DraftDetail; onRefresh: () => void }) {
  const reasonId = useId()
  const retry = useRetryDraft(draft.id)
  const reject = useRejectDraft(draft.id)
  const publish = usePublishDraft(draft.id)

  const [reviewed, setReviewed] = useState(false)
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const [reason, setReason] = useState('')

  const warnings = draft.validation?.warnings.length ?? 0
  const gate = publishGate(draft, reviewed, warningsAcknowledged)
  const busy = retry.isPending || reject.isPending || publish.isPending

  if (publish.isSuccess) {
    const result = publish.data
    return (
      <div role="status">
        <Notice tone="info" title="เผยแพร่แล้ว">
          <p>แผนผังขั้นตอนใหม่ {result.graphIds.length} อัน ใช้งานได้ทันทีโดยไม่ต้องรีสตาร์ต:</p>
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {result.graphIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            {result.searchIndex.indexed
              ? 'เพิ่มเข้าระบบค้นหาอาการด้วยข้อความแล้ว'
              : `ยังไม่ได้เพิ่มเข้าระบบค้นหาด้วยข้อความ (${result.searchIndex.reason ?? 'ไม่ทราบสาเหตุ'}) — เลือกจากรายการอาการได้ตามปกติ และจะค้นเจอหลังรีสตาร์ต`}
          </p>
        </Notice>
      </div>
    )
  }

  return (
    <section aria-label="ตัดสินร่าง" className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold">ตัดสินร่าง</h2>

      {canRetry(draft.status) && (
        <div className="space-y-2">
          <p className="text-sm text-ink-soft">ลองให้ AI ร่างใหม่จากข้อความหน้าเดิม (ไม่ต้องอัปโหลดไฟล์ซ้ำ)</p>
          <Button variant="secondary" isLoading={retry.isPending} disabled={busy} onClick={() => retry.mutate(undefined, { onSuccess: onRefresh })}>
            ลองร่างใหม่
          </Button>
          {retry.isError && <HistoryErrorNotice error={retry.error} onRetry={onRefresh} />}
        </div>
      )}

      {draft.status === 'ready' && (
        <div className="space-y-3">
          <label className="flex gap-3 text-sm text-ink">
            <input type="checkbox" className={CHECKBOX_CLASSES} checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} disabled={busy} />
            <span>ฉันตรวจข้อความทุกโหนดเทียบกับหน้าต้นฉบับ และตรวจด่านความปลอดภัย (ขั้นตอนที่เกี่ยวกับไฟฟ้า แก๊ส ความร้อน) ครบแล้ว</span>
          </label>
          {warnings > 0 && (
            <label className="flex gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className={CHECKBOX_CLASSES}
                checked={warningsAcknowledged}
                onChange={(e) => setWarningsAcknowledged(e.target.checked)}
                disabled={busy}
              />
              <span>ฉันอ่านคำเตือนทั้ง {warnings} ข้อในรายงานการตรวจแล้ว และยืนยันว่าเผยแพร่ได้</span>
            </label>
          )}

          <Button isLoading={publish.isPending} disabled={!gate.enabled || busy} onClick={() => publish.mutate(gate.acknowledgedWarnings, { onError: onRefresh })}>
            เผยแพร่ให้ผู้ใช้เห็น
          </Button>
          {gate.reason && <p className="text-sm text-ink-soft">{gate.reason}</p>}
          {publish.isError && <HistoryErrorNotice error={publish.error} onRetry={onRefresh} />}
        </div>
      )}

      {canReject(draft.status) && (
        <div className="space-y-2 border-t border-line pt-4">
          {!confirmReject ? (
            <Button variant="text" disabled={busy} onClick={() => setConfirmReject(true)}>
              ปฏิเสธร่างนี้
            </Button>
          ) : (
            <>
              <label htmlFor={reasonId} className="block text-sm text-ink-soft">
                เหตุผลที่ปฏิเสธ (ไม่บังคับ ไม่เกิน 300 ตัวอักษร)
              </label>
              <textarea
                id={reasonId}
                value={reason}
                maxLength={300}
                rows={2}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-line bg-canvas p-2 text-sm text-ink"
              />
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" isLoading={reject.isPending} disabled={busy} onClick={() => reject.mutate(reason)}>
                  ยืนยันปฏิเสธ
                </Button>
                <Button variant="text" disabled={busy} onClick={() => setConfirmReject(false)}>
                  ยกเลิก
                </Button>
              </div>
            </>
          )}
          {reject.isError && <HistoryErrorNotice error={reject.error} onRetry={onRefresh} />}
        </div>
      )}
    </section>
  )
}
