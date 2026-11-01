import { Button } from '../ui/Button'
import { ErrorNotice } from '../ErrorNotice'

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
  error: Error | null
}

export function DeleteConfirm({ onConfirm, onCancel, isDeleting, error }: DeleteConfirmProps) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">
      <p className="text-ink">ลบรายการนี้ออกจากประวัติ? ลบแล้วกู้คืนไม่ได้</p>
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
