import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/**
 * กล่องข้อความแจ้งเตือน มี 2 สี
 *
 * - info     ฟ้า  ข้อมูลทั่วไป เช่น "ตอนนี้เป็นโหมดจำลอง"
 * - danger   แดง  คำเตือนความปลอดภัยของสถานะที่ safety_critical และข้อผิดพลาด
 *
 * กล่องนี้แค่แสดงผล ไม่มีช่องติ๊กหรือปุ่มยืนยันในตัว
 * ด่านความปลอดภัย (ติ๊กแล้วกด) จะประกอบในหน้า SessionPage โดยวางช่องติ๊กไว้ใน children
 */

type NoticeTone = 'info' | 'danger'

/**
 * ชื่อคลาสของแต่ละสี เขียนเต็มทุกคำด้วยเหตุผลเดียวกับ Button.tsx
 * /10 และ /40 คือความทึบ 10% และ 40% พื้นจึงเป็นสีจางๆ ไม่แย่งสายตาจากตัวอักษร
 */
const TONE_CLASSES: Record<NoticeTone, { box: string; accent: string }> = {
  info: { box: 'border-info/40 bg-info/10', accent: 'text-info' },
  danger: { box: 'border-danger/40 bg-danger/10', accent: 'text-danger' },
}

/** ไอคอนของแต่ละสี */
const DEFAULT_ICONS: Record<NoticeTone, IconName> = {
  info: 'info',
  danger: 'warning',
}

interface NoticeProps {
  tone: NoticeTone
  /** หัวข้อสั้นๆ ตัวหนา (ไม่ใส่ก็ได้) */
  title?: string
  /** เนื้อความ ใส่ข้อความหรือองค์ประกอบอื่นได้ เช่น ช่องติ๊ก */
  children?: ReactNode
}

export function Notice({ tone, title, children }: NoticeProps) {
  const toneClasses = TONE_CLASSES[tone]
  const boxClasses = `flex gap-3 rounded-lg border p-4 text-sm ${toneClasses.box}`

  return (
    <div className={boxClasses}>
      {/* mt-0.5 ขยับไอคอนลงให้ตรงกับบรรทัดแรกของข้อความ */}
      <Icon name={DEFAULT_ICONS[tone]} className={`mt-0.5 h-5 w-5 shrink-0 ${toneClasses.accent}`} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className={`font-semibold ${toneClasses.accent}`}>{title}</p>}
        {children && <div className="text-ink">{children}</div>}
      </div>
    </div>
  )
}
