import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { describeError } from '../lib/errors'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

interface ErrorNoticeProps {
  error: Error
  /** ถ้ามี จะแสดงปุ่มเมื่อข้อผิดพลาดนี้ลองซ้ำหรือดึงข้อมูลใหม่ได้ (recovery = retry / reload-session) */
  onRetry?: () => void
  /** ข้อความบนปุ่มของ recovery = reload-session (ค่าเริ่มต้นเหมือนปุ่มลองซ้ำ) */
  reloadLabel?: string
  /** ปุ่ม/ลิงก์เพิ่มเติมเฉพาะหน้า ต่อท้ายปุ่มมาตรฐาน */
  children?: ReactNode
}

const LINK_CLASSES = 'mt-3 inline-block text-accent underline-offset-4 hover:underline'

/**
 * กล่องแจ้งข้อผิดพลาดตัวเดียวของทั้งแอป (แทน SessionErrorNotice / SymptomsErrorNotice / HistoryErrorNotice)
 *
 * ข้อความมาจาก describeError ซึ่งตัดสินจาก code ไม่ใช่ message ของเซิร์ฟเวอร์
 * recovery ที่ describeError บอก ใช้เลือกปุ่ม/ลิงก์ที่ผู้ใช้ทำต่อได้ (retry / reload-session / back-to-history / login / back-to-symptoms)
 */
export function ErrorNotice({ error, onRetry, reloadLabel = 'ลองอีกครั้ง', children }: ErrorNoticeProps) {
  const described = describeError(error)

  return (
    <div role="alert">
      <Notice tone="danger" title={described.title}>
        <p>{described.detail}</p>
        {described.code !== undefined && <p className="mt-1 font-mono text-xs">รหัส: {described.code}</p>}

        {described.recovery === 'retry' && onRetry !== undefined && (
          <Button variant="secondary" className="mt-3" onClick={onRetry}>
            ลองอีกครั้ง
          </Button>
        )}
        {described.recovery === 'reload-session' && onRetry !== undefined && (
          <Button variant="secondary" className="mt-3" onClick={onRetry}>
            {reloadLabel}
          </Button>
        )}
        {described.recovery === 'back-to-history' && (
          <Link to="/history" className={LINK_CLASSES}>
            กลับไปประวัติการซ่อม
          </Link>
        )}
        {described.recovery === 'login' && (
          <Link to="/login" className={LINK_CLASSES}>
            เข้าสู่ระบบ
          </Link>
        )}
        {described.recovery === 'back-to-symptoms' && (
          <Link to="/symptoms/all" className={LINK_CLASSES}>
            เลือกอาการใหม่
          </Link>
        )}
        {children}
      </Notice>
    </div>
  )
}
