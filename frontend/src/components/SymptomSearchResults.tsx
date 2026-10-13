import type { SymptomSearchResponse } from '../api/types'
import { SymptomRow } from './SymptomRow'
import { Notice } from './ui/Notice'

interface SymptomSearchResultsProps {
  result: SymptomSearchResponse
  startingId: string | null
  isStarting: boolean
  onSelect: (graphId: string) => void
}

export function SymptomSearchResults({ result, startingId, isStarting, onSelect }: SymptomSearchResultsProps) {
  if (result.matches.length === 0) {
    return (
      <Notice tone="info" title="ไม่พบอาการที่ใกล้เคียงกับที่พิมพ์">
        ระบบไม่เดาอาการให้ ลองพิมพ์ใหม่ให้ละเอียดขึ้น หรือเลือกจากรายการอาการด้านล่าง ถ้ายังไม่มีอาการที่ตรงกับที่พบ แนะนำให้ติดต่อศูนย์บริการ Samsung
      </Notice>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">อาการที่ใกล้เคียงกับที่พิมพ์</h2>
      <p className="text-sm text-ink-soft">ระบบเสนอให้เลือก ไม่ได้ตัดสินแทน คะแนนความคล้ายบอกแค่ว่าข้อความใกล้กันแค่ไหน ไม่ใช่โอกาสที่จะถูกต้อง ถ้าไม่มีข้อไหนตรง เลือกจากรายการด้านล่างได้</p>

      <ul className="border-t border-line">
        {result.matches.map((match) => (
          <SymptomRow key={match.graphId} summary={match} score={match.score} matchedText={match.matchedText} isStarting={isStarting && startingId === match.graphId} disabled={isStarting && startingId !== match.graphId} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  )
}
