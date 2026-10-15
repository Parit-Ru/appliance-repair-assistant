import { useId } from 'react'
import type { FormEvent } from 'react'
import type { DeviceCategory, HistoryListResponse, HistoryParams, HistorySort, OutcomeKind } from '../../api/types'
import { MAX_HISTORY_SEARCH_LENGTH } from '../../lib/historyParams'
import { DEVICE_CATEGORY_LABELS, HISTORY_STATUS_LABELS, HISTORY_STATUS_ORDER } from '../../lib/labels'
import { Button } from '../ui/Button'

interface HistoryFiltersProps {
  params: HistoryParams
  /** ตัวเลือกประเภท/ยี่ห้อจากประวัติของผู้ใช้ ยังไม่โหลด = undefined (แสดงเฉพาะค่าที่เลือกอยู่) */
  facets: HistoryListResponse['facets'] | undefined
  hasFilters: boolean
  onChange: (patch: Partial<HistoryParams>) => void
  onClear: () => void
}

const FIELD_CLASSES =
  'min-h-12 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** ตัวเลือกของ select: ตัวเลือกจากเซิร์ฟเวอร์ + ค่าที่เลือกอยู่ (กรณีพิมพ์ URL เอง) ไม่ซ้ำ */
function withSelected<T extends string>(options: readonly T[], selected: T | undefined): T[] {
  return selected === undefined || options.includes(selected) ? [...options] : [...options, selected]
}

export function HistoryFilters({ params, facets, hasFilters, onChange, onClear }: HistoryFiltersProps) {
  const searchId = useId()
  const categoryId = useId()
  const brandId = useId()
  const statusId = useId()
  const sortId = useId()

  const categories = withSelected(facets?.categories ?? [], params.category)
  const brands = withSelected(facets?.brands ?? [], params.brand)

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('q')
    onChange({ q: typeof value === 'string' ? value.trim() : '' })
  }

  return (
    <div className="space-y-4">
      {/* key = คำค้นใน URL: กดย้อนกลับ/ล้างตัวกรอง แล้วช่องพิมพ์เปลี่ยนตาม URL */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="flex-1">
          <label htmlFor={searchId} className="sr-only">
            ค้นหาในประวัติ
          </label>
          <input
            key={params.q}
            id={searchId}
            name="q"
            type="search"
            defaultValue={params.q}
            maxLength={MAX_HISTORY_SEARCH_LENGTH}
            placeholder="ค้นหาอาการ ยี่ห้อ หรือรุ่น"
            className={FIELD_CLASSES}
          />
        </div>
        <Button type="submit" variant="primary">
          ค้นหา
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={categoryId} className="block text-sm text-ink-soft">
            ประเภทเครื่อง
          </label>
          <select
            id={categoryId}
            value={params.category ?? ''}
            onChange={(event) => onChange({ category: (event.target.value || undefined) as DeviceCategory | undefined })}
            className={FIELD_CLASSES}
          >
            <option value="">ทั้งหมด</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {DEVICE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor={brandId} className="block text-sm text-ink-soft">
            ยี่ห้อ
          </label>
          <select
            id={brandId}
            value={params.brand ?? ''}
            onChange={(event) => onChange({ brand: event.target.value || undefined })}
            className={FIELD_CLASSES}
          >
            <option value="">ทั้งหมด</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor={statusId} className="block text-sm text-ink-soft">
            สถานะ
          </label>
          <select
            id={statusId}
            value={params.status ?? ''}
            onChange={(event) => onChange({ status: (event.target.value || undefined) as OutcomeKind | undefined })}
            className={FIELD_CLASSES}
          >
            <option value="">ทั้งหมด</option>
            {HISTORY_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {HISTORY_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor={sortId} className="block text-sm text-ink-soft">
            เรียงตามวันที่
          </label>
          <select
            id={sortId}
            value={params.sort}
            onChange={(event) => onChange({ sort: event.target.value as HistorySort })}
            className={FIELD_CLASSES}
          >
            <option value="newest">ใหม่สุดก่อน</option>
            <option value="oldest">เก่าสุดก่อน</option>
          </select>
        </div>
      </div>

      {hasFilters && (
        <Button variant="text" onClick={onClear}>
          ล้างตัวกรอง
        </Button>
      )}
    </div>
  )
}
