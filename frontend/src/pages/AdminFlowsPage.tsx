import { useId } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminFlows } from '../api/queries'
import type { AdminFlowListParams, AdminFlowStatusFilter, DeviceCategory } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { FlowRow } from '../components/admin/flows/FlowRow'
import { ErrorNotice } from '../components/ErrorNotice'
import { Pagination } from '../components/history/Pagination'
import { LoadingText } from '../components/LoadingText'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { Button } from '../components/ui/Button'
import { adminFlowToSearchParams, hasAdminFlowFilters, parseAdminFlowParams, patchAdminFlowParams } from '../lib/adminFlowParams'
import { DEVICE_CATEGORIES, DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { useSlowWait } from '../lib/useSlowWait'

const FIELD_CLASSES = 'min-h-12 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const STATUS_OPTIONS: Array<{ value: AdminFlowStatusFilter; label: string }> = [
  { value: 'active', label: 'ใช้งานอยู่' },
  { value: 'deleted', label: 'ลบแล้ว' },
  { value: 'all', label: 'ทั้งหมด' },
]

export function AdminFlowsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseAdminFlowParams(searchParams)
  const flows = useAdminFlows(params)
  const isSlow = useSlowWait(flows.isPending)
  const data = flows.data
  const hasFilters = hasAdminFlowFilters(params)

  const queryId = useId()
  const categoryId = useId()
  const statusId = useId()

  function update(patch: Partial<AdminFlowListParams>) {
    setSearchParams(adminFlowToSearchParams(patchAdminFlowParams(params, patch)))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ผู้ดูแลระบบ</h1>
        <p className="text-ink-soft">แผนผังขั้นตอนที่เผยแพร่แล้ว — ดู ค้นหา และจัดการ</p>
      </div>

      <AdminTabs />

      <form
        className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]"
        onSubmit={(event) => {
          // The search box is uncontrolled and applied on submit, so typing does not refetch on every key
          event.preventDefault()
          const trimmed = String(new FormData(event.currentTarget).get('q') ?? '').trim()
          update({ q: trimmed === '' ? undefined : trimmed })
        }}>
        <div className="space-y-1">
          <label htmlFor={queryId} className="block text-sm text-ink-soft">
            ค้นหา (อาการ รุ่น ยี่ห้อ รหัส)
          </label>
          <input key={params.q ?? ''} id={queryId} name="q" type="search" defaultValue={params.q ?? ''} maxLength={100} className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label htmlFor={categoryId} className="block text-sm text-ink-soft">
            ประเภทเครื่อง
          </label>
          <select
            id={categoryId}
            value={params.deviceCategory ?? ''}
            onChange={(event) => update({ deviceCategory: event.target.value === '' ? undefined : (event.target.value as DeviceCategory) })}
            className={FIELD_CLASSES}>
            <option value="">ทั้งหมด</option>
            {DEVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {DEVICE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={statusId} className="block text-sm text-ink-soft">
            สถานะ
          </label>
          <select id={statusId} value={params.status} onChange={(event) => update({ status: event.target.value as AdminFlowStatusFilter })} className={FIELD_CLASSES}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit">ค้นหา</Button>
        </div>
      </form>

      {hasFilters && (
        <Button variant="secondary" onClick={() => setSearchParams({})}>
          ล้างตัวกรอง
        </Button>
      )}

      {isSlow && <SlowServerNotice />}
      {flows.isPending && <LoadingText>กำลังโหลดรายการแผนผังขั้นตอน</LoadingText>}
      {flows.isError && <ErrorNotice error={flows.error} onRetry={() => void flows.refetch()} />}

      {data !== undefined && data.total === 0 && (
        <div className="space-y-2 rounded-xl border border-line bg-panel p-5">
          <p className="font-semibold">{hasFilters ? 'ไม่พบแผนผังขั้นตอนที่ตรงกับตัวกรอง' : 'ยังไม่มีแผนผังขั้นตอนที่เผยแพร่'}</p>
        </div>
      )}

      {data !== undefined && data.total > 0 && (
        <section aria-label="รายการแผนผังขั้นตอน" className="space-y-4">
          <p className="text-sm text-ink-soft">{hasFilters ? `พบ ${data.total} แผนผังขั้นตอน` : `ทั้งหมด ${data.total} แผนผังขั้นตอน`}</p>

          <ul className={`border-t border-line ${flows.isPlaceholderData ? 'opacity-60' : ''}`}>
            {data.items.map((item) => (
              <FlowRow key={item.flowId} item={item} />
            ))}
          </ul>

          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => update({ page })} disabled={flows.isPlaceholderData} />
        </section>
      )}
    </div>
  )
}
