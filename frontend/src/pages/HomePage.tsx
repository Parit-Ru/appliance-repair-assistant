import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { DEVICE_CATEGORIES, DEVICE_CATEGORY_LABELS } from '../lib/labels'

const STEPS = [
  { title: 'เลือกเครื่อง', detail: 'เลือกประเภทและรุ่นของเครื่องใช้ไฟฟ้า' },
  { title: 'เลือกอาการ', detail: 'ค้นหาหรือเลือกอาการที่พบจากรายการ' },
  { title: 'ตอบทีละข้อ', detail: 'ทำตามขั้นตอนและตอบคำถามจนได้ผลลัพธ์' },
]

const FACTS = [
  { title: 'อ้างอิงคู่มือ', detail: 'ทุกขั้นตอนบอกหน้าคู่มือที่มา' },
  { title: 'ความปลอดภัยมาก่อน', detail: 'ขั้นตอนเสี่ยงต้องอ่านคำเตือนและกดยืนยันก่อน' },
  { title: 'บอกตรงๆ เมื่อไม่รู้', detail: 'ถ้าคู่มือไม่ครอบคลุม จะแนะนำให้ติดต่อศูนย์บริการ' },
  { title: 'ดูย้อนหลังได้', detail: 'เมื่อเข้าสู่ระบบ ประวัติการซ่อมจะผูกกับบัญชีและดูได้จากทุกเครื่อง' },
]

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

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">ใช้งานอย่างไร</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-lg border border-line bg-panel p-4">
              <p className="text-sm font-semibold text-accent">ขั้นที่ {i + 1}</p>
              <p className="font-semibold">{step.title}</p>
              <p className="text-sm text-ink-soft">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">เครื่องที่รองรับ</h2>
        <p className="text-sm text-ink-soft">ข้อมูลจากคู่มือ Samsung</p>
        <ul className="flex flex-wrap gap-2">
          {DEVICE_CATEGORIES.map((c) => (
            <li key={c} className="rounded-lg border border-line bg-panel px-4 py-2 text-sm">
              {DEVICE_CATEGORY_LABELS[c]}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">ข้อควรรู้</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {FACTS.map((fact) => (
            <li key={fact.title} className="rounded-lg border border-line bg-panel p-4">
              <p className="font-semibold">{fact.title}</p>
              <p className="text-sm text-ink-soft">{fact.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
