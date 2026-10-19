import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { HistoryFeedback } from '../../api/types'
import { MAX_FEEDBACK_COMMENT_LENGTH, checkComment, formatCommentCounter, isSameFeedback, toFeedback } from '../../lib/textInput'
import { Button } from '../ui/Button'
import { ErrorNotice } from '../ErrorNotice'

interface FeedbackButtonsProps {
  /** ค่าที่บันทึกไว้แล้ว (ถ้ามี) ฟอร์มขึ้นมาพร้อมค่านี้ และส่งซ้ำ = แก้ค่าเดิม */
  saved: HistoryFeedback | null
  onSubmit: (feedback: HistoryFeedback) => void
  isSending: boolean
  error: Error | null
}

const TEXTAREA_CLASSES =
  'w-full resize-y rounded-lg border border-line bg-canvas px-4 py-3 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

/**
 * ให้คะแนนผลการตรวจย้อนหลัง: 👍/👎 (บังคับเลือก) + ข้อความ (ไม่บังคับ ไม่เกิน 500 ตัวอักษร ว่าง = ไม่ส่ง)
 * ไม่มีผลต่อขั้นตอนหรือการตัดสินใดๆ ของระบบ เป็นข้อมูลเก็บไว้ประเมินเท่านั้น
 */
export function FeedbackButtons({ saved, onSubmit, isSending, error }: FeedbackButtonsProps) {
  const textareaId = useId()
  const hintId = useId()
  const counterId = useId()

  const [helpful, setHelpful] = useState<boolean | null>(saved?.helpful ?? null)
  const [comment, setComment] = useState(saved?.comment ?? '')

  const isSaved = isSameFeedback(saved, helpful, comment)
  const canSubmit = helpful !== null && checkComment(comment) === 'ok' && !isSending && !isSaved

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || helpful === null) return
    onSubmit(toFeedback(helpful, comment))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <p className="font-semibold">ให้คะแนนผลการตรวจนี้</p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="ให้คะแนนผลการตรวจนี้">
        <Button variant={helpful === true ? 'primary' : 'secondary'} aria-pressed={helpful === true} disabled={isSending} onClick={() => setHelpful(true)}>
          <span aria-hidden>👍</span> ช่วยได้
        </Button>
        <Button variant={helpful === false ? 'primary' : 'secondary'} aria-pressed={helpful === false} disabled={isSending} onClick={() => setHelpful(false)}>
          <span aria-hidden>👎</span> ไม่ช่วย
        </Button>
      </div>

      <div className="space-y-1">
        <label htmlFor={textareaId} className="block text-sm text-ink-soft">
          ข้อความเพิ่มเติม <span className="text-ink-faint">(ไม่บังคับ)</span>
        </label>
        <p id={hintId} className="text-sm text-ink-faint">
          ไม่ต้องใส่ข้อมูลส่วนตัว เช่น ชื่อ เบอร์โทร หรือที่อยู่
        </p>
        <textarea
          id={textareaId}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={MAX_FEEDBACK_COMMENT_LENGTH}
          rows={4}
          disabled={isSending}
          aria-describedby={`${hintId} ${counterId}`}
          className={TEXTAREA_CLASSES}
        />
        <p id={counterId} className="text-right text-xs text-ink-faint">
          {formatCommentCounter(comment)}
        </p>
      </div>

      {error !== null && <ErrorNotice error={error} />}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={isSending} disabled={!canSubmit}>
          บันทึก
        </Button>
        {isSaved && (
          <span role="status" className="text-sm text-success">
            บันทึกแล้ว
          </span>
        )}
      </div>
    </form>
  )
}
