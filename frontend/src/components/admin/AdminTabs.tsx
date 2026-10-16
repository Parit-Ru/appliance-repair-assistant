import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/admin/analytics', label: 'สถิติภาพรวม' },
  { to: '/admin/feedback', label: 'ความเห็นผู้ใช้' },
]

const TAB_ACTIVE = 'rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent'
const TAB_IDLE = 'rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line hover:text-ink'

/** แถบลิงก์สองหน้าของผู้ดูแลระบบ (หน้าตาแบบแท็บ แต่เป็น route แยก ลิงก์ตรง/ปุ่มย้อนกลับใช้ได้) */
export function AdminTabs() {
  return (
    <nav aria-label="เมนูผู้ดูแลระบบ" className="flex flex-wrap gap-1 border-b border-line pb-3">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? TAB_ACTIVE : TAB_IDLE)}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
