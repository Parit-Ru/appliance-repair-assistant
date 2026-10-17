import { useId, useState } from 'react'
import { useUpdateDraft } from '../../../api/queries'
import type { DraftGraph } from '../../../api/types'
import { HistoryErrorNotice } from '../../history/HistoryErrorNotice'
import { Button } from '../../ui/Button'

interface DraftJsonEditorProps {
  draftId: string
  graphs: DraftGraph[]
}

function format(graphs: DraftGraph[]): string {
  return JSON.stringify(graphs, null, 2)
}

/**
 * แก้แผนผังขั้นตอนเป็น JSON แล้วกด "ตรวจใหม่" → ส่งให้ backend ตรวจรูปแบบ + validator ใหม่ทั้งหมด
 * ผลการตรวจมาจาก backend เท่านั้น (หน้าจอแก้รายงานเองไม่ได้) · JSON ที่พิมพ์ผิดถูกปฏิเสธตั้งแต่หน้าจอ
 * ผู้เรียกใส่ key = เวลาแก้ไขล่าสุดของร่าง เพื่อให้ช่องแก้รีเซ็ตเป็นข้อมูลใหม่หลังบันทึก
 */
export function DraftJsonEditor({ draftId, graphs }: DraftJsonEditorProps) {
  const textareaId = useId()
  const hintId = useId()
  const update = useUpdateDraft(draftId)
  const [text, setText] = useState(() => format(graphs))
  const [localError, setLocalError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleCheck() {
    setSaved(false)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setLocalError(`JSON ไม่ถูกต้อง: ${err instanceof Error ? err.message : 'อ่านไม่ได้'}`)
      return
    }
    if (!Array.isArray(parsed)) {
      setLocalError('ต้องเป็นอาร์เรย์ของแผนผังขั้นตอน [ { … } ]')
      return
    }
    setLocalError(null)
    update.mutate(parsed as DraftGraph[], { onSuccess: () => setSaved(true) })
  }

  const changed = text !== format(graphs)

  return (
    <section aria-label="แก้แผนผังขั้นตอน" className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold">แก้แผนผังขั้นตอน (JSON)</h2>
      <p id={hintId} className="text-sm text-ink-soft">
        แก้ข้อความ ลูกศร หรือด่านความปลอดภัยได้ตรงนี้ แล้วกด "ตรวจใหม่" ระบบจะตรวจทั้งหมดใหม่ — ห้ามเพิ่มฟิลด์ที่ระบบกำหนดเอง (เช่น manual_id, source) ระบบจะปฏิเสธ
      </p>
      <label htmlFor={textareaId} className="sr-only">
        JSON ของแผนผังขั้นตอน
      </label>
      <textarea
        id={textareaId}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setSaved(false)
        }}
        aria-describedby={hintId}
        spellCheck={false}
        rows={16}
        disabled={update.isPending}
        className="w-full rounded-lg border border-line bg-canvas p-3 font-mono text-xs text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      {localError && (
        <p role="alert" className="text-sm text-danger">
          {localError}
        </p>
      )}
      {update.isError && <HistoryErrorNotice error={update.error} />}
      {saved && !update.isPending && (
        <p role="status" className="text-sm text-success">
          ตรวจใหม่แล้ว — ดูผลในรายงานการตรวจด้านบน
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleCheck} isLoading={update.isPending}>
          ตรวจใหม่
        </Button>
        <Button
          variant="secondary"
          disabled={!changed || update.isPending}
          onClick={() => {
            setText(format(graphs))
            setLocalError(null)
          }}
        >
          คืนค่าเดิม
        </Button>
      </div>
    </section>
  )
}
