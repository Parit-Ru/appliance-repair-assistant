import { NavLink } from 'react-router-dom'
import { NAV_ACTIVE, NAV_IDLE } from '../layout/AppShell'

const TABS = [
  { to: '/admin/analytics', label: 'สถิติภาพรวม' },
  { to: '/admin/feedback', label: 'ความเห็นผู้ใช้' },
  { to: '/admin/drafts', label: 'ร่างแผนผังขั้นตอน' },
]

export function AdminTabs() {
  return (
    <nav aria-label="เมนูผู้ดูแลระบบ" className="flex flex-wrap gap-1 border-b border-line pb-3">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? NAV_ACTIVE : NAV_IDLE)}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
