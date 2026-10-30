import type { DraftDetail, DraftGraph, DraftNode } from '../../../api/types'
import { issuesForGraph, issuesForNode, nodeText, nodeTypeLabel, pageTextOf, pathLines } from '../../../lib/draftView'
import { Icon } from '../../ui/Icon'

interface DraftGraphCardProps {
  graph: DraftGraph
  draft: Pick<DraftDetail, 'pages' | 'validation'>
}

function pageRangeOf(graph: DraftGraph): string {
  const pages = graph.nodes.map((n) => n.source_page).filter((p): p is number => typeof p === 'number')
  if (pages.length === 0) return 'ไม่มีเลขหน้า'
  const min = Math.min(...pages)
  const max = Math.max(...pages)
  return min === max ? `หน้า ${min}` : `หน้า ${min}–${max}`
}

function NodeRow({ node, graphId, draft }: { node: DraftNode; graphId: string; draft: DraftGraphCardProps['draft'] }) {
  const issues = issuesForNode(draft.validation, graphId, node.node_id)
  const source = pageTextOf(draft, node.source_page)
  const edges = [
    node.on_yes && `ใช่ → ${node.on_yes}`,
    node.on_no && `ไม่ใช่ → ${node.on_no}`,
    node.next && `ถัดไป → ${node.next}`,
    node.on_invalid && `ตอบไม่ผ่าน → ${node.on_invalid}`,
    node.outcome_kind && `ผล: ${node.outcome_kind}`,
  ].filter(Boolean)

  return (
    <li className="grid gap-3 border-t border-line py-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-ink">{node.node_id}</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">{nodeTypeLabel(node.type)}</span>
          {node.safety_critical && (
            <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 px-2 py-0.5 text-xs font-semibold text-danger">
              <Icon name="warning" className="h-3.5 w-3.5" />
              ต้องยืนยันความปลอดภัย
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-ink">{nodeText(node) || '(ไม่มีข้อความ)'}</p>
        {node.safety_critical && node.safety_warning && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-ink">
            <span className="font-semibold text-danger">คำเตือนที่ผู้ใช้ต้องยืนยัน:</span> {node.safety_warning}
          </p>
        )}
        {node.type === 'input' && (
          <p className="text-xs text-ink-faint">
            ชนิดข้อมูล {node.input_type ?? '-'} · เก็บเป็น {node.store_as ?? '-'}
            {node.pattern ? ` · รูปแบบ ${node.pattern}` : ''}
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
        <p className="text-xs text-ink-faint">{node.source_page !== undefined ? `หน้าต้นฉบับ ${node.source_page}` : 'ไม่ได้ระบุเลขหน้าต้นฉบับ'}</p>
        {source !== undefined ? (
          <div className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-2 text-xs text-ink-soft" tabIndex={0} aria-label={`ข้อความหน้าต้นฉบับ ${node.source_page}`}>
            {source}
          </div>
        ) : (
          <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger">ไม่พบข้อความของหน้าที่อ้าง — ตรวจเทียบไม่ได้</p>
        )}
      </div>
    </li>
  )
}

export function DraftGraphCard({ graph, draft }: DraftGraphCardProps) {
  const graphIssues = issuesForGraph(draft.validation, graph.graph_id)
  const lines = pathLines(graph)

  return (
    <article aria-label={graph.entry_symptom_th ?? graph.entry_symptom} className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold">{graph.entry_symptom_th ?? graph.entry_symptom}</h3>
        <p className="text-sm text-ink-soft">{graph.entry_symptom}</p>
        <p className="text-xs text-ink-faint">
          <span className="font-mono">{graph.graph_id}</span> · {pageRangeOf(graph)} · {graph.nodes.length} โหนด
          {graph.severity ? ` · ความรุนแรง ${graph.severity}` : ''}
          {graph.difficulty ? ` · ความยาก ${graph.difficulty}` : ''}
        </p>
        {graph.entry_symptom_aliases && graph.entry_symptom_aliases.length > 0 && (
          <p className="text-xs text-ink-faint">คำที่ผู้ใช้อาจพิมพ์: {graph.entry_symptom_aliases.join(' · ')}</p>
        )}
      </header>

      {[...graphIssues.errors, ...graphIssues.warnings].map((issue, index) => (
        <p key={`${issue.code}-${index}`} className={`text-sm ${graphIssues.errors.includes(issue) ? 'text-danger' : 'text-accent'}`}>
          [{issue.code}] {issue.message}
        </p>
      ))}

      <section aria-label="เส้นทาง" className="space-y-1">
        <h4 className="text-sm font-semibold">เส้นทาง (▶ = จุดเริ่ม · ⚠ = ต้องยืนยันความปลอดภัย)</h4>
        <ol className="space-y-0.5 rounded-lg border border-line bg-canvas p-3 font-mono text-xs">
          {lines.map((line) => (
            <li key={line.nodeId} className={line.unreachable ? 'text-danger' : 'text-ink-soft'}>
              {line.text}
              {line.unreachable && ' (เดินถึงไม่ได้)'}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="โหนดทั้งหมด">
        <h4 className="text-sm font-semibold">ทุกโหนด เทียบกับหน้าต้นฉบับ</h4>
        <ol>
          {graph.nodes.map((node) => (
            <NodeRow key={node.node_id} node={node} graphId={graph.graph_id} draft={draft} />
          ))}
        </ol>
      </section>
    </article>
  )
}
