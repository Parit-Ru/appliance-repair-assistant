import { useId, useState } from 'react'
import type { DeviceCategory, EquipmentItem } from '../api/types'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { Icon } from './ui/Icon'

interface EquipmentPanelProps {
  items?: EquipmentItem[]
  deviceCategory?: DeviceCategory
}

function EquipmentSource({ item }: { item: EquipmentItem }) {
  if (item.sourcePage !== undefined) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon name="book" className="h-3.5 w-3.5 shrink-0" />
        คู่มือหน้า {item.sourcePage}
      </p>
    )
  }
  if (item.authorNote !== undefined) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon name="pencil" className="h-3.5 w-3.5 shrink-0" />
        ผู้พัฒนาแนะนำเพิ่ม
      </p>
    )
  }
  return null
}

export function EquipmentPanel({ items, deviceCategory }: EquipmentPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const listId = useId()

  if (items === undefined || items.length === 0) {
    return null
  }

  const title = deviceCategory === undefined ? 'อุปกรณ์ที่อาจต้องใช้' : `อุปกรณ์ที่อาจต้องใช้กับ${DEVICE_CATEGORY_LABELS[deviceCategory]}`

  return (
    <section className="rounded-xl border border-line bg-panel">
      <button type="button" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-controls={listId} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:hidden">
        <Icon name="box" className="h-5 w-5 shrink-0 text-ink-soft" />
        <span className="flex-1">
          {title} <span className="text-ink-faint">({items.length} รายการ)</span>
        </span>
        <span className="text-ink-soft">{isOpen ? 'ซ่อน' : 'แสดง'}</span>
      </button>

      <h2 className="hidden items-center gap-2 px-5 pt-4 font-semibold md:flex">
        <Icon name="box" className="h-5 w-5 shrink-0 text-ink-soft" />
        {title}
      </h2>

      <div id={listId} className={`${isOpen ? 'block' : 'hidden'} px-4 pb-4 md:block md:px-5`}>
        <p className="border-t border-line pt-3 text-xs text-ink-faint md:mt-1 md:border-t-0 md:pt-0">รายการเดียวกันสำหรับทุกอาการของเครื่องประเภทนี้</p>

        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.equipmentId} className="text-sm">
              <p className="font-medium">{item.nameTh}</p>
              <p className="text-ink-soft">{item.purposeTh}</p>
              <EquipmentSource item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
