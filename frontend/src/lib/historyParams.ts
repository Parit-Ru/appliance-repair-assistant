import type { DeviceCategory, HistoryParams, OutcomeKind } from '../api/types'
import { DEVICE_CATEGORY_LABELS, HISTORY_STATUS_ORDER } from './labels'

/**
 * ตัวกรอง/การเรียง/หน้า ของหน้า "ประวัติการซ่อม" เก็บไว้ใน URL (เช่น /#/history?status=user_fixed&page=2)
 * เพื่อให้กดย้อนกลับ รีเฟรช หรือแชร์ลิงก์ แล้วยังเห็นมุมมองเดิม
 *
 * ฟังก์ชันล้วน ไม่แตะ React: ค่าที่ไม่รู้จัก (พิมพ์ URL เอง) ถูกปัดทิ้งเป็นค่าเริ่มต้น ไม่ส่งต่อไปเซิร์ฟเวอร์
 * จึงไม่ได้ 400 จากค่าที่ผู้ใช้แก้ใน URL
 */

/** ความยาวสูงสุดของคำค้น/ยี่ห้อ ต้องตรงกับ MAX_SEARCH_LENGTH/MAX_BRAND_LENGTH ใน backend/src/history/history.dto.ts */
export const MAX_HISTORY_SEARCH_LENGTH = 100

export const DEFAULT_HISTORY_PARAMS: HistoryParams = {
  q: '',
  category: undefined,
  brand: undefined,
  status: undefined,
  sort: 'newest',
  page: 1,
}

const CATEGORIES = Object.keys(DEVICE_CATEGORY_LABELS) as DeviceCategory[]

function parsePage(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

export function parseHistoryParams(search: URLSearchParams): HistoryParams {
  const category = search.get('category')
  const status = search.get('status')
  const brand = search.get('brand')?.trim().slice(0, MAX_HISTORY_SEARCH_LENGTH)

  return {
    q: (search.get('q') ?? '').trim().slice(0, MAX_HISTORY_SEARCH_LENGTH),
    category: CATEGORIES.find((c) => c === category),
    brand: brand === undefined || brand === '' ? undefined : brand,
    status: HISTORY_STATUS_ORDER.find((s): s is OutcomeKind => s === status),
    sort: search.get('sort') === 'oldest' ? 'oldest' : 'newest',
    page: parsePage(search.get('page')),
  }
}

/** ค่าเริ่มต้นไม่ถูกเขียนลง URL (ลิงก์สั้น และ /history เฉยๆ = มุมมองเริ่มต้น) */
export function toSearchParams(params: HistoryParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.q !== '') search.set('q', params.q)
  if (params.category !== undefined) search.set('category', params.category)
  if (params.brand !== undefined) search.set('brand', params.brand)
  if (params.status !== undefined) search.set('status', params.status)
  if (params.sort !== 'newest') search.set('sort', params.sort)
  if (params.page !== 1) search.set('page', String(params.page))
  return search
}

/** แก้ตัวกรอง/การเรียง → กลับไปหน้า 1 เสมอ (หน้าเดิมอาจไม่มีอยู่แล้วในผลใหม่) · แก้ page อย่างเดียว = คงหน้าที่ระบุ */
export function applyPatch(params: HistoryParams, patch: Partial<HistoryParams>): HistoryParams {
  const next = { ...params, ...patch }
  return 'page' in patch ? next : { ...next, page: 1 }
}

/** มีตัวกรองที่แคบผลอยู่หรือไม่ (การเรียงและหน้าไม่นับ) — ไว้แยก "ยังไม่มีประวัติ" ออกจาก "ไม่พบตามตัวกรอง" */
export function hasActiveFilters(params: HistoryParams): boolean {
  return params.q !== '' || params.category !== undefined || params.brand !== undefined || params.status !== undefined
}

/** ล้างตัวกรองทั้งหมด คงการเรียงไว้ */
export function clearFilters(params: HistoryParams): HistoryParams {
  return { ...DEFAULT_HISTORY_PARAMS, sort: params.sort }
}
