import { useNavigate } from 'react-router-dom'
import { describeError } from '../lib/errors'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

interface SessionErrorNoticeProps {
  error: Error
  onRefresh: () => void
}

export function SessionErrorNotice({ error, onRefresh }: SessionErrorNoticeProps) {
  const navigate = useNavigate()
  const described = describeError(error)

  return (
    <Notice tone="danger" title={described.title}>
      <p>{described.detail}</p>
      {described.code !== undefined && <p className="mt-1 font-mono text-xs">รหัส: {described.code}</p>}

      {described.recovery === 'retry' && (
        <Button variant="secondary" className="mt-3" onClick={onRefresh}>
          ลองอีกครั้ง
        </Button>
      )}
      {described.recovery === 'reload-session' && (
        <Button variant="secondary" className="mt-3" onClick={onRefresh}>
          ดึงขั้นตอนล่าสุด
        </Button>
      )}
      {described.recovery === 'back-to-symptoms' && (
        <Button variant="secondary" className="mt-3" onClick={() => navigate('/symptoms')}>
          เลือกอาการใหม่
        </Button>
      )}
    </Notice>
  )
}
