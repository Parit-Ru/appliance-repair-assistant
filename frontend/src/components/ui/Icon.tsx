import type { ReactNode } from 'react'

/**
 * ไอคอนทั้งหมดของแอป วาดเองทุกตัว ไม่ใช้ไลบรารีไอคอน
 *
 * ใช้แบบนี้: <Icon name="warning" className="h-5 w-5 text-danger" />
 *
 * - สีมาจาก currentColor คือสีตัวอักษรของตัวที่ครอบอยู่ เปลี่ยนด้วยคลาส text-*
 * - ขนาดกำหนดผ่าน className เช่น h-4 w-4
 * - ไอคอนอยู่คู่กับข้อความเสมอ จึงซ่อนจากโปรแกรมอ่านหน้าจอ (aria-hidden)
 * - spinner ไม่หมุนเอง ผู้เรียกต้องใส่คลาส animate-spin
 */

/** ชื่อไอคอนทั้ง 12 ตัว ถ้าพิมพ์ชื่อผิด TypeScript จะแจ้งตั้งแต่ตอนเขียน */
export type IconName =
  | 'warning' // เตือน
  | 'success' // ถูก
  | 'info' // ข้อมูล
  | 'wrench' // ส่งต่อช่าง
  | 'chevron-right' // ลูกศรท้ายแถว
  | 'book' // หน้าคู่มือ
  | 'pencil' // ผู้พัฒนาเพิ่มเอง
  | 'box' // อุปกรณ์
  | 'spinner' // หมุนรอ
  | 'logo' // สถานะหนึ่งเปลี่ยนไปได้สองทาง
  | 'switch-on' // สวิตช์เปิด
  | 'switch-off' // สวิตช์ปิด

interface IconShape {
  /** ระบบพิกัดของรูป สวิตช์เป็นรูปแนวตั้งจึงใช้ 20×32 ตัวอื่นใช้ 24×24 */
  viewBox: string
  /** เส้นที่ประกอบเป็นรูป */
  body: ReactNode
}

/** ตารางค้นหา: ชื่อไอคอน → รูปร่าง */
const ICONS: Record<IconName, IconShape> = {
  warning: {
    viewBox: '0 0 24 24',
    body: (
      <>
        <path d="M12 3.5 2.5 20h19L12 3.5z" />
        <path d="M12 10v4" />
        <path d="M12 17.2v.1" />
      </>
    ),
  },
  success: {
    viewBox: '0 0 24 24',
    body: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12.5 2.7 2.7L16 9.5" />
      </>
    ),
  },
  info: {
    viewBox: '0 0 24 24',
    body: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <path d="M12 7.8v.1" />
      </>
    ),
  },
  wrench: {
    viewBox: '0 0 24 24',
    body: <path d="M14.5 3.5a5 5 0 0 0-4.3 7.2L3.8 17.1a2 2 0 0 0 2.8 2.8l6.4-6.4a5 5 0 0 0 7.2-4.3l-3 1.5-2.5-1.5-.3-2.9 3-1.4a5 5 0 0 0-2.9-.9z" />,
  },
  'chevron-right': {
    viewBox: '0 0 24 24',
    body: <path d="m9 5 7 7-7 7" />,
  },
  book: {
    viewBox: '0 0 24 24',
    body: (
      <>
        <path d="M12 6.5C10 5 7 4.5 3 4.5v14c4 0 7 .5 9 2 2-1.5 5-2 9-2v-14c-4 0-7 .5-9 2z" />
        <path d="M12 6.5v14" />
      </>
    ),
  },
  pencil: {
    viewBox: '0 0 24 24',
    body: (
      <>
        <path d="M16 3.5 20.5 8 8 20.5H3.5V16L16 3.5z" />
        <path d="m13.5 6 4.5 4.5" />
      </>
    ),
  },
  box: {
    viewBox: '0 0 24 24',
    body: (
      <>
        <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" />
        <path d="M3.5 7.5 12 12l8.5-4.5" />
        <path d="M12 12v9" />
      </>
    ),
  },
  spinner: {
    viewBox: '0 0 24 24',
    // วงกลมสามในสี่วง พอหมุนด้วย animate-spin จะเห็นเป็นตัวหมุนรอ
    body: <path d="M21 12a9 9 0 1 1-9-9" />,
  },
  logo: {
    viewBox: '0 0 24 24',
    // วงบนคือสถานะปัจจุบัน สองวงล่างคือสถานะถัดไปที่เป็นไปได้
    body: (
      <>
        <circle cx="12" cy="5" r="2.5" />
        <circle cx="6" cy="19" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="M12 7.5v4l-4.3 5.6" />
        <path d="m12 11.5 4.3 5.6" />
      </>
    ),
  },
  'switch-on': {
    viewBox: '0 0 20 32',
    // ปุ่มทึบอยู่ด้านบน ต่างจากสวิตช์ปิดทั้งตำแหน่งและความทึบ จึงไม่ต้องพึ่งสีอย่างเดียว
    body: (
      <>
        <rect x="2" y="2" width="16" height="28" rx="8" />
        <circle cx="10" cy="10" r="4" fill="currentColor" />
      </>
    ),
  },
  'switch-off': {
    viewBox: '0 0 20 32',
    body: (
      <>
        <rect x="2" y="2" width="16" height="28" rx="8" />
        <circle cx="10" cy="22" r="4" />
      </>
    ),
  },
}

interface IconProps {
  name: IconName
  /** คลาส Tailwind สำหรับขนาดและสี ถ้าไม่ส่งมาจะได้ขนาด 20px */
  className?: string
}

export function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  const icon = ICONS[name]

  return (
    <svg viewBox={icon.viewBox} className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {icon.body}
    </svg>
  )
}
