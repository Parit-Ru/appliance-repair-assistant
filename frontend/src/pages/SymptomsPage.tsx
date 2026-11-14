import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LINK_CLASSES } from '../components/ui/Button'
import { ApiError } from '../api/http'
import { useFlows, useManuals, useSymptomSearch } from '../api/queries'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { SymptomSearchForm } from '../components/SymptomSearchForm'
import { SymptomSearchResults } from '../components/SymptomSearchResults'
import { ErrorNotice } from '../components/ErrorNotice'
import { LoadingText } from '../components/LoadingText'
import { Notice } from '../components/ui/Notice'
import { describeError } from '../lib/errors'
import { DEVICE_CATEGORY_LABELS } from '../lib/labels'
import { MODEL_MATCH_HINT, UNKNOWN_MODEL_NOTICE_TITLE, useChosenModel, symptomsPath } from '../lib/modelSelection'
import { manualTitle } from '../lib/models'
import { MAX_QUERY_LENGTH, checkText } from '../lib/textInput'
import { useSlowWait } from '../lib/useSlowWait'
import { useStartSymptom } from '../lib/useStartSymptom'

const SEARCH_INFO_CODES = new Set(['INVALID_QUERY', 'SEARCH_NOT_READY', 'SEARCH_UNAVAILABLE'])

export function SymptomsPage() {
  const { manualId, modelSelection } = useChosenModel()
  const manuals = useManuals()
  // ผังทุกรุ่น ใช้ตอนค้นแบบไม่ทราบรุ่นเท่านั้น (จับคู่ flowId ของผลค้นกับรุ่น) · แคชร่วมกับหน้าอื่น
  const flows = useFlows()
  const search = useSymptomSearch()
  const { start, startingId, isStarting, error: startError } = useStartSymptom()

  const [query, setQuery] = useState('')

  // ไม่มี ?manual= แต่มี unknown=1 = ผู้ใช้ไม่ทราบรุ่น ค้นจากทุกรุ่น (ไม่เลือกรุ่นให้เงียบ ๆ)
  const isUnknownModelSearch = manualId === undefined && modelSelection === 'unknown'

  function handleSearch() {
    if (checkText(query, MAX_QUERY_LENGTH) !== 'ok') return
    search.mutate({ query: query.trim(), manualId })
  }

  const isSlow = useSlowWait(isStarting || search.isPending)

  if (manualId === undefined && !isUnknownModelSearch) return <Navigate to="/devices" replace />

  const manual = manuals.data?.find((m) => m.manualId === manualId)
  // ลิงก์ "ดูอาการทั้งหมด" มีเฉพาะตอนเลือกรุ่นแล้ว · ตอนไม่ทราบรุ่นไม่ใส่ เพราะหน้านั้นไม่ส่ง modelSelection ทำให้คำเตือนหาย
  const allSymptomsPath = manualId === undefined ? undefined : symptomsPath(manualId, modelSelection, 'all')

  /** ชื่อรุ่นของอาการที่พบ (หาจาก flowId) — แสดงทุกแถวตอนค้นข้ามรุ่น */
  function modelLabelFor(flowId: string): string | undefined {
    const flow = flows.data?.find((f) => f.flowId === flowId)
    if (flow === undefined) return undefined
    const flowManual = manuals.data?.find((m) => m.manualId === flow.manualId)
    return `${DEVICE_CATEGORY_LABELS[flow.deviceCategory]} ${flow.brand} ${flowManual ? manualTitle(flowManual) : flow.modelPattern}`
  }

  function handleSelect(flowId: string, searchedQuery: string) {
    if (manualId !== undefined) {
      start(flowId, { query: searchedQuery, manualId, modelSelection })
      return
    }
    // ค้นข้ามรุ่น: ใช้ manualId ของอาการที่ผู้ใช้กดเอง และบันทึกเสมอว่า 'unknown' ห้ามเปลี่ยนเป็น 'selected'
    const flow = flows.data?.find((f) => f.flowId === flowId)
    if (flow === undefined) return
    start(flowId, { query: searchedQuery, manualId: flow.manualId, modelSelection: 'unknown' })
  }

  // ค้นข้ามรุ่นต้องรอรายการผังก่อน ไม่งั้นไม่รู้ว่าแต่ละอาการเป็นของรุ่นไหน
  const isResultReady = search.isSuccess && (!isUnknownModelSearch || flows.isSuccess)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">เลือกอาการที่พบ</h1>
        {isUnknownModelSearch ? (
          <>
            <p className="text-sm text-ink-soft">
              ไม่ทราบรุ่น: ค้นจากทุกรุ่น ·{' '}
              <Link to="/devices" className={LINK_CLASSES}>
                เลือกรุ่น
              </Link>
            </p>
            <p className="text-ink-soft">พิมพ์อาการที่พบให้ระบบช่วยหา ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น</p>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              รุ่น: {manual ? `${manual.brand} ${manualTitle(manual)}` : manualId}
              {modelSelection === 'unknown' && ' (ไม่ทราบรุ่น เลือกรุ่นใกล้เคียง)'} ·{' '}
              <Link to={manual ? `/devices?category=${encodeURIComponent(manual.deviceCategory)}` : '/devices'} className={LINK_CLASSES}>
                เปลี่ยนรุ่น
              </Link>
            </p>
            <p className="text-ink-soft">
              พิมพ์อาการที่พบให้ระบบช่วยหา ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น หรือ{' '}
              <Link to={allSymptomsPath ?? '/devices'} className={LINK_CLASSES}>
                ดูอาการทั้งหมด
              </Link>
            </p>
          </>
        )}
      </div>

      {isUnknownModelSearch && <Notice tone="info" title={UNKNOWN_MODEL_NOTICE_TITLE}>{MODEL_MATCH_HINT}</Notice>}

      {isSlow && <SlowServerNotice />}

      <SymptomSearchForm value={query} onChange={setQuery} onSubmit={handleSearch} isSearching={search.isPending} disabled={isStarting} />

      <div aria-live="polite" className="space-y-4">
        {search.isError && <SearchErrorNotice error={search.error} />}

        {isUnknownModelSearch && search.isSuccess && flows.isPending && <LoadingText>กำลังโหลดรายการรุ่น</LoadingText>}

        {isUnknownModelSearch && search.isSuccess && flows.isError && <ErrorNotice error={flows.error} onRetry={() => void flows.refetch()} />}

        {isResultReady && (
          <SymptomSearchResults
            result={search.data}
            startingId={startingId}
            isStarting={isStarting}
            onSelect={(flowId) => handleSelect(flowId, search.data.query)}
            modelLabelFor={isUnknownModelSearch ? modelLabelFor : undefined}
          />
        )}
      </div>

      {startError && <ErrorNotice error={startError} />}

      {allSymptomsPath !== undefined && (
        <p className="text-sm text-ink-soft">
          ไม่เจออาการที่ตรง?{' '}
          <Link to={allSymptomsPath} className={LINK_CLASSES}>
            ดูอาการทั้งหมด
          </Link>
        </p>
      )}
    </div>
  )
}

function SearchErrorNotice({ error }: { error: Error }) {
  const described = describeError(error)
  const isInfo = error instanceof ApiError && SEARCH_INFO_CODES.has(error.code)

  return (
    <Notice tone={isInfo ? 'info' : 'danger'} title={described.title}>
      {described.detail}
    </Notice>
  )
}
