import type { SymptomSearchResponse } from '../api/types'
import { SymptomRow } from './SymptomRow'
import { Notice } from './ui/Notice'

interface SymptomSearchResultsProps {
  result: SymptomSearchResponse
  startingId: string | null
  isStarting: boolean
  onSelect: (flowId: string) => void
  /** ตัวหาชื่อรุ่นของแต่ละอาการ ใส่เมื่อค้นข้ามหลายรุ่น (ไม่ใส่ = ไม่แสดงรุ่นในแถว) */
  modelLabelFor?: (flowId: string) => string | undefined
}

export function SymptomSearchResults({ result, startingId, isStarting, onSelect, modelLabelFor }: SymptomSearchResultsProps) {
  if (result.matches.length === 0) {
    return (
      <Notice tone="info" title="ไม่พบอาการที่ใกล้เคียงกับที่พิมพ์">
        ระบบไม่เดาอาการให้ ลองพิมพ์ใหม่ให้ละเอียดขึ้น หรือเลือกจากหน้า "อาการทั้งหมด" ถ้ายังไม่มีอาการที่ตรงกับที่พบ แนะนำให้ติดต่อศูนย์บริการ Samsung
      </Notice>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">อาการที่ใกล้เคียงกับที่พิมพ์</h2>
      <p className="text-sm text-ink-soft">ระบบเสนอให้เลือก ไม่ได้ตัดสินแทน คะแนนความคล้ายบอกแค่ว่าข้อความใกล้กันแค่ไหน ไม่ใช่โอกาสที่จะถูกต้อง ถ้าไม่มีข้อไหนตรง เลือกจากหน้า "อาการทั้งหมด" ได้</p>

      <ul className="border-t border-line">
        {result.matches.map((match) => (
          <SymptomRow key={match.flowId} summary={match} score={match.score} matchedText={match.matchedText} modelLabel={modelLabelFor?.(match.flowId)} isStarting={isStarting && startingId === match.flowId} disabled={isStarting && startingId !== match.flowId} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  )
}
