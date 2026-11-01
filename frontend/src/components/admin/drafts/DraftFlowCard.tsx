import type { DraftDetail, DraftFlow, DraftState } from '../../../api/types'
import { issuesForFlow, issuesForState, stateText, stateTypeLabel, pageTextOf, pathLines } from '../../../lib/draftView'
import { Icon } from '../../ui/Icon'

interface DraftFlowCardProps {
  flow: DraftFlow
  draft: Pick<DraftDetail, 'pages' | 'validation'>
}

function pageRangeOf(flow: DraftFlow): string {
  const pages = flow.states.map((n) => n.source_page).filter((p): p is number => typeof p === 'number')
  if (pages.length === 0) return 'ไม่มีเลขหน้า'
  const min = Math.min(...pages)
  const max = Math.max(...pages)
  return min === max ? `หน้า ${min}` : `หน้า ${min}–${max}`
}

function StateRow({ state, flowId, draft }: { state: DraftState; flowId: string; draft: DraftFlowCardProps['draft'] }) {
  const issues = issuesForState(draft.validation, flowId, state.state_id)
  const source = pageTextOf(draft, state.source_page)
  const edges = [
    state.on_yes && `ใช่ → ${state.on_yes}`,
    state.on_no && `ไม่ใช่ → ${state.on_no}`,
    state.next && `ถัดไป → ${state.next}`,
    state.on_invalid && `ตอบไม่ผ่าน → ${state.on_invalid}`,
    state.outcome_kind && `ผล: ${state.outcome_kind}`,
  ].filter(Boolean)

  return (
    <li className="grid gap-3 border-t border-line py-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-ink">{state.state_id}</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">{stateTypeLabel(state.type)}</span>
          {state.safety_critical && (
            <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 text-xs font-semibold text-danger">
              <Icon name="warning" className="h-3.5 w-3.5" />
              ต้องยืนยันความปลอดภัย
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-ink">{stateText(state) || '(ไม่มีข้อความ)'}</p>
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
        {[...issues.errors, ...issues.warnings].map((issue, index) => (
          <p key={`${issue.code}-${index}`} className={`text-sm ${issues.errors.includes(issue) ? 'text-danger' : 'text-accent'}`}>
            [{issue.code}] {issue.message}
          </p>
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-ink-faint">{state.source_page !== undefined ? `หน้าต้นฉบับ ${state.source_page}` : 'ไม่ได้ระบุเลขหน้าต้นฉบับ'}</p>
        {source !== undefined ? (
          <div className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-2 text-xs text-ink-soft" tabIndex={0} aria-label={`ข้อความหน้าต้นฉบับ ${state.source_page}`}>
            {source}
          </div>
        ) : (
          <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger">ไม่พบข้อความของหน้าที่อ้าง — ตรวจเทียบไม่ได้</p>
        )}
      </div>
    </li>
  )
}

export function DraftFlowCard({ flow, draft }: DraftFlowCardProps) {
  const flowIssues = issuesForFlow(draft.validation, flow.flow_id)
  const lines = pathLines(flow)

  return (
    <article aria-label={flow.entry_symptom_th ?? flow.entry_symptom} className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold">{flow.entry_symptom_th ?? flow.entry_symptom}</h3>
        <p className="text-sm text-ink-soft">{flow.entry_symptom}</p>
        <p className="text-xs text-ink-faint">
          <span className="font-mono">{flow.flow_id}</span> · {pageRangeOf(flow)} · {flow.states.length} สถานะ
          {flow.severity ? ` · ความรุนแรง ${flow.severity}` : ''}
          {flow.difficulty ? ` · ความยาก ${flow.difficulty}` : ''}
        </p>
        {flow.entry_symptom_aliases && flow.entry_symptom_aliases.length > 0 && (
          <p className="text-xs text-ink-faint">คำที่ผู้ใช้อาจพิมพ์: {flow.entry_symptom_aliases.join(' · ')}</p>
        )}
      </header>

      {[...flowIssues.errors, ...flowIssues.warnings].map((issue, index) => (
        <p key={`${issue.code}-${index}`} className={`text-sm ${flowIssues.errors.includes(issue) ? 'text-danger' : 'text-accent'}`}>
          [{issue.code}] {issue.message}
        </p>
      ))}

      <section aria-label="เส้นทาง" className="space-y-1">
        <h4 className="text-sm font-semibold">เส้นทาง (▶ = จุดเริ่ม · ⚠ = ต้องยืนยันความปลอดภัย)</h4>
        <ol className="space-y-0.5 rounded-lg border border-line bg-canvas p-3 font-mono text-xs">
          {lines.map((line) => (
            <li key={line.stateId} className={line.unreachable ? 'text-danger' : 'text-ink-soft'}>
              {line.text}
              {line.unreachable && ' (เดินถึงไม่ได้)'}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="สถานะทั้งหมด">
        <h4 className="text-sm font-semibold">ทุกสถานะ เทียบกับหน้าต้นฉบับ</h4>
        <ol>
          {flow.states.map((state) => (
            <StateRow key={state.state_id} state={state} flowId={flow.flow_id} draft={draft} />
          ))}
        </ol>
      </section>
    </article>
  )
}
