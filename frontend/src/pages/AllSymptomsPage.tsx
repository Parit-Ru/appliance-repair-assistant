import { Link } from 'react-router-dom'
import { useGraphs } from '../api/queries'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { SymptomRow } from '../components/SymptomRow'
import { SymptomsErrorNotice } from '../components/SymptomsErrorNotice'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { groupSymptoms } from '../lib/symptoms'
import { useSlowWait } from '../lib/useSlowWait'
import { useStartSymptom } from '../lib/useStartSymptom'

/**
 * หน้าอาการทั้งหมด (เลือกจากรายการ จัดกลุ่มตามประเภทเครื่อง/ยี่ห้อ/รุ่น)
 *
 * ทางเดิมที่ใช้ได้เสมอ แม้ระบบค้นหา (หน้าเลือกอาการ) ใช้ไม่ได้
 * กดแถวไหน = เริ่ม session ของอาการนั้น (ไม่ส่ง query จึงไม่มีคะแนนความมั่นใจ) แล้วไปหน้าตรวจอาการ
 */

const LINK_CLASSES = 'text-accent underline-offset-4 hover:underline'

export function AllSymptomsPage() {
  const graphs = useGraphs()
  const { start, startingId, isStarting, error: startError } = useStartSymptom()

  // ---------- รอนาน: เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า ----------
  const isSlow = useSlowWait(graphs.isPending || isStarting)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">อาการทั้งหมด</h1>
        <p className="text-ink-soft">
          เลือกอาการที่พบจากรายการ ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น หรือ{' '}
          <Link to="/symptoms" className={LINK_CLASSES}>
            พิมพ์อาการให้ระบบช่วยหา
          </Link>
        </p>
      </div>

      {isSlow && <SlowServerNotice />}

      {/* เริ่มไม่สำเร็จ: แสดงเหนือรายการ ทุกแถวกดได้อีกครั้งเพราะ isStarting กลับเป็น false
          วางนอกส่วนรายการ เพราะรายการอาจยังโหลดไม่เสร็จหรือโหลดไม่ได้ */}
      {startError && <SymptomsErrorNotice error={startError} />}

      <section className="space-y-6">
        {graphs.isPending && (
          <p className="flex items-center gap-2 text-ink-soft">
            <Icon name="spinner" className="h-5 w-5 animate-spin" />
            กำลังโหลดรายการอาการ
          </p>
        )}

        {graphs.isError && (
          <SymptomsErrorNotice error={graphs.error}>
            <Button variant="secondary" className="mt-3" onClick={() => graphs.refetch()}>
              ลองอีกครั้ง
            </Button>
          </SymptomsErrorNotice>
        )}

        {graphs.isSuccess && graphs.data.length === 0 && <p className="text-ink-soft">ยังไม่มีอาการให้เลือก</p>}

        {graphs.isSuccess &&
          graphs.data.length > 0 &&
          groupSymptoms(graphs.data).map((group) => (
            <div key={`${group.deviceCategory}|${group.brand}|${group.modelPattern}`}>
              <h2 className="font-semibold">{DEVICE_CATEGORY_LABELS[group.deviceCategory]}</h2>
              <p className="text-sm text-ink-soft">
                {group.brand} <code className="font-mono">{group.modelPattern}</code>
              </p>

              <ul className="mt-2 border-t border-line">
                {group.symptoms.map((summary) => (
                  <SymptomRow key={summary.graphId} summary={summary} isStarting={isStarting && startingId === summary.graphId} disabled={isStarting && startingId !== summary.graphId} onSelect={start} />
                ))}
              </ul>
            </div>
          ))}
      </section>
    </div>
  )
}
