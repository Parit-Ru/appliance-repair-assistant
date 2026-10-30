import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useIdentity } from '../lib/authContext'
import { getAdminFeedback, getAdminSummary } from './admin'
import { DRAFT_POLL_MS, getDraft, listDrafts, publishDraft, rejectDraft, updateDraft, uploadDraft } from './drafts'
import { deleteHistory, getHistory, listHistory, submitFeedback } from './history'
import { abandonSession, getHealth, getSession, listGraphs, listManuals, searchSymptoms, startSession, submitAction, submitOutcome } from './traversal'
import type { AdminFeedbackParams, DraftDetail, DraftGraph, DraftUploadInput, HistoryFeedback, ModelSelection, SessionResponse, SymptomSearchResponse, TraversalAction } from './types'

const sessionQuery = (sessionId: string, identity = 'guest') =>
  queryOptions({
    queryKey: ['session', identity, sessionId] as const,
    queryFn: () => getSession(sessionId),
  })

const historyDetailQuery = (sessionId: string, identity = 'guest') =>
  queryOptions({
    queryKey: ['history', identity, 'detail', sessionId] as const,
    queryFn: () => getHistory(sessionId),
  })

/** ร่างแผนผังขั้นตอน: ทุก key ขึ้นต้น ['admin', identity, 'drafts'] ไว้ invalidate ทีเดียว */
const adminDraftsQuery = (identity = 'guest') =>
  queryOptions({
    queryKey: ['admin', identity, 'drafts'] as const,
    queryFn: listDrafts,
    refetchInterval: (query) => (query.state.data?.items.some((d) => d.status === 'drafting') ? DRAFT_POLL_MS : false),
  })

const adminDraftQuery = (id: string, identity = 'guest') =>
  queryOptions({
    queryKey: ['admin', identity, 'drafts', id] as const,
    queryFn: () => getDraft(id),
    refetchInterval: (query) => (query.state.data?.status === 'drafting' ? DRAFT_POLL_MS : false),
  })

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: getHealth, staleTime: 30_000 })
}


export function useGraphs(manualId?: string) {
  return useQuery({
    queryKey: manualId === undefined ? ['graphs'] : ['graphs', manualId],
    queryFn: () => listGraphs(manualId),
    staleTime: Infinity,
  })
}

export function useManuals() {
  return useQuery({ queryKey: ['manuals'], queryFn: listManuals, staleTime: Infinity })
}

export function useSession(sessionId: string) {
  const identity = useIdentity()
  return useQuery(sessionQuery(sessionId, identity))
}

export function useHistory(page: number) {
  const identity = useIdentity()
  return useQuery({
    queryKey: ['history', identity, 'list', page],
    queryFn: () => listHistory(page),
    placeholderData: keepPreviousData,
  })
}

export function useHistoryDetail(sessionId: string) {
  const identity = useIdentity()
  return useQuery(historyDetailQuery(sessionId, identity))
}

export function useAdminFeedback(params: AdminFeedbackParams) {
  const identity = useIdentity()
  return useQuery({
    queryKey: ['admin', identity, 'feedback', params],
    queryFn: () => getAdminFeedback(params),
    placeholderData: keepPreviousData,
  })
}

export function useAdminSummary(days: number) {
  const identity = useIdentity()
  return useQuery({
    queryKey: ['admin', identity, 'summary', days],
    queryFn: () => getAdminSummary(days),
    placeholderData: keepPreviousData,
  })
}

export function useSymptomSearch() {
  return useMutation<SymptomSearchResponse, Error, { query: string; manualId?: string }>({
    mutationFn: ({ query, manualId }) => searchSymptoms(query, manualId),
  })
}

function useCacheSession() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return (session: SessionResponse) => {
    queryClient.setQueryData(sessionQuery(session.sessionId, identity).queryKey, session)
  }
}

interface StartSessionVariables {
  graphId: string
  query?: string
  manualId?: string
  modelSelection?: ModelSelection
}

export function useStartSession() {
  return useMutation({
    mutationFn: ({ graphId, ...options }: StartSessionVariables) => startSession(graphId, options),
    onSuccess: useCacheSession(),
  })
}

export function useSubmitAction(sessionId: string) {
  return useMutation({
    mutationFn: (action: TraversalAction) => submitAction(sessionId, action),
    onSuccess: useCacheSession(),
  })
}

export function useSubmitOutcome(sessionId: string) {
  return useMutation({
    mutationFn: (text: string) => submitOutcome(sessionId, text),
    onSuccess: useCacheSession(),
  })
}

export function useAbandonSession() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return useMutation({
    mutationFn: (sessionId: string) => abandonSession(sessionId),
    onSuccess: (_result: void, sessionId: string) => {
      queryClient.removeQueries({ queryKey: sessionQuery(sessionId, identity).queryKey })
    },
  })
}

export function useDeleteHistory() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return useMutation({
    mutationFn: (sessionId: string) => deleteHistory(sessionId),
    onSuccess: (_result: void, sessionId: string) => {
      queryClient.removeQueries({ queryKey: historyDetailQuery(sessionId, identity).queryKey })
      queryClient.removeQueries({ queryKey: sessionQuery(sessionId, identity).queryKey })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['history', identity, 'list'] })
    },
  })
}


export function useSubmitFeedback(sessionId: string) {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return useMutation({
    mutationFn: (feedback: HistoryFeedback) => submitFeedback(sessionId, feedback),
    onSuccess: (saved: HistoryFeedback) => {
      queryClient.setQueryData(historyDetailQuery(sessionId, identity).queryKey, (previous) =>
        previous === undefined ? previous : { ...previous, feedback: saved },
      )
    },
  })
}

export function useAdminDrafts() {
  const identity = useIdentity()
  return useQuery(adminDraftsQuery(identity))
}

export function useAdminDraft(id: string) {
  const identity = useIdentity()
  return useQuery(adminDraftQuery(id, identity))
}

export function useUploadDraft() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return useMutation({
    mutationFn: (input: DraftUploadInput) => uploadDraft(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', identity, 'drafts'] })
    },
  })
}

function useDraftCacheUpdate() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return (detail: DraftDetail) => {
    queryClient.setQueryData(adminDraftQuery(detail.id, identity).queryKey, detail)
    void queryClient.invalidateQueries({ queryKey: adminDraftsQuery(identity).queryKey, exact: true })
  }
}

export function useUpdateDraft(id: string) {
  const apply = useDraftCacheUpdate()
  return useMutation({
    mutationFn: (graphs: DraftGraph[]) => updateDraft(id, graphs),
    onSuccess: apply,
  })
}

export function useRejectDraft(id: string) {
  const apply = useDraftCacheUpdate()
  return useMutation({
    mutationFn: (reason: string) => rejectDraft(id, reason),
    onSuccess: apply,
  })
}

// เผยแพร่ — ส่ง acknowledgedWarnings สำเร็จแล้ว: โหลดร่าง/รายการใหม่ และโหลดรายการรุ่น/อาการใหม่ 

export function usePublishDraft(id: string) {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return useMutation({
    mutationFn: (acknowledgedWarnings: boolean) => publishDraft(id, acknowledgedWarnings),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', identity, 'drafts'] })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['graphs'] })
      void queryClient.invalidateQueries({ queryKey: ['manuals'] })
    },
  })
}
