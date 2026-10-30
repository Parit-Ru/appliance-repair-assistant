import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/authContext'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { ServerStatus } from './ServerStatus'

const APP_NAME = 'FixStep'

const NAV_ITEMS = [
  { to: '/', label: 'หน้าแรก' },
  { to: '/devices', label: 'เลือกเครื่อง' },
  { to: '/symptoms/all', label: 'อาการทั้งหมด' },
  { to: '/history', label: 'ประวัติการซ่อม' },
]

export const NAV_ACTIVE = 'rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent'
export const NAV_IDLE = 'rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line hover:text-ink'

const ADMIN_NAV_ITEM = { to: '/admin', label: 'ผู้ดูแลระบบ' }

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { status, user, logout } = useAuth()
  const navItems = user?.role === 'admin' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-3 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:flex-col md:flex-nowrap md:items-stretch md:gap-6 md:border-b-0 md:border-r md:py-6">
        <NavLink to="/" className="flex items-center gap-2 font-semibold text-ink">
          <Icon name="logo" className="h-6 w-6 text-accent" />
          <span>{APP_NAME}</span>
        </NavLink>

        <nav aria-label="เมนูหลัก" className="flex gap-1 md:flex-col">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? NAV_ACTIVE : NAV_IDLE)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-col md:items-stretch" aria-label="บัญชีผู้ใช้" role="group">
          {user === undefined ? (
            <>
              <NavLink to="/login" className={({ isActive }) => (isActive ? NAV_ACTIVE : NAV_IDLE)}>
                เข้าสู่ระบบ
              </NavLink>
              <NavLink to="/register" className={({ isActive }) => (isActive ? NAV_ACTIVE : NAV_IDLE)}>
                สมัครสมาชิก
              </NavLink>
            </>
          ) : (
            <>
              <p className="min-w-0 break-words px-3 text-sm text-ink" title={user.displayName}>
                {status === 'verifying' ? `${user.displayName} (กำลังตรวจสอบ)` : user.displayName}
                {user.role === 'admin' && <span className="ml-2 text-xs text-accent">ผู้ดูแลระบบ</span>}
              </p>
              <Button variant="text" onClick={logout} className="px-3 py-1 md:justify-start">
                ออกจากระบบ
              </Button>
            </>
          )}
        </div>

        <div className="w-full md:mt-auto">
          <ServerStatus />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="w-full flex-1 px-4 py-6 md:px-10 md:py-10">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
