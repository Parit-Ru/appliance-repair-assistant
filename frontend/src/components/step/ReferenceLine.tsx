import { useState } from 'react'
import type { NodeReference } from '../../api/types'
import { formatSourceLine } from '../../lib/reference'
import { Button } from '../ui/Button'

interface ReferenceLineProps {
  reference: NodeReference
  manualLabel?: string
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
