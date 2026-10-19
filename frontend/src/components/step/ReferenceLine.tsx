import { useState } from 'react'
import type { NodeReference } from '../../api/types'
import { Button } from '../ui/Button'

interface ReferenceLineProps {
  reference: NodeReference
  manualLabel?: string
}

/** "หน้า 12" หรือ "หน้า 12–14" */
function formatPages(pageRange: [number, number]): string {
  const [first, last] = pageRange
  if (first === last) return `หน้า ${first}`
  return `หน้า ${first}–${last}`
}

/** บรรทัดที่มาของขั้นตอน: ชื่อคู่มือ (ถ้ารู้) ไม่งั้นใช้ชื่อไฟล์ต้นฉบับ + ช่วงหน้า */
function formatSourceLine(reference: NodeReference, manualLabel?: string): string {
  const manual = manualLabel === undefined ? reference.source : `คู่มือ ${manualLabel}`
  return `ที่มาของขั้นตอนนี้: ${manual} ${formatPages(reference.pageRange)}`
}

export function ReferenceLine({ reference, manualLabel }: ReferenceLineProps) {
  const [isCodeShown, setIsCodeShown] = useState(false)

  return (
    <div className="mt-5 border-t border-line pt-3 text-sm text-ink-faint">
      <p>{formatSourceLine(reference, manualLabel)}</p>

      <Button variant="text" aria-expanded={isCodeShown} onClick={() => setIsCodeShown(!isCodeShown)}>
        {isCodeShown ? 'ซ่อนรหัสเอกสาร' : 'ดูรหัสเอกสาร'}
      </Button>

      {isCodeShown && <p className="mt-1 break-all font-mono text-xs">{reference.source}</p>}
    </div>
  )
}
