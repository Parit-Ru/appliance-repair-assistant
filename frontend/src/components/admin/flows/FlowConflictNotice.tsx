import { Link } from 'react-router-dom'
import { LINK_CLASSES } from '../../ui/Button'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'

interface FlowConflictNoticeProps {
  flowId: string
  message: string
  onReloadLatest: () => void
  isReloading: boolean
}

/**
 * Shown when another admin saved first (409 FLOW_EDIT_CONFLICT). The edits in the form are kept;
 * the admin can read the latest version in a new tab and decide, or discard the form and start from the latest.
 */
export function FlowConflictNotice({ flowId, message, onReloadLatest, isReloading }: FlowConflictNoticeProps) {
  return (
    <div role="alert">
      <Notice tone="danger" title="บันทึกไม่ได้: มีผู้ดูแลคนอื่นแก้ผังนี้ไปก่อน">
        <p>{message}</p>
        <p className="mt-2">
          <Link to={`/admin/flows/${encodeURIComponent(flowId)}`} target="_blank" rel="noreferrer" className={LINK_CLASSES}>
            เปิดฉบับล่าสุดในแท็บใหม่เพื่อเทียบ
          </Link>
        </p>
        <Button variant="secondary" className="mt-3" isLoading={isReloading} onClick={onReloadLatest}>
          ทิ้งสิ่งที่แก้ในฟอร์มนี้ แล้วโหลดฉบับล่าสุดมาแก้ใหม่
        </Button>
      </Notice>
    </div>
  )
}
