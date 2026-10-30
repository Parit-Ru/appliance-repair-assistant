import { Link } from 'react-router-dom'
import { LINK_CLASSES } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

export function ForbiddenPage() {
  return (
    <div className="space-y-4">
      <Icon name="warning" className="h-8 w-8 text-accent" />
      <h1 className="text-2xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p className="text-ink-soft">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น บัญชีของคุณใช้งานส่วนอื่นของเว็บได้ตามปกติ</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/" className={LINK_CLASSES}>
          กลับหน้าแรก
        </Link>
        <Link to="/history" className={LINK_CLASSES}>
          ไปประวัติการซ่อม
        </Link>
      </div>
    </div>
  )
}
