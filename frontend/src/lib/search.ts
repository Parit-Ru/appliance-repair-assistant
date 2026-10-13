/**
 * ตรรกะเล็กๆ ของช่องค้นหาอาการ (ฟังก์ชันล้วน ไม่แตะ React และไม่เรียก API)
 *
 * ตรวจคำค้นฝั่งหน้าจอไว้แค่เพื่อไม่ให้กดค้นหาโดยเปล่าประโยชน์ เช่น ช่องว่าง
 * เซิร์ฟเวอร์ตรวจซ้ำเสมอและเป็นผู้ตัดสิน (INVALID_QUERY) หน้าจอไม่ได้ป้องกันอะไรแทนเซิร์ฟเวอร์
 */

/**
 * ความยาวสูงสุดของคำค้น ต้องตรงกับ MAX_QUERY_LENGTH ใน
 * backend/src/symptom-search/symptom-search.dto.ts (ลอกมา ถ้าฝั่งนั้นเปลี่ยนต้องแก้ที่นี่ด้วย)
 */
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
export type QueryCheck = 'ok' | 'empty' | 'too-long'

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
