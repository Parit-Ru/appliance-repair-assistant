import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ExecutionAction } from '../api/types'
import { useAbandonSession, useFlows, useManuals, useSession, useStartSession, useSubmitAction, useSubmitOutcome } from '../api/queries'
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
  const flows = useFlows()
  const submit = useSubmitAction(sessionId)
  const saveOutcome = useSubmitOutcome(sessionId)
  const abandon = useAbandonSession()
  const restart = useStartSession()
  const manuals = useManuals()
  const location = useLocation()
  const modelSelection = modelSelectionFromState(location.state)
  const summary = flows.data?.find((flow) => flow.flowId === session.data?.flowId)
  const otherSymptomPath = otherSymptomsPath(summary?.manualId, modelSelection)

  const [trail, setTrail] = useState<TrailEntry[]>([])
  const isSendingRef = useRef(false)
  const isSavingOutcomeRef = useRef(false)
  const stepRef = useRef<HTMLDivElement>(null)

  function handleAction(action: ExecutionAction) {
    if (isSendingRef.current || session.data === undefined) return
    isSendingRef.current = true
    const stateBefore = session.data.state

    submit.mutate(action, {
      onSuccess: () => setTrail((previous) => [...previous, toTrailEntry(stateBefore, action)]),
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

  function handleRestart(flowId: string) {
    restart.mutate(
      { flowId, manualId: summary?.manualId, modelSelection },
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

  const { state, flowId, equipment, confidence, outcome: savedOutcome, displayText } = session.data
  const canRephrase = !state.safetyCritical && !state.requiresSafetyConfirmation && !state.isTerminal
  const rephrased = canRephrase && displayText ? displayText : null
  const shownState = rephrased === null ? state : { ...state, text: rephrased }
  const manual = manuals.data?.find((m) => m.manualId === summary?.manualId)
  const modelName = manual && manualTitle(manual)
  const manualLabel = summary && `${summary.brand} ${modelName ?? summary.modelPattern}`
  const actionError = submit.error ?? restart.error

  // ส่วนที่แสดงเฉพาะตอนถึงสถานะสิ้นสุด (StepView เลือกเองว่าจะแสดงหรือไม่)
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
      onRestart={() => handleRestart(flowId)}
      isRestarting={restart.isPending}/>
  )

  return (
    <div className="space-y-6">
      <SessionHeader summary={summary} modelName={modelName} confidence={confidence} canAbandon={!state.isTerminal} isAbandoning={abandon.isPending} onAbandon={handleAbandon} />

      <EquipmentPanel items={equipment} deviceCategory={summary?.deviceCategory} />

      {modelSelection === 'unknown' && (
        <Notice tone="info" title="คุณเลือกรุ่นที่ใกล้เคียง ขั้นตอนอาจไม่ตรงกับเครื่อง" />
      )}

      {slowNotice}
      {actionError && <ErrorNotice error={actionError} onRetry={handleRefresh} reloadLabel="ดึงขั้นตอนล่าสุด" />}

      <PathRail entries={trail} current={state}>
        <div ref={stepRef}>
          <StepView
            key={state.stateId}
            state={shownState}
            onAction={handleAction}
            isPending={submit.isPending}
            manualLabel={manualLabel}
            outcomeForm={outcomeForm}
            outcomeActions={outcomeActions}/>
          {rephrased !== null && <RephraseNote original={state.text} />}
        </div>
      </PathRail>
    </div>
  )
}
