import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { describeError } from '../lib/errors'
import { Button, LINK_CLASSES } from './ui/Button'
import { Notice } from './ui/Notice'

interface ErrorNoticeProps {
  error: Error
  onRetry?: () => void
  reloadLabel?: string
  children?: ReactNode
}

const BLOCK_LINK_CLASSES = `mt-3 inline-block ${LINK_CLASSES}`

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
          <Link to="/history" className={BLOCK_LINK_CLASSES}>
            กลับไปประวัติการซ่อม
          </Link>
        )}
        {described.recovery === 'login' && (
          <Link to="/login" className={BLOCK_LINK_CLASSES}>
            เข้าสู่ระบบ
          </Link>
        )}
        {described.recovery === 'back-to-symptoms' && (
          <Link to="/symptoms/all" className={BLOCK_LINK_CLASSES}>
            เลือกอาการใหม่
          </Link>
        )}
        {children}
      </Notice>
    </div>
  )
}
