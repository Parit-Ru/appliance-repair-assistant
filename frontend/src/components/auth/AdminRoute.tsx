import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/authContext'
import { loginUrl } from '../../lib/authRedirect'
import { ForbiddenPage } from '../../pages/ForbiddenPage'
import { Icon } from '../ui/Icon'

/**
 * ครอบหน้าที่เฉพาะผู้ดูแลระบบ
 *
 *  - กำลังยืนยัน token   → "กำลังตรวจสอบสิทธิ์" (ไม่กะพริบหน้า "ไม่มีสิทธิ์" ให้ admin ตัวจริง)
 *  - ยังไม่ล็อกอิน        → ไปหน้าเข้าสู่ระบบ พร้อมจำหน้านี้ไว้ (?next=) กลับมาหลังล็อกอิน
 *  - ล็อกอินแต่ไม่ใช่ admin → หน้า "ไม่มีสิทธิ์" (ไม่ใช่หน้าว่าง)
 *  - admin               → แสดงหน้า
 *
 * นี่คือ UX เท่านั้น ไม่ใช่การป้องกัน: ใครแก้ localStorage ให้ role เป็น admin ก็เห็นหน้าได้
 * แต่ข้อมูลทุก endpoint /admin/* ถูก backend ตรวจ token จริงและตอบ 401/403 เอง
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'verifying') {
    return (
      <p role="status" className="flex items-center gap-2 text-ink-soft">
        <Icon name="spinner" className="h-5 w-5 animate-spin" />
        กำลังตรวจสอบสิทธิ์
      </p>
    )
  }

  if (status === 'guest') {
    return <Navigate to={loginUrl('login-required', location.pathname + location.search)} replace />
  }

  if (user?.role !== 'admin') {
    return <ForbiddenPage />
  }

  return <>{children}</>
}
