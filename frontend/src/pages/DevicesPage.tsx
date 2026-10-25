import { useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useManuals } from '../api/queries'
import type { DeviceCategory, ManualSummary } from '../api/types'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { ErrorNotice } from '../components/ErrorNotice'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { LoadingText } from '../components/LoadingText'
import { DEVICE_CATEGORIES, DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { MODEL_MATCH_HINT, symptomsPath } from '../lib/modelSelection'
import { manualMatches, manualTitle } from '../lib/models'
import { useSlowWait } from '../lib/useSlowWait'
const CARD_CLASSES = 'flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-left transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function DevicesPage() {
  const manuals = useManuals()
  const [params, setParams] = useSearchParams()
  const isSlow = useSlowWait(manuals.isPending)

  const rawCategory = params.get('category') as DeviceCategory | null
  // ค่า category ที่ไม่รู้จัก
  const category = rawCategory !== null && DEVICE_CATEGORIES.includes(rawCategory) ? rawCategory : null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{category ? `เลือกรุ่น${DEVICE_CATEGORY_LABELS[category] ?? ''}` : 'เลือกเครื่องที่มีปัญหา'}</h1>
        <p className="text-ink-soft">
          {category
            ? MODEL_MATCH_HINT
            : 'เลือกประเภทเครื่องใช้ไฟฟ้า แล้วเลือกรุ่น จากนั้นจึงเลือกอาการ'}
        </p>
      </div>

      {isSlow && <SlowServerNotice />}

      {manuals.isPending && (
        <LoadingText>กำลังโหลดรายการเครื่อง</LoadingText>
      )}

      {manuals.isError && (
        <ErrorNotice error={manuals.error} onRetry={() => void manuals.refetch()} />
      )}

      {manuals.isSuccess && manuals.data.length === 0 && <p className="text-ink-soft">ยังไม่มีเครื่องให้เลือก</p>}

      {manuals.isSuccess && manuals.data.length > 0 && category === null && (
        <CategoryStep manuals={manuals.data} onPick={(next) => setParams({ category: next })} />
      )}

      {manuals.isSuccess && category !== null && (
        <ModelStep category={category} manuals={manuals.data.filter((m) => m.deviceCategory === category)} onBack={() => setParams({})} />
      )}
    </div>
  )
}

function CategoryStep({ manuals, onPick }: { manuals: ManualSummary[]; onPick: (category: DeviceCategory) => void }) {
  const present = new Set(manuals.map((m) => m.deviceCategory))
  const categories = DEVICE_CATEGORIES.filter((c) => present.has(c))

  return (
    <ul className="space-y-3">
      {categories.map((category) => {
        const count = manuals.filter((m) => m.deviceCategory === category).length
        return (
          <li key={category}>
            <button type="button" className={CARD_CLASSES} onClick={() => onPick(category)}>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{DEVICE_CATEGORY_LABELS[category]}</span>
                <span className="block text-sm text-ink-soft">{count} รุ่นในระบบ</span>
              </span>
              <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-faint" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ModelStep({ category, manuals, onBack }: { category: DeviceCategory; manuals: ManualSummary[]; onBack: () => void }) {
  const navigate = useNavigate()
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const [isUnknown, setIsUnknown] = useState(false)

  // โหมดไม่ทราบรุ่นไม่กรอง (ช่องพิมพ์ถูกซ่อน จะได้ไม่มีตัวกรองที่มองไม่เห็น)
  const shown = isUnknown || typed.trim() === '' ? manuals : manuals.filter((m) => manualMatches(m, typed))

  function pick(manual: ManualSummary) {
    navigate(symptomsPath(manual.manualId, isUnknown ? 'unknown' : 'selected'))
  }

  return (
    <div className="space-y-4">
      <Button variant="text" onClick={onBack}>
        ← เลือกประเภทเครื่องอื่น
      </Button>

      {!isUnknown && (
        <div className="space-y-2">
          <label htmlFor={inputId} className="block font-semibold">
            พิมพ์เลขรุ่นเพื่อกรอง (ไม่บังคับ)
          </label>
          <input id={inputId} type="text" value={typed} onChange={(event) => setTyped(event.target.value)} maxLength={40} placeholder="เช่น WA21A8376G" className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
        </div>
      )}

      {isUnknown && (
        <Notice tone="info" title="ไม่ทราบรุ่น: ขั้นตอนอาจไม่ตรงกับเครื่องของคุณ">
          ดูเลขรุ่นได้จากสติกเกอร์ที่ตัวเครื่อง (ขอบประตู ด้านหลัง หรือด้านใน) ปกหน้าคู่มือ หรือหน้าจอข้อมูลเครื่อง ถ้ายังไม่ทราบ เลือกรุ่นที่ใกล้เคียงที่สุดได้ แต่ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง
        </Notice>
      )}

      {shown.length === 0 ? (
        <Notice tone="info" title="ไม่พบรุ่นที่ตรงกับที่พิมพ์">
          ลองพิมพ์เฉพาะส่วนหน้าของเลขรุ่น หรือกด "ฉันไม่ทราบรุ่น" เพื่อดูทุกรุ่นของ{DEVICE_CATEGORY_LABELS[category]}
        </Notice>
      ) : (
        <ul className="space-y-3">
          {shown.map((manual) => (
            <li key={manual.manualId}>
              <button type="button" className={CARD_CLASSES} onClick={() => pick(manual)}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{manual.brand} {manualTitle(manual)}</span>
                  {manual.displayName !== undefined && <span className="block font-mono text-sm text-ink-faint">{manual.modelPattern}</span>}
                  <span className="block text-sm text-ink-soft">{manual.graphCount} อาการ</span>
                </span>
                <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line pt-3">
        <Button variant="text" onClick={() => setIsUnknown((previous) => !previous)}>
          {isUnknown ? 'กลับไปกรองด้วยเลขรุ่น' : 'ฉันไม่ทราบรุ่น'}
        </Button>
      </div>
    </div>
  )
}
