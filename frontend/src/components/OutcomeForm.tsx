import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { describeError } from '../lib/errors'
import { MAX_OUTCOME_LENGTH, checkText, formatCounter } from '../lib/textInput'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

interface OutcomeFormProps {
  savedText: string | null | undefined
  onSubmit: (text: string) => void
  isSending: boolean
  error: Error | null
  onRefresh: () => void
}

export const TEXTAREA_CLASSES = 'w-full resize-y rounded-lg border border-line bg-canvas px-4 py-3 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

export function OutcomeForm({ savedText, onSubmit, isSending, error, onRefresh }: OutcomeFormProps) {
  const textareaId = useId()
  const hintId = useId()
  const counterId = useId()

  const [value, setValue] = useState('')
  const isSaved = typeof savedText === 'string'

  const wasSavedAtMount = useRef(isSaved)
  const savedHeadingRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (isSaved && !wasSavedAtMount.current) savedHeadingRef.current?.focus()
  }, [isSaved])

  if (isSaved) {
    return (
      <section className="space-y-2">
        <p ref={savedHeadingRef} tabIndex={-1} className="font-semibold outline-none">
          บันทึกผลแล้ว
        </p>
        <p className="whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas px-4 py-3 text-ink">{savedText}</p>
      </section>
    )
  }

  const canSubmit = checkText(value, MAX_OUTCOME_LENGTH) === 'ok' && !isSending
  const described = error === null ? null : describeError(error)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit(value.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={textareaId} className="block font-semibold">
          ผลเป็นอย่างไรบ้าง? <span className="font-normal text-ink-faint">(ไม่บังคับ)</span>
        </label>
        <p id={hintId} className="text-sm text-ink-soft">
          ไม่ต้องใส่ข้อมูลส่วนตัว เช่น ชื่อ เบอร์โทร หรือที่อยู่ · บันทึกได้ครั้งเดียว แก้ไขภายหลังไม่ได้
        </p>
      </div>

      <div className="space-y-1">
        <textarea id={textareaId} value={value} onChange={(event) => setValue(event.target.value)} maxLength={MAX_OUTCOME_LENGTH} rows={4} placeholder="เช่น ทำตามขั้นตอนแล้วเครื่องกลับมาทำงานปกติ หรือยังไม่หาย" disabled={isSending} aria-describedby={`${hintId} ${counterId}`} className={TEXTAREA_CLASSES} />
        <p id={counterId} className="text-right text-xs text-ink-faint">
          {formatCounter(value, MAX_OUTCOME_LENGTH)}
        </p>
      </div>

      {described !== null && (
        <div role="alert">
          <Notice tone="danger" title={described.title}>
            <p>{described.detail}</p>
            {described.recovery === 'reload-session' && (
              <Button variant="secondary" className="mt-3" onClick={onRefresh}>
                ดึงข้อมูลล่าสุด
              </Button>
            )}
          </Notice>
        </div>
      )}

      <Button type="submit" variant="secondary" className="w-full sm:w-auto" isLoading={isSending} disabled={!canSubmit}>
        บันทึกผล
      </Button>
    </form>
  )
}
