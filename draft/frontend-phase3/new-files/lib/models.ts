import type { ManualSummary } from '../api/types'

/**
 * จับคู่เลขรุ่นที่ผู้ใช้พิมพ์กับรูปแบบ model_pattern ของคู่มือ (ฟังก์ชันล้วน ไม่แตะ React/API)
 *
 * model_pattern ใช้ "*" แทนอักขระ 1 ตัว (เช่น AR70H**D1***) และคั่นหลายรุ่นด้วย "/"
 * (เช่น RF195AC/RF197AC) ส่วน modelAliases คือเลขรุ่น/ชื่อขายอื่นที่ผู้พัฒนาเติม
 */

/** ตัวพิมพ์ใหญ่ ตัดช่องว่าง ขีดกลาง และขีดล่าง เพื่อให้ "wa21a-8376 g" เทียบกับ "WA21A8376G*" ได้ */
function normalizeModel(text: string): string {
  return text.toUpperCase().replace(/[\s\-_]/g, '')
}

/**
 * เลขรุ่นที่พิมพ์ตรงกับรูปแบบ 1 แบบหรือไม่ เทียบเฉพาะความยาวที่ซ้อนกัน:
 * - พิมพ์สั้นกว่ารูปแบบ = ตรงถ้าเป็นคำนำหน้า (กรองระหว่างพิมพ์ได้)
 * - พิมพ์ยาวกว่ารูปแบบ (มีรหัสตลาดต่อท้าย) = ตรงถ้ารูปแบบทั้งหมดตรง
 */
export function matchesPattern(input: string, pattern: string): boolean {
  const a = normalizeModel(input)
  const p = normalizeModel(pattern)
  if (a === '' || p === '') return false

  const length = Math.min(a.length, p.length)
  for (let i = 0; i < length; i += 1) {
    if (p[i] !== '*' && p[i] !== a[i]) return false
  }
  return true
}

type ModelFields = Pick<ManualSummary, 'modelPattern' | 'modelAliases'>

/** รูปแบบทั้งหมดของคู่มือ: model_pattern แยกด้วย "/" รวม modelAliases */
export function patternsOf(manual: ModelFields): string[] {
  return [...manual.modelPattern.split('/'), ...(manual.modelAliases ?? [])].map((s) => s.trim()).filter((s) => s !== '')
}

export function manualMatches(manual: ModelFields, input: string): boolean {
  return patternsOf(manual).some((pattern) => matchesPattern(input, pattern))
}

/** ชื่อที่แสดงให้ผู้ใช้: displayName ถ้าผู้พัฒนาเติมแล้ว ไม่งั้น modelPattern (ไม่เดาชื่อ) */
export function manualTitle(manual: Pick<ManualSummary, 'displayName' | 'modelPattern'>): string {
  return manual.displayName ?? manual.modelPattern
}
