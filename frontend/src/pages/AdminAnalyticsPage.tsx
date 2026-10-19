import { useSearchParams } from 'react-router-dom'
import { SUMMARY_DAY_OPTIONS } from '../api/admin'
import { useAdminSummary } from '../api/queries'
import type { AdminSummary } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { BarList } from '../components/admin/BarList'
import { DailyBars } from '../components/admin/DailyBars'
import { StatCard } from '../components/admin/StatCard'
import { ErrorNotice } from '../components/ErrorNotice'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { LoadingText } from '../components/LoadingText'
import { EXPIRED_UNFINISHED_LABEL, NONE_OWNER_NOTE, OWNER_TYPE_LABELS, deviceLabel, formatConfidence, formatCount, formatPercent, outcomeLabel } from '../lib/adminView'
import { parseSummaryDays } from '../lib/adminParams'
import { useSlowWait } from '../lib/useSlowWait'

/**
 * หน้าสถิติภาพรวมของผู้ดูแลระบบ (/admin/analytics) — อ่านอย่างเดียว
 *
 * ทุกตัวเลขมาจาก GET /admin/analytics/summary ตรงๆ ไม่คำนวณ/แต่งเอง ช่วงวันที่เดียวกันทั้งหน้า (?days=7|30|90)
 * ค่า null (อัตราความพอใจ ความมั่นใจเฉลี่ย) แสดงเป็น "-" ไม่ใช่ 0
 */

const OUTCOME_ORDER = ['user_fixed', 'handoff_informed', 'handoff_unknown', 'normal_behavior', 'unknown'] as const

const DAY_BUTTON = 'min-h-10 rounded-lg border px-3 py-1.5 text-sm'
const DAY_ACTIVE = `${DAY_BUTTON} border-accent bg-accent/10 font-semibold text-accent`
const DAY_IDLE = `${DAY_BUTTON} border-line text-ink-soft hover:border-ink-faint hover:text-ink`

export function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const days = parseSummaryDays(searchParams)
  const summary = useAdminSummary(days)
  const isSlow = useSlowWait(summary.isPending)
  const data = summary.data

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ผู้ดูแลระบบ</h1>
        <p className="text-ink-soft">สถิติการใช้งานภาพรวม (อ่านอย่างเดียว)</p>
      </div>

      <AdminTabs />

      <div role="group" aria-label="ช่วงเวลา" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">ย้อนหลัง</span>
        {SUMMARY_DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === days}
            className={option === days ? DAY_ACTIVE : DAY_IDLE}
            onClick={() => setSearchParams(option === 30 ? {} : { days: String(option) })}
          >
            {option} วัน
          </button>
        ))}
        {data !== undefined && (
          <span className="text-sm text-ink-faint">
            ({data.window.from} ถึง {data.window.to} เวลาไทย)
          </span>
        )}
      </div>

      {isSlow && <SlowServerNotice />}

      {summary.isPending && (
        <LoadingText>กำลังโหลดสถิติ</LoadingText>
      )}

      {summary.isError && <ErrorNotice error={summary.error} onRetry={() => void summary.refetch()} />}

      {data !== undefined && <SummaryBody data={data} dimmed={summary.isPlaceholderData} />}
    </div>
  )
}

function SummaryBody({ data, dimmed }: { data: AdminSummary; dimmed: boolean }) {
  const { sessions, feedback, confidence } = data

  return (
    <div className={`space-y-6 ${dimmed ? 'opacity-60' : ''}`}>
      <section aria-label="สรุปตัวเลข" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="การตรวจทั้งหมด" value={formatCount(sessions.total)} />
        <StatCard label="จบแล้ว" value={formatCount(sessions.completed)} />
        <StatCard label="กำลังเดินอยู่" value={formatCount(sessions.inProgress)} />
        <StatCard
          label={EXPIRED_UNFINISHED_LABEL}
          value={formatCount(sessions.expiredUnfinished)}
          hint="ผู้ใช้เลิกกลางทางจนหมดอายุ (การกดยกเลิกลบรายการทิ้ง จึงไม่อยู่ในตัวเลขนี้)"
        />
        <StatCard
          label="ความเห็น 👍 / 👎"
          value={`${formatCount(feedback.helpful)} / ${formatCount(feedback.notHelpful)}`}
          hint={`ให้คะแนนทั้งหมด ${formatCount(feedback.total)} ครั้ง`}
        />
        <StatCard label="อัตราความพอใจ" value={formatPercent(feedback.satisfactionRate)} hint="สัดส่วน 👍 จากทุกคะแนน · - = ยังไม่มีคะแนน" />
        <StatCard
          label="ความมั่นใจเฉลี่ย"
          value={formatConfidence(confidence.average)}
          hint={`จาก ${formatCount(confidence.sampleSize)} การตรวจที่มีคะแนน · - = ไม่มีข้อมูล`}
        />
      </section>

      <section aria-label="เจ้าของการตรวจ" className="space-y-2 rounded-xl border border-line bg-panel p-4">
        <h3 className="font-semibold">การตรวจแยกตามเจ้าของ</h3>
        <ul className="grid gap-2 sm:grid-cols-3">
          {(['user', 'guest', 'none'] as const).map((owner) => (
            <li key={owner} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-soft">{OWNER_TYPE_LABELS[owner]}</span>
              <span className="font-semibold text-ink">{formatCount(sessions.byOwner[owner])}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-faint">{NONE_OWNER_NOTE}</p>
      </section>

      <DailyBars days={data.perDay} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="ผลการตรวจที่จบแล้ว"
          items={OUTCOME_ORDER.map((kind) => ({ key: kind, label: outcomeLabel(kind), value: data.outcomes[kind] }))}
        />
        <BarList
          title="ประเภทเครื่องที่ถูกตรวจมากสุด"
          items={data.topDevices.map((device) => ({
            key: device.deviceCategory,
            label: deviceLabel(device.deviceCategory),
            value: device.count,
          }))}
        />
      </div>

      <BarList
        title="อาการที่ถูกตรวจมากสุด"
        items={data.topGraphs.map((graph) => ({
          key: graph.graphId,
          label: graph.entrySymptomTh ?? graph.graphId,
          value: graph.count,
        }))}
      />
    </div>
  )
}
