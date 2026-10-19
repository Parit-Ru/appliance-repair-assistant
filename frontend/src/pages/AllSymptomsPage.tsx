import { Link } from 'react-router-dom'
import { useGraphs, useManuals } from '../api/queries'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { SymptomRow } from '../components/SymptomRow'
import { ErrorNotice } from '../components/ErrorNotice'
import { LoadingText } from '../components/LoadingText'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { MODEL_MATCH_HINT, startOptions, symptomsPath, useChosenModel } from '../lib/modelSelection'
import { manualTitle } from '../lib/models'
import { groupSymptoms } from '../lib/symptoms'
import { useSlowWait } from '../lib/useSlowWait'
import { useStartSymptom } from '../lib/useStartSymptom'

/**
 * หน้าอาการทั้งหมด (เลือกจากรายการ จัดกลุ่มตามประเภทเครื่อง/ยี่ห้อ/รุ่น)
 *
 * ทางเดิมที่ใช้ได้เสมอ แม้ระบบค้นหา (หน้าเลือกอาการ) ใช้ไม่ได้
 * - มี ?manual=  : แสดงอาการของรุ่นนั้นรุ่นเดียว (มาจากหน้าเลือกรุ่น) ส่ง manualId + modelSelection ตามที่เลือก
 * - ไม่มี ?manual= : แสดงอาการของทุกรุ่น แยกกลุ่มตามรุ่น ให้ผู้ใช้เห็นหัวกลุ่มก่อนเลือก
 *   ส่งเฉพาะ manualId ของอาการที่กด **ไม่ส่ง modelSelection** เพราะผู้ใช้ไม่ได้ผ่านหน้าเลือกรุ่น
 *   (เซิร์ฟเวอร์บันทึกเป็น NULL ไว้แยกเคสตอนวัดผล) และไม่เดารุ่นให้
 * กดแถวไหน = เริ่ม session ของอาการนั้น (ไม่ส่ง query จึงไม่มีคะแนนความมั่นใจ) แล้วไปหน้าตรวจอาการ
 */

const LINK_CLASSES = 'text-accent underline-offset-4 hover:underline'

export function AllSymptomsPage() {
  const { manualId, modelSelection } = useChosenModel()
  const manuals = useManuals()
  const graphs = useGraphs(manualId)
  const { start, startingId, isStarting, error: startError } = useStartSymptom()

  // ---------- รอนาน: เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า ----------
  const isSlow = useSlowWait(graphs.isPending || isStarting)

  const groups = graphs.isSuccess ? groupSymptoms(graphs.data) : []

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">อาการทั้งหมด</h1>
        {manualId === undefined ? (
          <>
            <p className="text-ink-soft">{MODEL_MATCH_HINT}</p>
            <p className="text-ink-soft">
              เลือกอาการที่พบจากรายการ ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น หรือ{' '}
              <Link to="/devices" className={LINK_CLASSES}>
                เลือกเครื่องก่อนเพื่อพิมพ์อาการให้ระบบช่วยหา
              </Link>
            </p>
          </>
        ) : (
          <p className="text-ink-soft">
            เลือกอาการที่พบจากรายการ ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น หรือ{' '}
            <Link to={symptomsPath(manualId, modelSelection)} className={LINK_CLASSES}>
              พิมพ์อาการให้ระบบช่วยหา
            </Link>
          </p>
        )}
      </div>

      {isSlow && <SlowServerNotice />}

      {/* เริ่มไม่สำเร็จ: แสดงเหนือรายการ ทุกแถวกดได้อีกครั้งเพราะ isStarting กลับเป็น false
          วางนอกส่วนรายการ เพราะรายการอาจยังโหลดไม่เสร็จหรือโหลดไม่ได้ */}
      {startError && <ErrorNotice error={startError} />}

      <section className="space-y-6">
        {graphs.isPending && (
          <LoadingText>กำลังโหลดรายการอาการ</LoadingText>
        )}

        {graphs.isError && (
          <ErrorNotice error={graphs.error} onRetry={() => void graphs.refetch()} />
        )}

        {graphs.isSuccess && graphs.data.length === 0 && <p className="text-ink-soft">ยังไม่มีอาการให้เลือก</p>}

        {groups.map((group) => {
          const manual = manuals.data?.find((m) => m.manualId === group.manualId)
          return (
            <div key={group.manualId}>
              <h2 className="font-semibold">{DEVICE_CATEGORY_LABELS[group.deviceCategory]}</h2>
              <p className="text-sm text-ink-soft">
                {group.brand} <code className="font-mono">{manual ? manualTitle(manual) : group.modelPattern}</code>
                {manualId !== undefined && (
                  <>
                    {' '}
                    ·{' '}
                    <Link to="/devices" className={LINK_CLASSES}>
                      เปลี่ยนรุ่น
                    </Link>
                  </>
                )}
              </p>

              <ul className="mt-2 border-t border-line">
                {group.symptoms.map((summary) => (
                  <SymptomRow
                    key={summary.graphId}
                    summary={summary}
                    isStarting={isStarting && startingId === summary.graphId}
                    disabled={isStarting && startingId !== summary.graphId}
                    onSelect={(graphId) => start(graphId, startOptions({ manualId, modelSelection }, summary.manualId))}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
