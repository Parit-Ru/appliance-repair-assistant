import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/http'
import { useGraphs, useStartSession, useSymptomSearch } from '../api/queries'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { SymptomRow } from '../components/SymptomRow'
import { SymptomSearchForm } from '../components/SymptomSearchForm'
import { SymptomSearchResults } from '../components/SymptomSearchResults'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { describeError } from '../lib/errors'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { checkQuery, normalizeQuery } from '../lib/search'
import { groupSymptoms } from '../lib/symptoms'
import { useSlowWait } from '../lib/useSlowWait'

/**
 * หน้าเลือกอาการ
 *
 * มีสองทางเริ่มการตรวจ
 *   1. พิมพ์อาการ → ระบบค้นหาเสนอผังที่ใกล้เคียง (สูงสุด 3) → ผู้ใช้เลือกเอง
 *   2. เลือกจากรายการอาการทั้งหมด (ทางเดิม ใช้ได้เสมอแม้ระบบค้นหาใช้ไม่ได้)
 *
 * การค้นหาเป็นแค่ตัวช่วยเลือก ขั้นถัดไปในผังเป็นของเครื่องสถานะที่เซิร์ฟเวอร์เสมอ
 * กดแถวไหน = เริ่ม session ของอาการนั้น แล้วไปหน้าตรวจอาการ
 */

/** แถวที่กดอยู่มาจากส่วนไหนของหน้า (ผังเดียวกันอาจอยู่ทั้งผลค้นหาและรายการ) */
type Area = 'search' | 'list'

/**
 * รหัสข้อผิดพลาดของการค้นหาที่ "ไม่ใช่ความล้มเหลวของระบบ" ใช้กล่องสีฟ้า
 * (ระบบค้นหายังไม่พร้อม หรือข้อความที่พิมพ์ใช้ไม่ได้ ผู้ใช้ยังเลือกจากรายการต่อได้)
 */
const SEARCH_INFO_CODES = new Set(['INVALID_QUERY', 'SEARCH_NOT_READY', 'SEARCH_UNAVAILABLE'])

export function SymptomsPage() {
  const graphs = useGraphs()
  const search = useSymptomSearch()
  const startSession = useStartSession()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')

  /**
   * แถวที่กด เก็บเองเพราะ useStartSession บอกได้แค่ว่ากำลังเริ่มอยู่
   * แต่ไม่บอกว่าเริ่มของแถวไหน (เก็บส่วนของหน้าไว้ด้วยเพราะผังเดียวกันอยู่ได้สองที่)
   */
  const [startingRow, setStartingRow] = useState<{ area: Area; graphId: string } | null>(null)
  const isStarting = startSession.isPending

  /**
   * เริ่ม session ใน onClick เท่านั้น ห้ามย้ายไปไว้ใน useEffect
   * เพราะ StrictMode ในโหมด dev เรียก effect สองรอบ จะได้ session สองอัน
   *
   * query ส่งเฉพาะแถวในผลค้นหา และเป็นข้อความที่ใช้ค้นจริง (search.data.query)
   * ไม่ใช่ข้อความที่ผู้ใช้กำลังแก้อยู่ในช่อง ไม่งั้นคะแนนจะไม่ตรงกับผลที่เห็น
   * แถวในรายการไม่ส่ง query → ไม่มีคะแนน (confidence เป็น null)
   *
   * ไม่ต้อง GET session ซ้ำหลังเริ่ม เพราะ useStartSession ใส่ผลลงแคชให้แล้ว
   * หน้าตรวจอาการจึงแสดงได้ทันที
   */
  function handleSelect(area: Area, graphId: string) {
    setStartingRow({ area, graphId })
    startSession.mutate({ graphId, query: area === 'search' ? search.data?.query : undefined }, { onSuccess: (session) => navigate(`/session/${session.sessionId}`) })
  }

  function handleSearch() {
    if (checkQuery(query) !== 'ok') return
    search.mutate(normalizeQuery(query))
  }

  /** สภาพของแถวหนึ่งแถว: กำลังเริ่มเอง หรือถูกปิดเพราะแถวอื่นกำลังเริ่ม */
  function rowState(area: Area, graphId: string) {
    const isThisRow = startingRow?.area === area && startingRow.graphId === graphId
    return {
      isStarting: isStarting && isThisRow,
      disabled: isStarting && !isThisRow,
    }
  }

  // ---------- รอนาน: เซิร์ฟเวอร์บน Render หลับเมื่อไม่มีคนใช้ ตื่นช้า ----------
  const isSlow = useSlowWait(graphs.isPending || isStarting || search.isPending)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">เลือกอาการที่พบ</h1>
        <p className="text-ink-soft">พิมพ์อาการที่พบให้ระบบช่วยหา หรือเลือกจากรายการด้านล่าง ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น</p>
      </div>

      {isSlow && <SlowServerNotice />}

      {/* ค้นหา: ไม่ขึ้นกับการโหลดรายการอาการ จึงแสดงตั้งแต่แรก */}
      <SymptomSearchForm value={query} onChange={setQuery} onSubmit={handleSearch} isSearching={search.isPending} disabled={isStarting} />

      {/* aria-live: โปรแกรมอ่านหน้าจอจะอ่านผลค้นหา/ข้อผิดพลาดที่โผล่ขึ้นมาให้เอง */}
      <div aria-live="polite" className="space-y-4">
        {search.isError && <SearchErrorNotice error={search.error} />}

        {search.isSuccess && <SymptomSearchResults result={search.data} startingId={startingRow?.area === 'search' ? startingRow.graphId : null} isStarting={isStarting} onSelect={(graphId) => handleSelect('search', graphId)} />}
      </div>

      {/* เริ่มไม่สำเร็จ: แสดงเหนือส่วนรายการ ทุกแถวกดได้อีกครั้งเพราะ isPending กลับเป็น false
          วางนอกส่วนรายการ เพราะเริ่มจากผลค้นหาก็ล้มได้ และรายการอาจยังโหลดไม่เสร็จ */}
      {startSession.isError && <SymptomsErrorNotice error={startSession.error} />}

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">เลือกจากรายการอาการ</h2>

        {graphs.isPending && (
          <p className="flex items-center gap-2 text-ink-soft">
            <Icon name="spinner" className="h-5 w-5 animate-spin" />
            กำลังโหลดรายการอาการ
          </p>
        )}

        {graphs.isError && (
          <SymptomsErrorNotice error={graphs.error}>
            <Button variant="secondary" className="mt-3" onClick={() => graphs.refetch()}>
              ลองอีกครั้ง
            </Button>
          </SymptomsErrorNotice>
        )}

        {graphs.isSuccess && graphs.data.length === 0 && <p className="text-ink-soft">ยังไม่มีอาการให้เลือก</p>}

        {graphs.isSuccess &&
          graphs.data.length > 0 &&
          groupSymptoms(graphs.data).map((group) => (
            <div key={`${group.deviceCategory}|${group.brand}|${group.modelPattern}`}>
              <h3 className="font-semibold">{DEVICE_CATEGORY_LABELS[group.deviceCategory]}</h3>
              <p className="text-sm text-ink-soft">
                {group.brand} <code className="font-mono">{group.modelPattern}</code>
              </p>

              <ul className="mt-2 border-t border-line">
                {group.symptoms.map((summary) => (
                  <SymptomRow key={summary.graphId} summary={summary} {...rowState('list', summary.graphId)} onSelect={(graphId) => handleSelect('list', graphId)} />
                ))}
              </ul>
            </div>
          ))}
      </section>
    </div>
  )
}

/**
 * กล่องแจ้งข้อผิดพลาดของการค้นหา ข้อความมาจาก describeError (ตัดสินจาก code ไม่ใช้ message ของเซิร์ฟเวอร์)
 * ไม่มีปุ่มของตัวเอง: ลองใหม่ = กดค้นหาซ้ำ ส่วนทางอื่นคือรายการอาการด้านล่างที่ยังอยู่ครบ
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

/**
 * กล่องแจ้งข้อผิดพลาด ใช้ร่วมกันทั้งตอนโหลดรายการไม่ได้ และตอนเริ่ม session ไม่ได้
 * - เชื่อมต่อไม่ได้ (NETWORK_ERROR) → บอกให้ลองใหม่
 * - เซิร์ฟเวอร์ตอบกลับมาว่าผิดพลาด → แสดง HTTP status ไว้ใช้ไล่หาสาเหตุ
 *
 * ใช้แค่ในหน้านี้ จึงไม่แยกไฟล์ ถ้าหน้าอื่นต้องใช้ค่อยย้ายไป components
 */
function SymptomsErrorNotice({ error, children }: { error: Error; children?: ReactNode }) {
  const isNetwork = error instanceof ApiError && error.code === 'NETWORK_ERROR'

  if (isNetwork) {
    return (
      <Notice tone="danger" title="เชื่อมต่อเซิร์ฟเวอร์ไม่ได้">
        ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง
        {children}
      </Notice>
    )
  }

  const status = error instanceof ApiError ? `HTTP ${error.status}` : error.message
  return (
    <Notice tone="danger" title="เกิดข้อผิดพลาด">
      เซิร์ฟเวอร์ตอบกลับผิดปกติ ({status}){children}
    </Notice>
  )
}
