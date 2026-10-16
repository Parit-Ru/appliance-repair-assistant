import { barPercent, formatCount } from '../../lib/adminView'

export interface BarItem {
  key: string
  label: string
  value: number
}

interface BarListProps {
  /** ชื่อกราฟ (อ่านออกเสียงด้วย) */
  title: string
  items: BarItem[]
  emptyText?: string
}

/**
 * กราฟแท่งแนวนอนที่สร้างเองด้วย CSS (ไม่ใช้ไลบรารีกราฟ)
 * ตัวเลขจริงแสดงเป็นข้อความข้างแท่งเสมอ จึงอ่านได้ครบแม้ไม่เห็นสี/ใช้โปรแกรมอ่านหน้าจอ
 */
export function BarList({ title, items, emptyText = 'ยังไม่มีข้อมูลในช่วงนี้' }: BarListProps) {
  const max = Math.max(0, ...items.map((item) => item.value))

  return (
    <section aria-label={title} className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words text-ink">{item.label}</span>
                <span className="shrink-0 font-semibold text-ink">{formatCount(item.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${barPercent(item.value, max)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
