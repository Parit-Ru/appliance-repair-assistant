import { useNavigate } from 'react-router-dom'
import { useGraphs } from '../api/queries'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { groupSymptoms } from '../lib/symptoms'

export function HomePage() {
  const graphs = useGraphs()
  const navigate = useNavigate()

  const groups = graphs.isSuccess ? groupSymptoms(graphs.data) : []
  const showSupported = graphs.isPending || groups.length > 0

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
          <span className="block">ตรวจอาการทีละขั้น</span>
          <span className="block text-accent">ตามคู่มือของผู้ผลิต</span>
        </h1>

        <p className="text-ink-soft">เลือกอาการของเครื่องใช้ไฟฟ้าที่พบ แล้วตอบคำถามทีละข้อ ลำดับขั้นตอนมาจากคู่มือ ไม่ได้ให้ AI เดาเอาเอง ขั้นตอนที่เกี่ยวกับไฟฟ้าต้องยืนยันคำเตือนก่อนทุกครั้ง และทุกขั้นบอกหน้าคู่มือที่มา</p>

        <Button onClick={() => navigate('/symptoms')}>เลือกอาการที่พบ</Button>
      </section>

      {showSupported && (
        <section className="space-y-3">
          <h2 className="font-semibold">รองรับตอนนี้</h2>

          {graphs.isPending && (
            <p className="flex items-center gap-2 text-ink-soft">
              <Icon name="spinner" className="h-5 w-5 animate-spin" />
              กำลังโหลด
            </p>
          )}

          <ul className="space-y-3">
            {groups.map((group) => (
              <li key={`${group.deviceCategory}|${group.brand}|${group.modelPattern}`}>
                <p>
                  {DEVICE_CATEGORY_LABELS[group.deviceCategory]} {group.brand} <code className="font-mono">{group.modelPattern}</code>
                </p>
                <p className="text-sm text-ink-soft">{group.symptoms.length} อาการ</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
