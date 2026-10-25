import { Link, useSearchParams } from 'react-router-dom'
import { useHistory } from '../api/queries'
import { ErrorNotice } from '../components/ErrorNotice'
import { HistoryRow } from '../components/history/HistoryRow'
import { Pagination } from '../components/history/Pagination'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { Notice } from '../components/ui/Notice'
import { LoadingText } from '../components/LoadingText'
import { useAuth } from '../lib/authContext'
import { HISTORY_RETENTION_DAYS } from '../lib/historyView'
import { useSlowWait } from '../lib/useSlowWait'

const LINK_CLASSES = 'text-accent underline-offset-4 hover:underline'

function pageFromUrl(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const history = useHistory(pageFromUrl(searchParams.get('page')))
  const { user } = useAuth()
  const isLoggedIn = user !== undefined

  const isSlow = useSlowWait(history.isPending)

  const data = history.data

  function goToPage(page: number) {
    setSearchParams(page === 1 ? {} : { page: String(page) })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">ประวัติการซ่อม</h1>
        {isLoggedIn ? (
          <>
            <p className="text-ink-soft">การตรวจอาการที่จบแล้วในบัญชีของคุณ เปิดดูผลย้อนหลังหรือตรวจซ้ำได้</p>
            <p className="text-sm text-ink-faint">
              ประวัติผูกกับบัญชีและเก็บไว้ {HISTORY_RETENTION_DAYS} วัน เข้าสู่ระบบจากเครื่องอื่นก็เห็นประวัติเดียวกัน
            </p>
          </>
        ) : (
          <>
            <p className="text-ink-soft">การตรวจอาการที่จบแล้วของเบราว์เซอร์เครื่องนี้ เปิดดูผลย้อนหลังหรือตรวจซ้ำได้</p>
            <p className="text-sm text-ink-faint">
              ประวัติผูกกับเบราว์เซอร์เครื่องนี้และเก็บไว้ {HISTORY_RETENTION_DAYS} วัน ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่องจะไม่เห็นประวัติเดิม
            </p>
            <p className="text-sm text-ink-faint">
              <Link to="/login?next=%2Fhistory" className={LINK_CLASSES}>
                เข้าสู่ระบบ
              </Link>{' '}
              เพื่อเก็บประวัติไว้กับบัญชี (การตรวจที่ทำก่อนเข้าสู่ระบบจะไม่ย้ายเข้าบัญชี)
            </p>
          </>
        )}
      </div>

      {isLoggedIn && (
        <Notice tone="info" title="ประวัติที่ทำก่อนเข้าสู่ระบบอยู่ที่ไหน">
          หน้านี้แสดงเฉพาะการตรวจที่ทำขณะเข้าสู่ระบบ ประวัติที่ทำก่อนเข้าสู่ระบบยังผูกกับเบราว์เซอร์นี้ ดูได้เมื่อออกจากระบบ
        </Notice>
      )}

      {isSlow && <SlowServerNotice />}

      {history.isPending && (
        <LoadingText>กำลังโหลดประวัติ</LoadingText>
      )}

      {history.isError && <ErrorNotice error={history.error} onRetry={() => void history.refetch()} />}

      {data !== undefined && data.total === 0 && (
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

      {data !== undefined && data.total > 0 && (
        <section aria-label="รายการประวัติ" className="space-y-4">
          <p className="text-sm text-ink-soft">ทั้งหมด {data.total} รายการ</p>

          <ul className={`border-t border-line ${history.isPlaceholderData ? 'opacity-60' : ''}`}>
            {data.items.map((item) => (
              <HistoryRow key={item.sessionId} item={item} />
            ))}
          </ul>

          <Pagination page={data.page} totalPages={data.totalPages} onChange={goToPage} disabled={history.isPlaceholderData} />
        </section>
      )}
    </div>
  )
}
