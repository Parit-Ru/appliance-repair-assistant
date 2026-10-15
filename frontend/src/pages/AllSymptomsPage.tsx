import { Link, Navigate } from 'react-router-dom'
import { useGraphs, useManuals } from '../api/queries'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { SymptomRow } from '../components/SymptomRow'
import { SymptomsErrorNotice } from '../components/SymptomsErrorNotice'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { symptomsPath, useChosenModel } from '../lib/modelSelection'
import { manualTitle } from '../lib/models'
import { symptomName } from '../lib/symptoms'
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
  const { manualId, modelSelection } = useChosenModel()
  const manuals = useManuals()
  const graphs = useGraphs(manualId)
  const { start, startingId, isStarting, error: startError } = useStartSymptom()

  // ---------- รอนาน: เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า ----------
  const isSlow = useSlowWait((manualId !== undefined && graphs.isPending) || isStarting)

  // ยังไม่ได้เลือกรุ่น → กลับไปหน้าเลือกเครื่อง (ไม่เดารุ่นให้)
  if (manualId === undefined) return <Navigate to="/devices" replace />

  const manual = manuals.data?.find((m) => m.manualId === manualId)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">อาการทั้งหมด</h1>
        <p className="text-ink-soft">
          เลือกอาการที่พบจากรายการ ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น หรือ{' '}
          <Link to={symptomsPath(manualId, modelSelection)} className={LINK_CLASSES}>
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

        {graphs.isSuccess && graphs.data.length > 0 && (
          <div>
            <h2 className="font-semibold">{manual ? DEVICE_CATEGORY_LABELS[manual.deviceCategory] : DEVICE_CATEGORY_LABELS[graphs.data[0].deviceCategory]}</h2>
            <p className="text-sm text-ink-soft">
              {graphs.data[0].brand} <code className="font-mono">{manual ? manualTitle(manual) : graphs.data[0].modelPattern}</code> ·{' '}
              <Link to="/devices" className={LINK_CLASSES}>
                เปลี่ยนรุ่น
              </Link>
            </p>

            <ul className="mt-2 border-t border-line">
              {[...graphs.data].sort((a, b) => symptomName(a).localeCompare(symptomName(b), 'th')).map((summary) => (
                <SymptomRow key={summary.graphId} summary={summary} isStarting={isStarting && startingId === summary.graphId} disabled={isStarting && startingId !== summary.graphId} onSelect={(graphId) => start(graphId, { manualId, modelSelection })} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
