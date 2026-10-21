import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
          <span className="block">ตรวจอาการทีละขั้น</span>
          <span className="block text-accent">ตามคู่มือของผู้ผลิต</span>
        </h1>

        <p className="text-ink-soft">เลือกอาการของเครื่องใช้ไฟฟ้าที่พบ แล้วตอบคำถามทีละข้อ ลำดับขั้นตอนมาจากคู่มือ ไม่ได้ให้ AI เดาเอาเอง ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง และทุกขั้นบอกหน้าคู่มือที่มา</p>

        <Button onClick={() => navigate('/devices')}>เลือกเครื่องที่มีปัญหา</Button>
      </section>
    </div>
  )
}
