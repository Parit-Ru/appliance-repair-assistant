import { ErrorNotice } from '../../ErrorNotice'
import { Button } from '../../ui/Button'

interface FlowDeleteConfirmProps {
  title: string
  activeSessions: number
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
  error: Error | null
}

/** Asks before hiding a flow from users. Deleting is reversible (restore), and history and running sessions are kept. */
export function FlowDeleteConfirm({ title, activeSessions, onConfirm, onCancel, isDeleting, error }: FlowDeleteConfirmProps) {
  return (
    <div className="space-y-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">
      <p className="font-semibold text-ink">ลบแผนผังขั้นตอน “{title}” ?</p>
      <ul className="list-inside list-disc space-y-1 text-ink">
        <li>ผู้ใช้จะไม่เห็นอาการนี้ในรายการ ค้นหาไม่เจอ และเริ่มตรวจใหม่ไม่ได้</li>
        <li>
          ประวัติการตรวจ ความเห็น และสถิติเดิมยังอยู่ครบ
          {activeSessions > 0 ? ` · ผู้ใช้ ${activeSessions} คนที่กำลังตรวจอยู่เดินต่อจนจบได้` : ''}
        </li>
        <li>กู้คืนได้ภายหลังจากแท็บ “แผนผังที่เผยแพร่” (ตัวกรอง “ลบแล้ว”)</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onConfirm} isLoading={isDeleting}>
          ยืนยันลบ
        </Button>
        <Button variant="text" onClick={onCancel} disabled={isDeleting}>
          ยกเลิก
        </Button>
      </div>
      {error !== null && <ErrorNotice error={error} />}
    </div>
  )
}
