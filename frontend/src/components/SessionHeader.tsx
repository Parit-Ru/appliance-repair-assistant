import type { FlowSummary } from '../api/types'
import { formatScore } from '../lib/textInput'
import { symptomName } from '../lib/symptoms'
import { Button } from './ui/Button'

interface SessionHeaderProps {
  summary: FlowSummary | undefined
  modelName?: string
  confidence: number | null | undefined
  canAbandon: boolean
  isAbandoning: boolean
  onAbandon: () => void
}

export function SessionHeader({ summary, modelName, confidence, canAbandon, isAbandoning, onAbandon }: SessionHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{summary ? symptomName(summary) : 'ตรวจอาการ'}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {summary && (
            <>
              {summary.brand} <code className="font-mono">{modelName ?? summary.modelPattern}</code>
            </>
          )}
        </p>
        {canAbandon && (
          <Button variant="text" onClick={onAbandon} isLoading={isAbandoning}>
            ยกเลิกการตรวจ
          </Button>
        )}
      </div>
      {confidence != null && (
        <p className="text-sm text-ink-faint">
          คะแนนความคล้ายกับที่พิมพ์ค้นหา <span className="font-mono">{formatScore(confidence)}</span> (แสดงเป็นข้อมูลประกอบเท่านั้น ขั้นตอนถัดไปตัดสินตามคู่มือ)
        </p>
      )}
    </div>
  )
}
