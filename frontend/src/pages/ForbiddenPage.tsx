import { Link } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'

/** หน้า "ไม่มีสิทธิ์" — ล็อกอินแล้วแต่ไม่ใช่ผู้ดูแลระบบ (ไม่ปล่อยให้เป็นหน้าว่าง) */
export function ForbiddenPage() {
  return (
    <div className="space-y-4">
      <Icon name="warning" className="h-8 w-8 text-accent" />
      <h1 className="text-2xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p className="text-ink-soft">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น บัญชีของคุณใช้งานส่วนอื่นของเว็บได้ตามปกติ</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/" className="text-accent underline-offset-4 hover:underline">
          กลับหน้าแรก
        </Link>
        <Link to="/history" className="text-accent underline-offset-4 hover:underline">
          ไปประวัติการซ่อม
        </Link>
      </div>
    </div>
  )
}
