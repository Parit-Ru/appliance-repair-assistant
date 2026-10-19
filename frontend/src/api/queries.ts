import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useIdentity } from '../lib/authContext'
import { getAdminFeedback, getAdminSummary } from './admin'
import { DRAFT_POLL_MS, getDraft, listDrafts, publishDraft, rejectDraft, updateDraft, uploadDraft } from './drafts'
import { deleteHistory, getHistory, listHistory, submitFeedback } from './history'
import { abandonSession, getHealth, getSession, listGraphs, listManuals, searchSymptoms, startSession, submitAction, submitOutcome } from './traversal'
import type { AdminFeedbackParams, DraftDetail, DraftGraph, DraftUploadInput, HistoryFeedback, ModelSelection, SessionResponse, SymptomSearchResponse, TraversalAction } from './types'

/*
  hook ของ React Query ที่หน้าจอเรียกใช้ (หน้าจอทุกหน้าเรียกผ่านไฟล์นี้ ไม่เรียก traversal.ts ตรงๆ)

  useQuery    = อ่านข้อมูล ทำงานเองเมื่อหน้าจอแสดง
  useMutation = เปลี่ยนข้อมูล ทำงานเมื่อสั่ง .mutate() เท่านั้น

  key สาธารณะ (health, graphs, manuals) ไม่มี identity
  key ที่ขึ้นกับผู้ใช้ (session/ประวัติ/admin) มี identity (id ผู้ใช้ หรือ 'guest') ไว้ที่ตำแหน่งที่ 2 เสมอ
  ผู้ใช้คนละคนจึงไม่มีทางอ่านแคชของกันและกัน (นอกจากนี้ AuthProvider ล้างแคชทั้งหมดตอน login/logout ด้วย)

  ตอน invalidate เป็นกลุ่ม เขียน prefix ตรงๆ เช่น ['history', identity, 'list'] (ตรงกับทุก key ที่ขึ้นต้นเหมือนกัน)

  queryOptions ข้างล่างมีเฉพาะ key ที่ถูกใช้หลายที่ (อ่านด้วย useQuery และเขียนแคชด้วย setQueryData / removeQueries)
  จึงใช้ตัวเดียวกัน ไม่มีทางพิมพ์ key ไม่ตรงกัน · key ที่ใช้ที่เดียวเขียนไว้ใน hook ของมันเลย
*/

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

// ร่างแผนผังขั้นตอน: ทุก key ขึ้นต้น ['admin', identity, 'drafts'] ไว้ invalidate ทีเดียว
// poll ทุก 3 วินาที "เฉพาะตอนที่มีร่างกำลังร่างอยู่" (สถานะ drafting) นอกนั้นไม่ poll
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

/**
 * รายการอาการ: ไม่ส่ง manualId = ทุกรุ่น · ส่ง = เฉพาะผังของรุ่นนั้น (แคชแยกตามรุ่น)
 * staleTime ไม่มีวันเก่า เพราะเปลี่ยนเฉพาะตอน seed ข้อมูลใหม่ ไม่เปลี่ยนระหว่างใช้งาน
 */
export function useGraphs(manualId?: string) {
  return useQuery({
    queryKey: manualId === undefined ? ['graphs'] : ['graphs', manualId],
    queryFn: () => listGraphs(manualId),
    staleTime: Infinity,
  })
}

/** รายการคู่มือ/รุ่น (ให้ผู้ใช้เลือกรุ่นก่อนเลือกอาการ) เปลี่ยนเฉพาะตอน seed เหมือน useGraphs */
export function useManuals() {
  return useQuery({ queryKey: ['manuals'], queryFn: listManuals, staleTime: Infinity })
}

/**
 * session ปัจจุบันและสถานะที่กำลังอยู่
 *
 * ปกติไม่ต้องเรียกเซิร์ฟเวอร์เลย เพราะ useStartSession ใส่ค่าในแคชไว้ให้แล้ว
 * จะเรียกจริงก็ต่อเมื่อเปิดลิงก์ตรงหรือกด F5 ซึ่งแคชว่างเปล่า
 */
export function useSession(sessionId: string) {
  const identity = useIdentity()
  return useQuery(sessionQuery(sessionId, identity))
}

/**
 * รายการประวัติการซ่อมของเบราว์เซอร์นี้ (ใหม่สุดก่อน · หน้าตามที่ URL เก็บไว้)
 *
 * ไม่ตั้ง staleTime: ผู้ใช้เพิ่งตรวจเสร็จแล้วเปิดหน้านี้ต้องเห็นรายการล่าสุดเสมอ
 * keepPreviousData: ตอนเปลี่ยนหน้า รายการเดิมยังค้างอยู่จนผลใหม่มา (ไม่กะพริบเป็นหน้าว่าง)
 */
export function useHistory(page: number) {
  const identity = useIdentity()
  return useQuery({
    queryKey: ['history', identity, 'list', page],
    queryFn: () => listHistory(page),
    placeholderData: keepPreviousData,
  })
}

/** รายละเอียดการตรวจย้อนหลัง 1 รายการ */
export function useHistoryDetail(sessionId: string) {
  const identity = useIdentity()
  return useQuery(historyDetailQuery(sessionId, identity))
}

// ============================================================
// หน้าผู้ดูแลระบบ (ใช้ได้เฉพาะ admin · หน้าเหล่านี้อยู่หลัง AdminRoute · backend ตรวจสิทธิ์จริง)
// ============================================================

/** รายการ feedback ทั้งหมด (ตัวกรอง/หน้า ตามที่ URL เก็บไว้) */
export function useAdminFeedback(params: AdminFeedbackParams) {
  const identity = useIdentity()
  return useQuery({
    queryKey: ['admin', identity, 'feedback', params],
    queryFn: () => getAdminFeedback(params),
    placeholderData: keepPreviousData,
  })
}

/** สถิติรวมช่วง N วันล่าสุด */
export function useAdminSummary(days: number) {
  const identity = useIdentity()
  return useQuery({
    queryKey: ['admin', identity, 'summary', days],
    queryFn: () => getAdminSummary(days),
    placeholderData: keepPreviousData,
  })
}

// ============================================================
// เปลี่ยนข้อมูล
// ============================================================

/**
 * ค้นหาอาการด้วยข้อความที่ผู้ใช้พิมพ์
 *
 * ใช้ useMutation ไม่ใช่ useQuery เพราะค้นเฉพาะตอนผู้ใช้กดค้นหา ไม่ใช่ตอนหน้าจอแสดง
 * และไม่ใส่แคช: คำค้นเดียวกันค้นซ้ำได้ผลเดิมอยู่แล้ว แต่ผลขึ้นกับสถานะระบบค้นหาบนเซิร์ฟเวอร์
 * (เช่น ตอนแรกยังโหลดโมเดลอยู่ ตอบ SEARCH_NOT_READY) จึงไม่ควรจำผลเก่า
 */
export function useSymptomSearch() {
  return useMutation<SymptomSearchResponse, Error, { query: string; manualId?: string }>({
    mutationFn: ({ query, manualId }) => searchSymptoms(query, manualId),
  })
}

/**
 * ใส่ session ที่เซิร์ฟเวอร์ตอบกลับลงแคชทันที (เริ่ม / เดินขั้นตอน / บันทึกผลลัพธ์ ใช้ร่วมกัน)
 * หน้าจอจึงแสดงขั้นปัจจุบันได้เลยโดยไม่ต้องยิงไปขอซ้ำ
 *
 * ถ้าเซิร์ฟเวอร์ปฏิเสธ (เช่นด่านความปลอดภัย) onSuccess ไม่ทำงาน แคชจึงยังเป็นสถานะเดิม
 * หน้าจอไม่ขยับ — ตรงกับสถานะจริงบนเซิร์ฟเวอร์
 */
function useCacheSession() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return (session: SessionResponse) => {
    queryClient.setQueryData(sessionQuery(session.sessionId, identity).queryKey, session)
  }
}

/** ตัวแปรของการเริ่ม session query ใส่เฉพาะเมื่อเลือกมาจากผลค้นหา */
interface StartSessionVariables {
  graphId: string
  query?: string
  manualId?: string
  modelSelection?: ModelSelection
}

/** เริ่มการตรวจ (ใส่ผลลงแคชทันที หน้าตรวจอาการจะเปิดขึ้นมาพร้อมข้อมูล) */
export function useStartSession() {
  return useMutation({
    mutationFn: ({ graphId, ...options }: StartSessionVariables) => startSession(graphId, options),
    onSuccess: useCacheSession(),
  })
}

/** ส่งคำตอบหรือคำสั่งหนึ่งครั้ง เซิร์ฟเวอร์ตอบ session ใหม่พร้อมสถานะถัดไปกลับมา */
export function useSubmitAction(sessionId: string) {
  return useMutation({
    mutationFn: (action: TraversalAction) => submitAction(sessionId, action),
    onSuccess: useCacheSession(),
  })
}

/**
 * บันทึกข้อความผลลัพธ์ตอนการตรวจจบ
 *
 * เซิร์ฟเวอร์ตอบ session พร้อม outcome ที่บันทึกแล้ว ฟอร์มจึงเปลี่ยนเป็นข้อความอ่านอย่างเดียวทันที
 * และกด F5 แล้วยังเห็นเหมือนเดิม เพราะ GET session ส่ง outcome กลับมาด้วย
 */
export function useSubmitOutcome(sessionId: string) {
  return useMutation({
    mutationFn: (text: string) => submitOutcome(sessionId, text),
    onSuccess: useCacheSession(),
  })
}

/**
 * ยกเลิกการตรวจ
 * ลบออกจากแคชด้วย ไม่งั้นถ้ากดย้อนกลับมาจะเห็นขั้นตอนเก่าที่เซิร์ฟเวอร์ลบไปแล้ว
 */
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

/**
 * ลบรายการออกจากประวัติ (ลบทั้ง session ที่เซิร์ฟเวอร์ ลบแล้วกู้คืนไม่ได้)
 * เอาแคชของรายการนั้นออก และทำให้ทุกรายการ (ทุกหน้า) โหลดใหม่ เพราะจำนวนรวมและการแบ่งหน้าเปลี่ยน
 */
export function useDeleteHistory() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return useMutation({
    mutationFn: (sessionId: string) => deleteHistory(sessionId),
    onSuccess: (_result: void, sessionId: string) => {
      queryClient.removeQueries({ queryKey: historyDetailQuery(sessionId, identity).queryKey })
      queryClient.removeQueries({ queryKey: sessionQuery(sessionId, identity).queryKey })
    },
    // สำเร็จหรือไม่ก็โหลดรายการใหม่: ถ้า 404 แปลว่ารายการนั้นหายไปแล้ว (ลบจากแท็บอื่น) รายการบนหน้าจอต้องตรงกับเซิร์ฟเวอร์
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['history', identity, 'list'] })
    },
  })
}

/**
 * ให้คะแนน 👍/👎 + ข้อความสั้น (ส่งซ้ำ = แก้ค่าเดิม)
 * เซิร์ฟเวอร์ตอบค่าที่บันทึกแล้ว เอาใส่ในแคชรายละเอียดเลย ฟอร์มจึงขึ้น "บันทึกแล้ว" ทันที
 */
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

// ============================================================
// ร่างแผนผังขั้นตอน (admin) — ถามสถานะทุก 3 วินาที "เฉพาะตอนที่มีร่างกำลังร่างอยู่"
// ============================================================

/** รายการร่าง · poll ต่อเมื่อมีร่างสถานะ drafting อย่างน้อย 1 รายการ */
export function useAdminDrafts() {
  const identity = useIdentity()
  return useQuery(adminDraftsQuery(identity))
}

/** รายละเอียดร่าง · poll ต่อเมื่อร่างนี้ยังเป็น drafting */
export function useAdminDraft(id: string) {
  const identity = useIdentity()
  return useQuery(adminDraftQuery(id, identity))
}

/** อัปโหลด PDF → เริ่มร่าง · สำเร็จแล้วโหลดรายการใหม่ (และเริ่ม poll เพราะมีร่าง drafting) */
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

/** ตัวช่วยของ mutation ที่ได้รายละเอียดร่างกลับมา: ใส่แคชรายละเอียด + โหลดรายการใหม่ */
function useDraftCacheUpdate() {
  const queryClient = useQueryClient()
  const identity = useIdentity()
  return (detail: DraftDetail) => {
    queryClient.setQueryData(adminDraftQuery(detail.id, identity).queryKey, detail)
    void queryClient.invalidateQueries({ queryKey: adminDraftsQuery(identity).queryKey, exact: true })
  }
}

/** แก้แผนผังแล้วให้ backend ตรวจใหม่ ("ตรวจใหม่") */
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

/**
 * เผยแพร่ — ส่ง acknowledgedWarnings ตามช่องติ๊ก (backend ตรวจซ้ำเสมอ: error = 409 ไม่มี override)
 * สำเร็จแล้ว: โหลดร่าง/รายการใหม่ และโหลดรายการรุ่น/อาการใหม่ (มีแผนผังขั้นตอนใหม่ในระบบแล้ว)
 */
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
