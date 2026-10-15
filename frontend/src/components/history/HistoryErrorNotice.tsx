import { Link } from 'react-router-dom'
import { describeError } from '../../lib/errors'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

interface HistoryErrorNoticeProps {
  error: Error
  /** ถ้ามี จะแสดงปุ่ม "ลองอีกครั้ง" เมื่อข้อผิดพลาดนี้ลองซ้ำได้ */
  onRetry?: () => void
}

const LINK_CLASSES = 'mt-3 inline-block text-accent underline-offset-4 hover:underline'

/**
 * กล่องแจ้งข้อผิดพลาดของหน้าประวัติ ใช้ข้อความจาก describeError (ตัดสินจาก code ไม่ใช่ message ของเซิร์ฟเวอร์)
 */
export function HistoryErrorNotice({ error, onRetry }: HistoryErrorNoticeProps) {
  const described = describeError(error)
  const canRetry = described.recovery === 'retry' || described.recovery === 'reload-session'

  return (
    <div role="alert">
      <Notice tone="danger" title={described.title}>
        <p>{described.detail}</p>
        {described.code !== undefined && <p className="mt-1 font-mono text-xs">รหัส: {described.code}</p>}

        {canRetry && onRetry !== undefined && (
          <Button variant="secondary" className="mt-3" onClick={onRetry}>
            ลองอีกครั้ง
          </Button>
        )}
        {described.recovery === 'back-to-history' && (
          <Link to="/history" className={LINK_CLASSES}>
            กลับไปประวัติการซ่อม
          </Link>
        )}
        {described.recovery === 'back-to-symptoms' && (
          <Link to="/symptoms/all" className={LINK_CLASSES}>
            เลือกอาการใหม่
          </Link>
        )}
      </Notice>
    </div>
  )
}
