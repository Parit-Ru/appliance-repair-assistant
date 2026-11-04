import type { AdminFlowDetail, AdminFlowState } from '../../../api/types'
import { pathLines, stateTypeLabel } from '../../../lib/draftView'
import { adminStateText, stateEdgeTexts, toPathFlow } from '../../../lib/flowView'
import { Icon } from '../../ui/Icon'

function StateRow({ state, activeCount }: { state: AdminFlowState; activeCount: number }) {
  const edges = stateEdgeTexts(state)

  return (
    <li className="space-y-2 border-t border-line py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-ink">{state.state_id}</span>
        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">{stateTypeLabel(state.type)}</span>
        {state.safety_critical && (
          <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 text-xs font-semibold text-danger">
            <Icon name="warning" className="h-3.5 w-3.5" />
            ต้องยืนยันความปลอดภัย
          </span>
        )}
        {activeCount > 0 && <span className="text-xs text-accent">มีผู้ใช้อยู่ที่ขั้นตอนนี้ {activeCount} คน</span>}
      </div>
      <p className="whitespace-pre-wrap break-words text-ink">{adminStateText(state) || '(ไม่มีข้อความ)'}</p>
      {state.safety_critical && state.safety_warning && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-ink">
          <span className="font-semibold text-danger">คำเตือนที่ผู้ใช้ต้องยืนยัน:</span> {state.safety_warning}
        </p>
      )}
      {state.type === 'input' && (
        <p className="text-xs text-ink-faint">
          ชนิดข้อมูล {state.input_type ?? '-'} · เก็บเป็น {state.store_as ?? '-'}
          {state.pattern ? ` · รูปแบบ ${state.pattern}` : ''}
        </p>
      )}
      {edges.length > 0 && <p className="text-xs text-ink-soft">{edges.join(' · ')}</p>}
      {state.author_note && (
        <p className="rounded-lg border border-line bg-canvas p-2 text-xs text-ink-soft">
          <span className="font-semibold">หมายเหตุที่มา (ผู้พัฒนาเพิ่ม ไม่ได้มาจากคู่มือ):</span> {state.author_note}
        </p>
      )}
    </li>
  )
}

export function FlowStructure({ detail }: { detail: AdminFlowDetail }) {
  const lines = pathLines(toPathFlow(detail))

  return (
    <div className="space-y-6">
      <section aria-label="เส้นทาง" className="space-y-1">
        <h3 className="text-sm font-semibold">เส้นทาง (▶ = จุดเริ่ม · ⚠ = ต้องยืนยันความปลอดภัย)</h3>
        <ol className="space-y-0.5 rounded-lg border border-line bg-canvas p-3 font-mono text-xs">
          {lines.map((line) => (
            <li key={line.stateId} className={line.unreachable ? 'text-danger' : 'text-ink-soft'}>
              {line.text}
              {line.unreachable && ' (เดินถึงไม่ได้)'}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="ขั้นตอนทั้งหมด">
        <h3 className="text-sm font-semibold">ขั้นตอนทั้งหมด ({detail.flow.states.length})</h3>
        <ol>
          {detail.flow.states.map((state) => (
            <StateRow key={state.state_id} state={state} activeCount={detail.usage.activeByState[state.state_id] ?? 0} />
          ))}
        </ol>
      </section>
    </div>
  )
}
