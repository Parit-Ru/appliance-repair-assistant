import type { AdminSummary } from '../../api/types'
import { barPercent, formatCount, formatShortDate } from '../../lib/adminView'

interface DailyBarsProps {
  days: AdminSummary['perDay']
}

export function DailyBars({ days }: DailyBarsProps) {
  const max = Math.max(0, ...days.map((day) => day.started))
  const first = days[0]
  const last = days[days.length - 1]

  return (
    <section aria-label="จำนวนการตรวจรายวัน" className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <h3 className="font-semibold">จำนวนการตรวจรายวัน</h3>

      {max === 0 ? (
        <p className="text-sm text-ink-soft">ยังไม่มีการตรวจในช่วงนี้</p>
      ) : (
        <>
          <div className="flex h-32 items-end gap-px" aria-hidden="true">
            {days.map((day) => (
              <div
                key={day.date}
                title={`${formatShortDate(day.date)}: เริ่ม ${day.started} · จบ ${day.completed}`}
                className="relative flex h-full min-w-0 flex-1 items-end"
              >
                <div className="relative w-full overflow-hidden rounded-t-sm bg-accent/40" style={{ height: `${barPercent(day.started, max)}%` }}>
                  <div
                    className="absolute inset-x-0 bottom-0 bg-success"
                    style={{ height: `${day.started === 0 ? 0 : Math.round((day.completed / day.started) * 100)}%` }}/>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-xs text-ink-faint" aria-hidden="true">
            <span>{first !== undefined ? formatShortDate(first.date) : ''}</span>
            <span>สูงสุด {formatCount(max)} ครั้ง/วัน</span>
            <span>{last !== undefined ? formatShortDate(last.date) : ''}</span>
          </div>

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span>
              <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-accent/40" aria-hidden="true" />
              เริ่มตรวจ
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-success" aria-hidden="true" />
              จบแล้ว
            </span>
          </p>

          <ul className="sr-only">
            {days.map((day) => (
              <li key={day.date}>
                {formatShortDate(day.date)}: เริ่มตรวจ {day.started} ครั้ง จบแล้ว {day.completed} ครั้ง
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
