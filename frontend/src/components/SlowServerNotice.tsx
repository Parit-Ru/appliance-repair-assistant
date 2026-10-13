import { Notice } from './ui/Notice'

export function SlowServerNotice() {
  return (
    <Notice tone="info" title="เซิร์ฟเวอร์กำลังเริ่มทำงาน">
      ถ้าไม่มีคนใช้มาสักพัก เซิร์ฟเวอร์ต้องตื่นก่อน อาจใช้เวลาสักครู่
    </Notice>
  )
}
