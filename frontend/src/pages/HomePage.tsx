import { Link, useNavigate } from 'react-router-dom'
import { useManuals } from '../api/queries'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { symptomsPath } from '../lib/modelSelection'
import { manualTitle } from '../lib/models'

export function HomePage() {
  const manuals = useManuals()
  const navigate = useNavigate()

  const items = manuals.isSuccess ? manuals.data : []
  const showSupported = manuals.isPending || items.length > 0

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

      {showSupported && (
        <section className="space-y-3">
          <h2 className="font-semibold">รองรับตอนนี้</h2>

          {manuals.isPending && (
            <p className="flex items-center gap-2 text-ink-soft">
              <Icon name="spinner" className="h-5 w-5 animate-spin" />
              กำลังโหลด
            </p>
          )}

          <ul className="space-y-3">
            {items.map((manual) => (
              <li key={manual.manualId}>
                <Link to={symptomsPath(manual.manualId, 'selected')} className="block hover:text-accent">
                  {DEVICE_CATEGORY_LABELS[manual.deviceCategory]} {manual.brand} <code className="font-mono">{manualTitle(manual)}</code>
                </Link>
                <p className="text-sm text-ink-soft">{manual.graphCount} อาการ</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
