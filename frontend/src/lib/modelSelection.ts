import { useSearchParams } from 'react-router-dom'
import type { ModelSelection } from '../api/types'

  //รุ่นที่ผู้ใช้เลือก เก็บไว้ใน URL (เช่น /#/symptoms?manual=samsung_ge83mdt_um_de68_04111e)
  //unknown=1 แปลว่าผู้ใช้บอกว่าไม่ทราบรุ่น แล้วเลือกรุ่นที่ใกล้เคียงเอง

export function useChosenModel(): { manualId: string | undefined; modelSelection: ModelSelection } {
  const [params] = useSearchParams()
  const manualId = params.get('manual')?.trim() || undefined
  const modelSelection: ModelSelection = params.get('unknown') === '1' ? 'unknown' : 'selected'
  return { manualId, modelSelection }
}

/** ลิงก์ไปหน้าเลือกอาการของรุ่นนั้น */
export function symptomsPath(manualId: string, modelSelection: ModelSelection, page: 'search' | 'all' = 'search'): string {
  const params = new URLSearchParams({ manual: manualId })
  if (modelSelection === 'unknown') params.set('unknown', '1')
  return `${page === 'all' ? '/symptoms/all' : '/symptoms'}?${params.toString()}`
}

export const MODEL_MATCH_HINT = 'ขั้นตอนซ่อมต่างกันตามรุ่น เลือกรุ่นให้ตรงกับเครื่องของคุณ (ดูเลขรุ่นได้ที่สติกเกอร์บนตัวเครื่อง)'

/*
  หัวข้อกล่องเตือนเมื่อผู้ใช้ไม่ทราบรุ่น (modelSelection = 'unknown')
  ใช้ร่วมกันสองที่: หน้าค้นอาการ (SymptomsPage) และหน้า session (SessionPage) ห้ามก๊อปข้อความไปวางที่อื่น
 */
export const UNKNOWN_MODEL_NOTICE_TITLE = 'คุณเลือกรุ่นที่ใกล้เคียง ขั้นตอนอาจไม่ตรงกับเครื่อง'

/** ลิงก์ไปหน้าค้นอาการแบบไม่ระบุรุ่น (ค้นทุกรุ่น) ไม่มี ?manual= แต่มี unknown=1 */
export const UNKNOWN_MODEL_SEARCH_PATH = '/symptoms?unknown=1'

/*
  modelSelection ที่มากับ navigate state ตอนเริ่ม session (ดู useStartSymptom)
  undefined = ไม่ได้ผ่านหน้าเลือกรุ่น (เริ่มจากหน้ารายการอาการทุกรุ่น) หรือเปิดลิงก์ session ในแท็บใหม่ state เลยหาย
  ห้ามเติมเป็น 'selected' เอง เพราะจะบันทึกว่าผู้ใช้ระบุรุ่นไว้แล้วทั้งที่ไม่ใช่
 */
export function modelSelectionFromState(state: unknown): ModelSelection | undefined {
  const value = (state as { modelSelection?: unknown } | null | undefined)?.modelSelection
  return value === 'selected' || value === 'unknown' ? value : undefined
}

/*
   ตัวเลือกตอนเริ่มตรวจจากหน้ารายการอาการ
  -มีรุ่นที่เลือกไว้ (?manual=): ส่งรุ่นนั้นและ modelSelection ตามที่เลือก
  -ดูรายการทุกรุ่น (ไม่มี ?manual=): ส่งเฉพาะ manualId ของอาการที่กด ไม่ส่ง modelSelection
 */
export function startOptions(
  chosen: { manualId: string | undefined; modelSelection: ModelSelection },
  symptomManualId: string,
): { manualId: string; modelSelection?: ModelSelection } {
  if (chosen.manualId === undefined) return { manualId: symptomManualId }
  return { manualId: chosen.manualId, modelSelection: chosen.modelSelection }
}

export function otherSymptomsPath(manualId: string | undefined, modelSelection: ModelSelection | undefined): string {
  if (modelSelection === undefined) return '/symptoms/all'
  // ผู้ใช้ไม่ทราบรุ่น: กลับไปค้นข้ามรุ่นเหมือนเดิม ไม่พาไปค้นเฉพาะรุ่นที่เพิ่งตรวจ (เพราะผู้ใช้ไม่ได้เลือกรุ่นนั้นเอง)
  if (modelSelection === 'unknown') return UNKNOWN_MODEL_SEARCH_PATH
  if (manualId === undefined) return '/devices'
  return symptomsPath(manualId, modelSelection)
}
