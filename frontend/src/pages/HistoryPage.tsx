import { Link, useSearchParams } from 'react-router-dom'
import { useHistory } from '../api/queries'
import type { HistoryParams } from '../api/types'
import { HistoryErrorNotice } from '../components/history/HistoryErrorNotice'
import { HistoryFilters } from '../components/history/HistoryFilters'
import { HistoryRow } from '../components/history/HistoryRow'
import { Pagination } from '../components/history/Pagination'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { applyPatch, clearFilters, hasActiveFilters, parseHistoryParams, toSearchParams } from '../lib/historyParams'
import { HISTORY_RETENTION_DAYS } from '../lib/historyView'
import { useSlowWait } from '../lib/useSlowWait'

/**
 * หน้าประวัติการซ่อม (/history) — รายการการตรวจที่จบแล้วของเบราว์เซอร์นี้
 *
 * ตัวกรอง/คำค้น/การเรียง/หน้า เก็บใน URL (?q=&category=&brand=&status=&sort=&page=) อ่านผ่าน parseHistoryParams
 * ทุกอย่างที่แสดงมาจากที่เซิร์ฟเวอร์ส่งมา ไม่แต่งชื่ออาการ สถานะ หรือวันที่เอง
 *
 * สามสถานะของรายการ: กำลังโหลด / ผิดพลาด (ลองอีกครั้งได้) / ว่าง
 * ว่างมี 2 แบบ: ยังไม่มีประวัติเลย (ไม่มีตัวกรอง) กับ ไม่พบตามตัวกรอง (ล้างตัวกรองได้)
 */

const LINK_CLASSES = 'text-accent underline-offset-4 hover:underline'

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseHistoryParams(searchParams)
  const history = useHistory(params)

  // รอนาน: เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า
  const isSlow = useSlowWait(history.isPending)

  const hasFilters = hasActiveFilters(params)
  const data = history.data

  function update(patch: Partial<HistoryParams>) {
    setSearchParams(toSearchParams(applyPatch(params, patch)))
  }

  function clear() {
    setSearchParams(toSearchParams(clearFilters(params)))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ประวัติการซ่อม</h1>
        <p className="text-ink-soft">การตรวจอาการที่จบแล้วของเบราว์เซอร์เครื่องนี้ เปิดดูผลย้อนหลังหรือตรวจซ้ำได้</p>
        <p className="text-sm text-ink-faint">
          ประวัติผูกกับเบราว์เซอร์เครื่องนี้และเก็บไว้ {HISTORY_RETENTION_DAYS} วัน ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่องจะไม่เห็นประวัติเดิม
        </p>
      </div>

      <HistoryFilters params={params} facets={data?.facets} hasFilters={hasFilters} onChange={update} onClear={clear} />

      {isSlow && <SlowServerNotice />}

      {history.isPending && (
        <p className="flex items-center gap-2 text-ink-soft">
          <Icon name="spinner" className="h-5 w-5 animate-spin" />
          กำลังโหลดประวัติ
        </p>
      )}

      {history.isError && <HistoryErrorNotice error={history.error} onRetry={() => void history.refetch()} />}

      {data !== undefined && data.total === 0 && !hasFilters && (
        <div className="space-y-3 rounded-xl border border-line bg-panel p-5">
          <p className="font-semibold">ยังไม่มีประวัติการซ่อม</p>
          <p className="text-ink-soft">เมื่อตรวจอาการจนจบ รายการจะมาอยู่ที่นี่</p>
          <p>
            <Link to="/devices" className={LINK_CLASSES}>
              เลือกเครื่องที่มีปัญหา
            </Link>
          </p>
        </div>
      )}

      {data !== undefined && data.total === 0 && hasFilters && (
        <div className="space-y-3 rounded-xl border border-line bg-panel p-5">
          <p className="font-semibold">ไม่พบรายการที่ตรงกับที่ค้นหา</p>
          <Button variant="secondary" onClick={clear}>
            ล้างตัวกรอง
          </Button>
        </div>
      )}

      {data !== undefined && data.total > 0 && (
        <section aria-label="รายการประวัติ" className="space-y-4">
          <p className="text-sm text-ink-soft">
            {hasFilters ? `พบ ${data.total} รายการ` : `ทั้งหมด ${data.total} รายการ`}
          </p>

          {/* รายการเดิมยังค้างอยู่ระหว่างโหลดหน้า/ตัวกรองใหม่ (keepPreviousData) จางลงให้รู้ว่ากำลังโหลด */}
          <ul className={`border-t border-line ${history.isPlaceholderData ? 'opacity-60' : ''}`}>
            {data.items.map((item) => (
              <HistoryRow key={item.sessionId} item={item} />
            ))}
          </ul>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(page) => update({ page })}
            disabled={history.isPlaceholderData}
          />
        </section>
      )}
    </div>
  )
}
