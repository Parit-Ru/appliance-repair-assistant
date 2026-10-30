import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LINK_CLASSES } from '../components/ui/Button'
import { ApiError } from '../api/http'
import { useManuals, useSymptomSearch } from '../api/queries'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { SymptomSearchForm } from '../components/SymptomSearchForm'
import { SymptomSearchResults } from '../components/SymptomSearchResults'
import { ErrorNotice } from '../components/ErrorNotice'
import { Notice } from '../components/ui/Notice'
import { describeError } from '../lib/errors'
import { useChosenModel, symptomsPath } from '../lib/modelSelection'
import { manualTitle } from '../lib/models'
import { MAX_QUERY_LENGTH, checkText } from '../lib/textInput'
import { useSlowWait } from '../lib/useSlowWait'
import { useStartSymptom } from '../lib/useStartSymptom'

const SEARCH_INFO_CODES = new Set(['INVALID_QUERY', 'SEARCH_NOT_READY', 'SEARCH_UNAVAILABLE'])

export function SymptomsPage() {
  const { manualId, modelSelection } = useChosenModel()
  const manuals = useManuals()
  const search = useSymptomSearch()
  const { start, startingId, isStarting, error: startError } = useStartSymptom()

  const [query, setQuery] = useState('')

  function handleSearch() {
    if (checkText(query, MAX_QUERY_LENGTH) !== 'ok') return
    search.mutate({ query: query.trim(), manualId })
  }

  const isSlow = useSlowWait(isStarting || search.isPending)

  if (manualId === undefined) return <Navigate to="/devices" replace />

  const manual = manuals.data?.find((m) => m.manualId === manualId)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">เลือกอาการที่พบ</h1>
        <p className="text-sm text-ink-soft">
          รุ่น: {manual ? `${manual.brand} ${manualTitle(manual)}` : manualId}
          {modelSelection === 'unknown' && ' (ไม่ทราบรุ่น เลือกรุ่นใกล้เคียง)'} ·{' '}
          <Link to={manual ? `/devices?category=${encodeURIComponent(manual.deviceCategory)}` : '/devices'} className={LINK_CLASSES}>
            เปลี่ยนรุ่น
          </Link>
        </p>
        <p className="text-ink-soft">
          พิมพ์อาการที่พบให้ระบบช่วยหา ระบบจะถามทีละข้อตามคู่มือของเครื่องนั้น หรือ{' '}
          <Link to={symptomsPath(manualId, modelSelection, 'all')} className={LINK_CLASSES}>
            ดูอาการทั้งหมด
          </Link>
        </p>
      </div>

      {isSlow && <SlowServerNotice />}

      <SymptomSearchForm value={query} onChange={setQuery} onSubmit={handleSearch} isSearching={search.isPending} disabled={isStarting} />

      <div aria-live="polite" className="space-y-4">
        {search.isError && <SearchErrorNotice error={search.error} />}

        {search.isSuccess && <SymptomSearchResults result={search.data} startingId={startingId} isStarting={isStarting} onSelect={(graphId) => start(graphId, { query: search.data.query, manualId, modelSelection })} />}
      </div>

      {startError && <ErrorNotice error={startError} />}

      <p className="text-sm text-ink-soft">
        ไม่เจออาการที่ตรง?{' '}
        <Link to={symptomsPath(manualId, modelSelection, 'all')} className={LINK_CLASSES}>
          ดูอาการทั้งหมด
        </Link>
      </p>
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
