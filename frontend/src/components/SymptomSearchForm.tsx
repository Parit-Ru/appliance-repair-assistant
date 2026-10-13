import { useId } from 'react'
import type { FormEvent } from 'react'
import { MAX_QUERY_LENGTH, checkQuery } from '../lib/search'
import { Button } from './ui/Button'

interface SymptomSearchFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isSearching: boolean
  disabled: boolean
}

export function SymptomSearchForm({ value, onChange, onSubmit, isSearching, disabled }: SymptomSearchFormProps) {
  const inputId = useId()
  const canSearch = checkQuery(value) === 'ok'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSearch && !disabled && !isSearching) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor={inputId} className="block font-semibold">
        พิมพ์อาการที่พบ
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={inputId} type="text" value={value} onChange={(event) => onChange(event.target.value)} maxLength={MAX_QUERY_LENGTH} placeholder="เช่น แอร์ไม่เย็น มีน้ำหยด รีโมทกดไม่ติด" autoComplete="off" disabled={disabled} className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-panel px-4 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50" />
        <Button type="submit" variant="primary" isLoading={isSearching} disabled={!canSearch || disabled}>
          ค้นหา
        </Button>
      </div>
    </form>
  )
}
