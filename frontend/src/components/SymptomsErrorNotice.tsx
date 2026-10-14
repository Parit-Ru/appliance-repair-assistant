import type { ReactNode } from 'react'
import { ApiError } from '../api/http'
import { Notice } from './ui/Notice'

interface SymptomsErrorNoticeProps {
  error: Error
  children?: ReactNode
}

/**
 * กล่องแจ้งข้อผิดพลาด ใช้ร่วมกันทั้งตอนโหลดรายการไม่ได้ และตอนเริ่ม session ไม่ได้
 * - เชื่อมต่อไม่ได้ (NETWORK_ERROR) → บอกให้ลองใหม่
 * - เซิร์ฟเวอร์ตอบกลับมาว่าผิดพลาด → แสดง HTTP status ไว้ใช้ไล่หาสาเหตุ
 */
export function SymptomsErrorNotice({ error, children }: SymptomsErrorNoticeProps) {
  const isNetwork = error instanceof ApiError && error.code === 'NETWORK_ERROR'

  if (isNetwork) {
    return (
      <Notice tone="danger" title="เชื่อมต่อเซิร์ฟเวอร์ไม่ได้">
        ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง
        {children}
      </Notice>
    )
  }

  const status = error instanceof ApiError ? `HTTP ${error.status}` : error.message
  return (
    <Notice tone="danger" title="เกิดข้อผิดพลาด">
      เซิร์ฟเวอร์ตอบกลับผิดปกติ ({status}){children}
    </Notice>
  )
}
