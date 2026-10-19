import type { HistoryFeedback } from '../api/types'

/**
 * ตรวจข้อความที่ผู้ใช้พิมพ์ฝั่งหน้าจอ (ฟังก์ชันล้วน ไม่แตะ React และไม่เรียก API)
 *
 * แพตเทิร์นเดียวกันทุกช่อง: ตัดช่องว่างหน้าหลัง → ตรวจความยาว → ตัวนับตัวอักษร
 * ตรวจเพื่อบอกผู้ใช้ทันทีเท่านั้น เซิร์ฟเวอร์ตรวจซ้ำเสมอและเป็นผู้ตัดสิน
 * เพดานความยาวลอกมาจาก backend ถ้าฝั่งนั้นเปลี่ยนต้องแก้ที่นี่ด้วย
 */

// ============================================================
// ช่องค้นหาอาการ (เซิร์ฟเวอร์ตอบ INVALID_QUERY ถ้าผิด)
// ============================================================

/** ต้องตรงกับ MAX_QUERY_LENGTH ใน backend/src/symptom-search/symptom-search.dto.ts */
export const MAX_QUERY_LENGTH = 200

/** ตัดช่องว่างหน้าหลัง เหมือนที่เซิร์ฟเวอร์ทำก่อนตรวจความยาว */
export function normalizeQuery(raw: string): string {
  return raw.trim()
}

/**
 * ผลตรวจคำค้น
 * - ok       ค้นหาได้
 * - empty    ว่างหรือมีแต่ช่องว่าง
 * - too-long ยาวเกินที่เซิร์ฟเวอร์รับ
 */
type QueryCheck = 'ok' | 'empty' | 'too-long'

export function checkQuery(raw: string): QueryCheck {
  const query = normalizeQuery(raw)
  if (query === '') return 'empty'
  if (query.length > MAX_QUERY_LENGTH) return 'too-long'
  return 'ok'
}

/**
 * แสดงคะแนนความคล้ายเป็นทศนิยม 3 ตำแหน่งเสมอ (0.8 → "0.800")
 * เซิร์ฟเวอร์ปัดมาแล้ว แต่ JSON ตัดศูนย์ท้ายทิ้ง จึงเติมให้ตัวเลขทุกแถวกว้างเท่ากัน อ่านเทียบกันง่าย
 *
 * ไม่แปลงเป็นเปอร์เซ็นต์ เพราะ cosine ไม่ใช่ความน่าจะเป็น
 * "0.812" ไม่ได้แปลว่าถูก 81.2%
 */
export function formatScore(score: number): string {
  return score.toFixed(3)
}

// ============================================================
// ความเห็นตอนให้คะแนนผลการตรวจ (เซิร์ฟเวอร์ตอบ INVALID_FEEDBACK ถ้าผิด)
// ============================================================

/** ต้องตรงกับ MAX_FEEDBACK_COMMENT_LENGTH ใน backend/src/history/history.dto.ts */
export const MAX_FEEDBACK_COMMENT_LENGTH = 500

/** ตัดช่องว่างหน้าหลัง เหมือนที่เซิร์ฟเวอร์ทำก่อนนับความยาว */
function normalizeComment(raw: string): string {
  return raw.trim()
}

/** ผลตรวจข้อความ: ok = ส่งได้ (ว่างก็ส่งได้ เพราะไม่บังคับ) · too-long = ยาวเกินที่เซิร์ฟเวอร์รับ */
type CommentCheck = 'ok' | 'too-long'

export function checkComment(raw: string): CommentCheck {
  return normalizeComment(raw).length > MAX_FEEDBACK_COMMENT_LENGTH ? 'too-long' : 'ok'
}

export function formatCommentCounter(raw: string): string {
  return `${raw.length}/${MAX_FEEDBACK_COMMENT_LENGTH}`
}

/**
 * สิ่งที่ส่งไปเซิร์ฟเวอร์: comment ที่ว่าง (หรือมีแต่ช่องว่าง) ส่งเป็น null
 * ให้ตรงกับที่ฐานข้อมูลเก็บ (NULL ไม่ใช่สตริงว่าง)
 */
export function toFeedback(helpful: boolean, rawComment: string): HistoryFeedback {
  const comment = normalizeComment(rawComment)
  return { helpful, comment: comment === '' ? null : comment }
}

/** ค่าที่หน้าจอถืออยู่ตรงกับที่บันทึกไว้แล้วหรือไม่ (ไว้ขึ้น "บันทึกแล้ว" และปิดปุ่มบันทึกเมื่อไม่มีอะไรเปลี่ยน) */
export function isSameFeedback(saved: HistoryFeedback | null, helpful: boolean | null, rawComment: string): boolean {
  if (saved === null || helpful === null) return false
  const current = toFeedback(helpful, rawComment)
  return saved.helpful === current.helpful && (saved.comment ?? null) === current.comment
}
