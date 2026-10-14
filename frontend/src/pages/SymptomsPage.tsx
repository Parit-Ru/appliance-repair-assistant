import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/http'
import { useSymptomSearch } from '../api/queries'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { SymptomSearchForm } from '../components/SymptomSearchForm'
import { SymptomSearchResults } from '../components/SymptomSearchResults'
import { SymptomsErrorNotice } from '../components/SymptomsErrorNotice'
import { Notice } from '../components/ui/Notice'
import { describeError } from '../lib/errors'
import { checkQuery, normalizeQuery } from '../lib/search'
import { useSlowWait } from '../lib/useSlowWait'
import { useStartSymptom } from '../lib/useStartSymptom'

/**
 * หน้าเลือกอาการ (พิมพ์ให้ระบบช่วยหา)
 *
 * พิมพ์อาการ → ระบบค้นหาเสนอผังที่ใกล้เคียง (สูงสุด 3) → ผู้ใช้เลือกเอง
 * ถ้าระบบค้นหาใช้ไม่ได้หรือไม่เจอ ผู้ใช้เลือกจากหน้า "อาการทั้งหมด" (AllSymptomsPage) แทนได้เสมอ
 *
 * การค้นหาเป็นแค่ตัวช่วยเลือก ขั้นถัดไปในผังเป็นของเครื่องสถานะที่เซิร์ฟเวอร์เสมอ
 * กดแถวไหน = เริ่ม session ของอาการนั้น แล้วไปหน้าตรวจอาการ
 */

/**
 * รหัสข้อผิดพลาดของการค้นหาที่ "ไม่ใช่ความล้มเหลวของระบบ" ใช้กล่องสีฟ้า
 * (ระบบค้นหายังไม่พร้อม หรือข้อความที่พิมพ์ใช้ไม่ได้ ผู้ใช้ยังเลือกจากหน้าอาการทั้งหมดต่อได้)
 */
const SEARCH_INFO_CODES = new Set(['INVALID_QUERY', 'SEARCH_NOT_READY', 'SEARCH_UNAVAILABLE'])

const LINK_CLASSES = 'text-accent underline-offset-4 hover:underline'

export function SymptomsPage() {
  const search = useSymptomSearch()
  const { start, startingId, isStarting, error: startError } = useStartSymptom()

  const [query, setQuery] = useState('')

  function handleSearch() {
    if (checkQuery(query) !== 'ok') return
    search.mutate(normalizeQuery(query))
  }

  // ---------- รอนาน: เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า ----------
  const isSlow = useSlowWait(isStarting || search.isPending)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">เลือกอาการที่พบ</h1>
        <p className="text-ink-soft">
          พิมพ์อาการที่พบให้ระบบช่วยหา ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น หรือ{' '}
          <Link to="/symptoms/all" className={LINK_CLASSES}>
            ดูอาการทั้งหมด
          </Link>
        </p>
      </div>

      {isSlow && <SlowServerNotice />}

      <SymptomSearchForm value={query} onChange={setQuery} onSubmit={handleSearch} isSearching={search.isPending} disabled={isStarting} />

      {/* aria-live: โปรแกรมอ่านหน้าจอจะอ่านผลค้นหา/ข้อผิดพลาดที่โผล่ขึ้นมาให้เอง */}
      <div aria-live="polite" className="space-y-4">
        {search.isError && <SearchErrorNotice error={search.error} />}

        {search.isSuccess && <SymptomSearchResults result={search.data} startingId={startingId} isStarting={isStarting} onSelect={(graphId) => start(graphId, search.data.query)} />}
      </div>

      {startError && <SymptomsErrorNotice error={startError} />}

      <p className="text-sm text-ink-soft">
        ไม่เจออาการที่ตรง?{' '}
        <Link to="/symptoms/all" className={LINK_CLASSES}>
          ดูอาการทั้งหมด
        </Link>
      </p>
    </div>
  )
}

/**
 * กล่องแจ้งข้อผิดพลาดของการค้นหา ข้อความมาจาก describeError (ตัดสินจาก code ไม่ใช้ message ของเซิร์ฟเวอร์)
 * ไม่มีปุ่มของตัวเอง: ลองใหม่ = กดค้นหาซ้ำ ส่วนทางอื่นคือหน้าอาการทั้งหมด
 */
function SearchErrorNotice({ error }: { error: Error }) {
  const described = describeError(error)
  const isInfo = error instanceof ApiError && SEARCH_INFO_CODES.has(error.code)

  return (
    <Notice tone={isInfo ? 'info' : 'danger'} title={described.title}>
      {described.detail}
    </Notice>
  )
}
