import { useSearchParams } from 'react-router-dom'
import type { ModelSelection } from '../api/types'

/**
 * รุ่นที่ผู้ใช้เลือก เก็บไว้ใน URL (เช่น /#/symptoms?manual=samsung_ac_ar70h)
 * เพื่อให้กดย้อนกลับ รีเฟรช หรือแชร์ลิงก์ แล้วยังอยู่รุ่นเดิม
 * unknown=1 แปลว่าผู้ใช้บอกว่าไม่ทราบรุ่น แล้วเลือกรุ่นที่ใกล้เคียงเอง
 */
export function useChosenModel(): { manualId: string | undefined; modelSelection: ModelSelection } {
  const [params] = useSearchParams()
  const manualId = params.get('manual')?.trim() || undefined
  const modelSelection: ModelSelection = params.get('unknown') === '1' ? 'unknown' : 'selected'
  return { manualId, modelSelection }
}

/** ลิงก์ไปหน้าเลือกอาการของรุ่นนั้น (page = 'all' คือหน้าอาการทั้งหมดของรุ่น) */
export function symptomsPath(manualId: string, modelSelection: ModelSelection, page: 'search' | 'all' = 'search'): string {
  const params = new URLSearchParams({ manual: manualId })
  if (modelSelection === 'unknown') params.set('unknown', '1')
  return `${page === 'all' ? '/symptoms/all' : '/symptoms'}?${params.toString()}`
}
