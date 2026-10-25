import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { TraversalAction } from '../api/types'
import { useAbandonSession, useGraphs, useManuals, useSession, useStartSession, useSubmitAction, useSubmitOutcome } from '../api/queries'
import { EquipmentPanel } from '../components/EquipmentPanel'
import { OutcomeForm } from '../components/OutcomeForm'
import { RephraseNote } from '../components/RephraseNote'
import { ErrorNotice } from '../components/ErrorNotice'
import { SessionHeader } from '../components/SessionHeader'
import { SlowServerNotice } from '../components/SlowServerNotice'
import { PathRail } from '../components/step/PathRail'
import { StepView } from '../components/step/StepView'
import { TerminalActions } from '../components/TerminalActions'
import { Notice } from '../components/ui/Notice'
import { LoadingText } from '../components/LoadingText'
import { modelSelectionFromState, otherSymptomsPath } from '../lib/modelSelection'
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
  // รีเฟรชหน้าแล้วยังอยู่ แต่เปิดลิงก์ session ในแท็บใหม่ state จะหาย
  // undefined = ไม่ได้ผ่านหน้าเลือกรุ่น (เริ่มจากรายการทุกรุ่น) หรือไม่ทราบ — ห้ามเติมเป็น 'selected' เพราะจะบันทึกผิด
  const location = useLocation()
  const modelSelection = modelSelectionFromState(location.state)
  const summary = graphs.data?.find((graph) => graph.graphId === session.data?.graphId)
  const otherSymptomPath = otherSymptomsPath(summary?.manualId, modelSelection)

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
    // พาค่า modelSelection เดิมไปตามเดิม: undefined ก็ยังเป็น undefined (ห้ามเปลี่ยนเป็น 'selected')
    restart.mutate(
      { graphId, manualId: summary?.manualId, modelSelection },
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
        <LoadingText>กำลังโหลดขั้นตอน</LoadingText>
      </div>
    )
  }

  if (session.isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">ตรวจอาการ</h1>
        <ErrorNotice error={session.error} onRetry={handleRefresh} reloadLabel="ดึงขั้นตอนล่าสุด" />
      </div>
    )
  }

  const { node, graphId, equipment, confidence, outcome: savedOutcome, displayText } = session.data
  const canRephrase = !node.safetyCritical && !node.requiresSafetyConfirmation && !node.isTerminal
  const rephrased = canRephrase && displayText ? displayText : null
  const shownNode = rephrased === null ? node : { ...node, text: rephrased }
  const manual = manuals.data?.find((m) => m.manualId === summary?.manualId)
  const modelName = manual && manualTitle(manual)
  const manualLabel = summary && `${summary.brand} ${modelName ?? summary.modelPattern}`
  const actionError = submit.error ?? restart.error

  // ส่วนที่แสดงเฉพาะตอนถึงโหนดสิ้นสุด (StepView เลือกเองว่าจะแสดงหรือไม่)
  const outcomeForm = (
    <OutcomeForm
      savedText={savedOutcome}
      onSubmit={handleOutcome}
      isSending={saveOutcome.isPending}
      error={saveOutcome.error}
      onRefresh={handleRefresh}/>
  )
  const outcomeActions = (
    <TerminalActions
      onOtherSymptom={() => navigate(otherSymptomPath)}
      onRestart={() => handleRestart(graphId)}
      isRestarting={restart.isPending}/>
  )

  return (
    <div className="space-y-6">
      <SessionHeader summary={summary} modelName={modelName} confidence={confidence} canAbandon={!node.isTerminal} isAbandoning={abandon.isPending} onAbandon={handleAbandon} />

      <EquipmentPanel items={equipment} deviceCategory={summary?.deviceCategory} />

      {modelSelection === 'unknown' && (
        <Notice tone="info" title="คุณเลือกรุ่นที่ใกล้เคียง ขั้นตอนอาจไม่ตรงกับเครื่อง" />
      )}

      {slowNotice}
      {actionError && <ErrorNotice error={actionError} onRetry={handleRefresh} reloadLabel="ดึงขั้นตอนล่าสุด" />}

      <PathRail entries={trail} current={node}>
        <div ref={stepRef}>
          <StepView
            key={node.nodeId}
            node={shownNode}
            onAction={handleAction}
            isPending={submit.isPending}
            manualLabel={manualLabel}
            outcomeForm={outcomeForm}
            outcomeActions={outcomeActions}/>
          {rephrased !== null && <RephraseNote original={node.text} />}
        </div>
      </PathRail>
    </div>
  )
}
