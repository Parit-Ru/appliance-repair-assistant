import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  abandonSession,
  getHealth,
  getSession,
  listGraphs,
  listManuals,
  searchSymptoms,
  startSession,
  submitAction,
  submitOutcome,
} from './traversal'
import type { ModelSelection, SessionResponse, SymptomSearchResponse, TraversalAction } from './types'

/**
 * hook ของ React Query ที่หน้าจอเรียกใช้
 * หน้าจอทุกหน้าเรียกผ่านไฟล์นี้ ไม่เรียก traversal.ts ตรงๆ
 *
 * useQuery    = อ่านข้อมูล ทำงานเองเมื่อหน้าจอแสดง
 * useMutation = เปลี่ยนข้อมูล ทำงานเมื่อสั่ง .mutate() เท่านั้น
 */

/**
 * key ของแคช รวมไว้ที่เดียว
 * key ต้องตรงกันทุกตัวอักษรทั้งตอนอ่านและตอนเขียนแคช
 * ถ้าพิมพ์ต่างกัน แคชจะไม่เชื่อมกัน แล้วหน้าจอจะไม่อัปเดตโดยไม่มี error เตือน
 */
export const queryKeys = {
  health: ['health'] as const,
  graphs: ['graphs'] as const,
  graphsOf: (manualId: string) => ['graphs', manualId] as const,
  manuals: ['manuals'] as const,
  session: (sessionId: string) => ['session', sessionId] as const,
}

// ============================================================
// อ่านข้อมูล
// ============================================================

/** สถานะเซิร์ฟเวอร์จริง */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getHealth,
    staleTime: 30_000,
  })
}

/**
 * รายการอาการ: ไม่ส่ง manualId = ทุกรุ่น · ส่ง = เฉพาะผังของรุ่นนั้น (แคชแยกตามรุ่น)
 * staleTime ไม่มีวันเก่า เพราะเปลี่ยนเฉพาะตอน seed ข้อมูลใหม่ ไม่เปลี่ยนระหว่างใช้งาน
 */
export function useGraphs(manualId?: string) {
  return useQuery({
    queryKey: manualId === undefined ? queryKeys.graphs : queryKeys.graphsOf(manualId),
    queryFn: () => listGraphs(manualId),
    staleTime: Infinity,
  })
}

/** รายการคู่มือ/รุ่น (ให้ผู้ใช้เลือกรุ่นก่อนเลือกอาการ) เปลี่ยนเฉพาะตอน seed เหมือน useGraphs */
export function useManuals() {
  return useQuery({
    queryKey: queryKeys.manuals,
    queryFn: listManuals,
    staleTime: Infinity,
  })
}

/**
 * session ปัจจุบันและสถานะที่กำลังอยู่
 *
 * ปกติไม่ต้องเรียกเซิร์ฟเวอร์เลย เพราะ useStartSession ใส่ค่าในแคชไว้ให้แล้ว
 * จะเรียกจริงก็ต่อเมื่อเปิดลิงก์ตรงหรือกด F5 ซึ่งแคชว่างเปล่า
 */
export function useSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => getSession(sessionId),
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

/** ตัวแปรของการเริ่ม session query ใส่เฉพาะเมื่อเลือกมาจากผลค้นหา */
interface StartSessionVariables {
  graphId: string
  query?: string
  manualId?: string
  modelSelection?: ModelSelection
}

/**
 * เริ่มการตรวจ
 * เอาผลใส่แคชทันที หน้าตรวจอาการจะเปิดขึ้นมาพร้อมข้อมูล ไม่ต้องรอโหลดซ้ำ
 */
export function useStartSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ graphId, ...options }: StartSessionVariables) => startSession(graphId, options),
    onSuccess: (session: SessionResponse) => {
      queryClient.setQueryData(queryKeys.session(session.sessionId), session)
    },
  })
}

/**
 * ส่งคำตอบหรือคำสั่งหนึ่งครั้ง
 *
 * เซิร์ฟเวอร์ตอบ session ใหม่พร้อมสถานะถัดไปกลับมา เอาใส่แคชเลย
 * หน้าจอจึงเปลี่ยนเป็นขั้นถัดไปทันที ไม่ต้องยิงไปขอซ้ำ
 *
 * ถ้าเซิร์ฟเวอร์ปฏิเสธ เช่นด่านความปลอดภัย onSuccess จะไม่ทำงาน
 * แคชจึงยังเป็นสถานะเดิม หน้าจอไม่ขยับ — ตรงกับสถานะจริงบนเซิร์ฟเวอร์
 */
export function useSubmitAction(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: TraversalAction) => submitAction(sessionId, action),
    onSuccess: (session: SessionResponse) => {
      queryClient.setQueryData(queryKeys.session(sessionId), session)
    },
  })
}

/**
 * บันทึกข้อความผลลัพธ์ตอนการตรวจจบ
 *
 * เซิร์ฟเวอร์ตอบ session พร้อม outcome ที่บันทึกแล้ว เอาใส่แคชเลย
 * ฟอร์มจึงเปลี่ยนเป็นข้อความอ่านอย่างเดียวทันที และกด F5 แล้วยังเห็นเหมือนเดิม
 * เพราะ GET session ส่ง outcome กลับมาด้วย
 *
 * ถ้าเซิร์ฟเวอร์ปฏิเสธ onSuccess ไม่ทำงาน แคชไม่เปลี่ยน ฟอร์มยังอยู่พร้อมข้อความที่พิมพ์ไว้
 */
export function useSubmitOutcome(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => submitOutcome(sessionId, text),
    onSuccess: (session: SessionResponse) => {
      queryClient.setQueryData(queryKeys.session(sessionId), session)
    },
  })
}

/**
 * ยกเลิกการตรวจ
 * ลบออกจากแคชด้วย ไม่งั้นถ้ากดย้อนกลับมาจะเห็นขั้นตอนเก่าที่เซิร์ฟเวอร์ลบไปแล้ว
 */
export function useAbandonSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => abandonSession(sessionId),
    onSuccess: (_result: void, sessionId: string) => {
      queryClient.removeQueries({ queryKey: queryKeys.session(sessionId) })
    },
  })
}