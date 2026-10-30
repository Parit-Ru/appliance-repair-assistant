import { useId } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminFeedback } from '../api/queries'
import type { AdminFeedbackItem, AdminFeedbackParams } from '../api/types'
import { AdminTabs } from '../components/admin/AdminTabs'
import { ErrorNotice } from '../components/ErrorNotice'
import { Pagination } from '../components/history/Pagination'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { Button } from '../components/ui/Button'
import { LoadingText } from '../components/LoadingText'
import { OWNER_TYPE_LABELS, deviceLabel } from '../lib/adminView'
import { feedbackToSearchParams, hasFeedbackFilters, parseFeedbackParams, patchFeedbackParams } from '../lib/adminParams'
import { formatStartedAt } from '../lib/historyView'
import { useSlowWait } from '../lib/useSlowWait'

const FIELD_CLASSES ='min-h-12 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function AdminFeedbackPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseFeedbackParams(searchParams)
  const feedback = useAdminFeedback(params)
  const isSlow = useSlowWait(feedback.isPending)
  const data = feedback.data
  const hasFilters = hasFeedbackFilters(params)

  const helpfulId = useId()
  const fromId = useId()
  const toId = useId()

  function update(patch: Partial<AdminFeedbackParams>) {
    setSearchParams(feedbackToSearchParams(patchFeedbackParams(params, patch)))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ผู้ดูแลระบบ</h1>
        <p className="text-ink-soft">ความเห็นและคะแนน 👍/👎 ที่ผู้ใช้ให้หลังการตรวจ (อ่านอย่างเดียว)</p>
      </div>

      <AdminTabs />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor={helpfulId} className="block text-sm text-ink-soft">
            คะแนน
          </label>
          <select
            id={helpfulId}
            value={params.helpful === undefined ? '' : String(params.helpful)}
            onChange={(event) => update({ helpful: event.target.value === '' ? undefined : event.target.value === 'true' })}
            className={FIELD_CLASSES}>
            <option value="">ทั้งหมด</option>
            <option value="true">👍 เป็นประโยชน์</option>
            <option value="false">👎 ไม่เป็นประโยชน์</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={fromId} className="block text-sm text-ink-soft">
            ตั้งแต่วันที่
          </label>
          <input
            id={fromId}
            type="date"
            value={params.from ?? ''}
            max={params.to}
            onChange={(event) => update({ from: event.target.value === '' ? undefined : event.target.value })}
            className={FIELD_CLASSES}/>
        </div>
        <div className="space-y-1">
          <label htmlFor={toId} className="block text-sm text-ink-soft">
            ถึงวันที่
          </label>
          <input
            id={toId}
            type="date"
            value={params.to ?? ''}
            min={params.from}
            onChange={(event) => update({ to: event.target.value === '' ? undefined : event.target.value })}
            className={FIELD_CLASSES} />
        </div>
      </div>

      {hasFilters && (
        <Button variant="secondary" onClick={() => setSearchParams({})}>
          ล้างตัวกรอง
        </Button>
      )}

      {isSlow && <SlowServerNotice />}

      {feedback.isPending && (
        <LoadingText>กำลังโหลดความเห็น</LoadingText>
      )}

      {feedback.isError && <ErrorNotice error={feedback.error} onRetry={() => void feedback.refetch()} />}

      {data !== undefined && data.total === 0 && (
        <div className="space-y-2 rounded-xl border border-line bg-panel p-5">
          <p className="font-semibold">{hasFilters ? 'ไม่พบความเห็นที่ตรงกับตัวกรอง' : 'ยังไม่มีความเห็นจากผู้ใช้'}</p>
          {!hasFilters && <p className="text-ink-soft">เมื่อผู้ใช้ให้คะแนนหลังตรวจเสร็จ รายการจะมาอยู่ที่นี่</p>}
        </div>
      )}

      {data !== undefined && data.total > 0 && (
        <section aria-label="รายการความเห็น" className="space-y-4">
          <p className="text-sm text-ink-soft">
            {hasFilters ? `พบ ${data.total} รายการ` : `ทั้งหมด ${data.total} รายการ`}
          </p>

          <ul className={`border-t border-line ${feedback.isPlaceholderData ? 'opacity-60' : ''}`}>
            {data.items.map((item) => (
              <FeedbackRow key={item.sessionId} item={item} />
            ))}
          </ul>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(page) => update({ page })}
            disabled={feedback.isPlaceholderData}
          />
        </section>
      )}
    </div>
  )
}

function FeedbackRow({ item }: { item: AdminFeedbackItem }) {
  return (
    <li className="space-y-2 border-b border-line py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            item.helpful ? 'border-success/40 text-success' : 'border-danger/40 text-danger'
          }`}>
          {item.helpful ? '👍 เป็นประโยชน์' : '👎 ไม่เป็นประโยชน์'}
        </span>
        <time dateTime={item.createdAt} className="text-sm text-ink-soft">
          {formatStartedAt(item.createdAt)}
        </time>
        <span className="text-sm text-ink-faint">{OWNER_TYPE_LABELS[item.ownerType]}</span>
      </div>

      {item.comment === null ? (
        <p className="text-sm text-ink-faint">(ไม่มีข้อความ)</p>
      ) : (
        <p className="whitespace-pre-wrap break-words text-ink">{item.comment}</p>
      )}

      <p className="text-sm text-ink-soft">
        {deviceLabel(item.deviceCategory)}
        {item.brand !== null && ` · ${item.brand}`}
      </p>
    </li>
  )
}
