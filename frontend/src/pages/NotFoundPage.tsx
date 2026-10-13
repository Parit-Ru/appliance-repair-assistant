import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'

export function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <div className="space-y-4">
      <Icon name="warning" className="h-8 w-8 text-accent" />
      <h1 className="text-2xl font-semibold">ไม่พบหน้านี้</h1>
      <p className="text-ink-soft">
        ไม่มีหน้า <code className="break-all font-mono text-ink">{pathname}</code> ในระบบ ลิงก์อาจพิมพ์ผิดหรือเลิกใช้แล้ว
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/" className="text-accent underline-offset-4 hover:underline">
          กลับหน้าแรก
        </Link>
        <Link to="/symptoms" className="text-accent underline-offset-4 hover:underline">
          ไปหน้าเลือกอาการ
        </Link>
      </div>
    </div>
  )
}
