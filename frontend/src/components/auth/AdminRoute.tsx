import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/authContext'
import { loginUrl } from '../../lib/authRedirect'
import { ForbiddenPage } from '../../pages/ForbiddenPage'
import { Icon } from '../ui/Icon'

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
