import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ModelSelection, TraversalAction } from '../api/types'
import { useAbandonSession, useGraphs, useManuals, useSession, useStartSession, useSubmitAction, useSubmitOutcome } from '../api/queries'
import { EquipmentPanel } from '../components/EquipmentPanel'
import { OutcomeForm } from '../components/OutcomeForm'
import { RephraseNote } from '../components/RephraseNote'
import { SessionErrorNotice } from '../components/SessionErrorNotice'
import { SessionHeader } from '../components/SessionHeader'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { PathRail } from '../components/step/PathRail'
import { StepView } from '../components/step/StepView'
import { TerminalActions } from '../components/TerminalActions'
import { Icon } from '../components/ui/Icon'
import { Notice } from '../components/ui/Notice'
import { symptomsPath } from '../lib/modelSelection'
import { manualTitle } from '../lib/models'
import { toTrailEntry } from '../lib/trail'
import type { TrailEntry } from '../lib/trail'
import { useSlowWait } from '../lib/useSlowWait'

export function SessionPage() {
  const { sessionId = '' } = useParams()
  return <SessionView key={sessionId} sessionId={sessionId} />
}

function SessionView({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const session = useSession(sessionId)
  const graphs = useGraphs()
  const submit = useSubmitAction(sessionId)
  const saveOutcome = useSubmitOutcome(sessionId)
  const abandon = useAbandonSession()
  const restart = useStartSession()
  const manuals = useManuals()

  // รุ่นที่ผู้ใช้ระบุไว้ตอนเริ่ม มากับ navigate state จาก useStartSymptom (ไม่ได้อ่านจากเซิร์ฟเวอร์)
  // รีเฟรชหน้าแล้วยังอยู่ แต่เปิดลิงก์ session ในแท็บใหม่จะกลับเป็น 'selected'
  const location = useLocation()
  const modelSelection: ModelSelection = (location.state as { modelSelection?: ModelSelection } | null)?.modelSelection ?? 'selected'
  const currentSummary = graphs.data?.find((graph) => graph.graphId === session.data?.graphId)
  const otherSymptomPath = currentSummary ? symptomsPath(currentSummary.manualId, modelSelection) : '/devices'

  const [trail, setTrail] = useState<TrailEntry[]>([])
  const isSendingRef = useRef(false)
  const isSavingOutcomeRef = useRef(false)
  const stepRef = useRef<HTMLDivElement>(null)

  function handleAction(action: TraversalAction) {
    if (isSendingRef.current || session.data === undefined) return
    isSendingRef.current = true
    const nodeBefore = session.data.node

    submit.mutate(action, {
      onSuccess: () => setTrail((previous) => [...previous, toTrailEntry(nodeBefore, action)]),
      onSettled: () => {
        isSendingRef.current = false
      },
    })
  }

  function handleOutcome(text: string) {
    if (isSavingOutcomeRef.current) return
    isSavingOutcomeRef.current = true

    saveOutcome.mutate(text, {
      onSettled: () => {
        isSavingOutcomeRef.current = false
      },
    })
  }

  function handleAbandon() {
    abandon.mutate(sessionId, { onSettled: () => navigate(otherSymptomPath) })
  }

  function handleRestart(graphId: string) {
    restart.mutate(
      { graphId, manualId: currentSummary?.manualId, modelSelection },
      {
        onSuccess: (next) => navigate(`/session/${next.sessionId}`, { replace: true, state: { modelSelection } }),
      },
    )
  }

  function handleRefresh() {
    submit.reset()
    restart.reset()
    saveOutcome.reset()
    void session.refetch()
  }

  useEffect(() => {
    if (trail.length === 0 || stepRef.current === null) return
    stepRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    stepRef.current.querySelector<HTMLElement>('h2[tabindex="-1"]')?.focus({ preventScroll: true })
  }, [trail.length])

  const isWaiting = session.isPending || submit.isPending || restart.isPending || saveOutcome.isPending
  const slowNotice = useSlowWait(isWaiting) && <SlowServerNotice />

  if (session.isPending) {
    return (
      <div className="space-y-6">
        {slowNotice}
        <p className="flex items-center gap-2 text-ink-soft">
          <Icon name="spinner" className="h-5 w-5 animate-spin" />
          กำลังโหลดขั้นตอน
        </p>
      </div>
    )
  }

  if (session.isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">ตรวจอาการ</h1>
        <SessionErrorNotice error={session.error} onRefresh={handleRefresh} />
      </div>
    )
  }

  const { node, graphId, equipment, confidence, outcome: savedOutcome, displayText } = session.data
  const canRephrase = !node.safetyCritical && !node.requiresSafetyConfirmation && !node.isTerminal
  const rephrased = canRephrase && displayText ? displayText : null
  const shownNode = rephrased === null ? node : { ...node, text: rephrased }
  const summary = graphs.data?.find((graph) => graph.graphId === graphId)
  const manual = manuals.data?.find((m) => m.manualId === summary?.manualId)
  const modelName = manual && manualTitle(manual)
  const manualLabel = summary && `${summary.brand} ${modelName ?? summary.modelPattern}`
  const actionError = submit.error ?? restart.error

  return (
    <div className="space-y-6">
      <SessionHeader summary={summary} modelName={modelName} confidence={confidence} canAbandon={!node.isTerminal} isAbandoning={abandon.isPending} onAbandon={handleAbandon} />

      <EquipmentPanel items={equipment} deviceCategory={summary?.deviceCategory} />

      {modelSelection === 'unknown' && (
        <Notice tone="info" title="คุณเลือกรุ่นที่ใกล้เคียง ขั้นตอนอาจไม่ตรงกับเครื่อง">
          ถ้าหน้าตาเครื่องหรือปุ่มต่างจากที่คำถามบอก ให้หยุดและติดต่อศูนย์บริการ
        </Notice>
      )}

      {slowNotice}
      {actionError && <SessionErrorNotice error={actionError} onRefresh={handleRefresh} />}

      <PathRail entries={trail} current={node}>
        <div ref={stepRef}>
          <StepView key={node.nodeId} node={shownNode} onAction={handleAction} isPending={submit.isPending} manualLabel={manualLabel} outcomeForm={<OutcomeForm savedText={savedOutcome} onSubmit={handleOutcome} isSending={saveOutcome.isPending} error={saveOutcome.error} onRefresh={handleRefresh} />} outcomeActions={<TerminalActions onOtherSymptom={() => navigate(otherSymptomPath)} onRestart={() => handleRestart(graphId)} isRestarting={restart.isPending} />} />
          {rephrased !== null && <RephraseNote original={node.text} />}
        </div>
      </PathRail>
    </div>
  )
}
