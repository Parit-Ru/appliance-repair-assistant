import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStartSession } from '../api/queries'
import type { ModelSelection } from '../api/types'

export function useStartSymptom() {
  const startSession = useStartSession()
  const navigate = useNavigate()
  const [startingId, setStartingId] = useState<string | null>(null)


  function start(graphId: string, options: { query?: string; manualId?: string; modelSelection?: ModelSelection } = {}) {
    setStartingId(graphId)
    startSession.mutate(
      { graphId, ...options },
      { onSuccess: (session) => navigate(`/session/${session.sessionId}`, { state: { modelSelection: options.modelSelection } }) },
    )
  }

  return { start, startingId, isStarting: startSession.isPending, error: startSession.error }
}
