import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { ServerStatus } from './ServerStatus'

/**
 * โครงของทุกหน้า: แถบนำทาง + พื้นที่เนื้อหา
 *
 * ใช้ markup ชุดเดียวทั้งมือถือและจอใหญ่ เปลี่ยนรูปร่างด้วยคลาส md: (กว้างตั้งแต่ 768px)
 * - มือถือ   แถบนำทางเป็นแถบแนวนอนด้านบน
 * - จอใหญ่  แถบนำทางกลายเป็น sidebar ด้านซ้าย สูงเต็มจอ
 * เลือกแบบนี้แทนการเขียนสองชุดแล้วซ่อนชุดหนึ่ง เพราะเมนูมีที่เดียว แก้ที่เดียว
 */

/**
 * ชื่อแอปที่แสดงบนหน้าจอ เก็บไว้ที่เดียว
 * เดิมชื่อ FixBot ซึ่งซ้ำกับผลิตภัณฑ์ของ iFixit จึงเปลี่ยนเป็น FixStep (4 ต.ค. 2569)
 * ค้นเว็บแล้วไม่พบผลิตภัณฑ์ชื่อ FixStep แต่ยังไม่ได้ตรวจเครื่องหมายการค้าหรือชื่อโดเมน
 * ตอนเปลี่ยนอีกแก้บรรทัดนี้กับ <title> ใน index.html
 */
const APP_NAME = 'FixStep'

/** เมนู 4 รายการ หน้าตรวจอาการไม่อยู่ในเมนู เพราะเข้าจากลิงก์ในหน้าอื่น */
const NAV_ITEMS = [
  { to: '/', label: 'หน้าแรก' },
  { to: '/devices', label: 'เลือกเครื่อง' },
  { to: '/symptoms/all', label: 'อาการทั้งหมด' },
  { to: '/history', label: 'ประวัติการซ่อม' },
]

/** ชื่อคลาสของเมนูตอนเลือกอยู่และตอนไม่ได้เลือก เขียนเต็มด้วยเหตุผลเดียวกับ Button.tsx */
const NAV_ACTIVE = 'rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent'
const NAV_IDLE = 'rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-line hover:text-ink'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* มือถือ: แถบบน ขอบล่าง / จอใหญ่: sidebar ขอบขวา ติดอยู่กับที่ตอนเลื่อนหน้า */}
      <aside className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-3 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:flex-col md:flex-nowrap md:items-stretch md:gap-6 md:border-b-0 md:border-r md:py-6">
        <NavLink to="/" className="flex items-center gap-2 font-semibold text-ink">
          <Icon name="logo" className="h-6 w-6 text-accent" />
          <span>{APP_NAME}</span>
        </NavLink>

        <nav aria-label="เมนูหลัก" className="flex gap-1 md:flex-col">
          {NAV_ITEMS.map((item) => (
            // end เฉพาะ "/" ไม่งั้นจะถูกนับว่าเลือกอยู่ในทุกหน้า เพราะทุก path ขึ้นต้นด้วย /
            // รายการอื่นไม่ใส่ end เพื่อให้ /history/:id ยังไฮไลต์เมนู "ประวัติการซ่อม"
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? NAV_ACTIVE : NAV_IDLE)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* md:mt-auto ดันป้ายสถานะไปอยู่ล่างสุดของ sidebar / มือถือ: w-full ทำให้ขึ้นบรรทัดใหม่เต็มแถว */}
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
