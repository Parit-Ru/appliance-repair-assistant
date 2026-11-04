import { useId } from 'react'
import type { AdminFlowState } from '../../../api/types'
import { stateTypeLabel } from '../../../lib/draftView'
import { MAX_STATE_TEXT_LENGTH, textLabelOf } from '../../../lib/flowEditor'
import type { StateDraft } from '../../../lib/flowEditor'
import { stateEdgeTexts } from '../../../lib/flowView'
import { Icon } from '../../ui/Icon'

const AREA_CLASSES = 'min-h-24 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

interface StateEditorCardProps {
  state: AdminFlowState
  draft: StateDraft
  changed: boolean
  problem: string | undefined
  activeCount: number
  disabled: boolean
  onChange: (patch: Partial<StateDraft>) => void
}

/** Only the texts are editable; type, edges, safety flag and input rules are shown read-only */
export function StateEditorCard({ state, draft, changed, problem, activeCount, disabled, onChange }: StateEditorCardProps) {
  const textId = useId()
  const warningId = useId()
  const edges = stateEdgeTexts(state)

  return (
    <li className="space-y-3 border-t border-line py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-ink">{state.state_id}</span>
        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">{stateTypeLabel(state.type)}</span>
        {state.safety_critical && (
          <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 text-xs font-semibold text-danger">
            <Icon name="warning" className="h-3.5 w-3.5" />
            ต้องยืนยันความปลอดภัย
          </span>
        )}
        {changed && <span className="rounded-full border border-accent/40 px-2 py-0.5 text-xs font-semibold text-accent">แก้แล้ว</span>}
        {activeCount > 0 && <span className="text-xs text-accent">มีผู้ใช้อยู่ที่ขั้นตอนนี้ {activeCount} คน</span>}
      </div>

      <div className="space-y-1">
        <label htmlFor={textId} className="block text-sm font-semibold">
          {textLabelOf(state.type)}
        </label>
        <textarea
          id={textId}
          value={draft.text}
          disabled={disabled}
          onChange={(event) => onChange({ text: event.target.value })}
          aria-invalid={problem !== undefined || undefined}
          className={AREA_CLASSES}
        />
        <p className="text-xs text-ink-faint">
          {draft.text.length}/{MAX_STATE_TEXT_LENGTH} ตัวอักษร
        </p>
      </div>

      {state.safety_critical && (
        <div className="space-y-1">
          <label htmlFor={warningId} className="block text-sm font-semibold text-danger">
            คำเตือนที่ผู้ใช้ต้องยืนยันก่อนไปต่อ
          </label>
          <textarea
            id={warningId}
            value={draft.safetyWarning}
            disabled={disabled}
            onChange={(event) => onChange({ safetyWarning: event.target.value })}
            aria-invalid={problem !== undefined || undefined}
            className={AREA_CLASSES}
          />
        </div>
      )}

      {problem !== undefined && <p className="text-sm text-danger">{problem}</p>}

      {edges.length > 0 && <p className="text-xs text-ink-soft">เส้นทาง (แก้ไม่ได้ในหน้านี้): {edges.join(' · ')}</p>}
      {state.author_note && (
        <p className="rounded-lg border border-line bg-canvas p-2 text-xs text-ink-soft">
          <span className="font-semibold">หมายเหตุที่มา (ผู้พัฒนาเพิ่ม ไม่ได้มาจากคู่มือ · แก้ไม่ได้ในหน้านี้):</span> {state.author_note}
        </p>
      )}
    </li>
  )
}
