

/** เป็น object ธรรมดา (ไม่ใช่ null และไม่ใช่ array) — ใช้ตรวจ body/ข้อมูลที่รับเข้ามาก่อนอ่านฟิลด์ */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}


export const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** ค่าจากแถว MySQL (อาจเป็นข้อความหรือ null) → ตัวเลข · null/undefined คงเป็น null ไม่กลายเป็น 0 */
export const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

/** เวลา epoch (วินาที) จาก UNIX_TIMESTAMP(...) → ข้อความ ISO 8601 */
export const isoFromEpoch = (epochSeconds: number): string => new Date(epochSeconds * 1000).toISOString();

/** รูปแบบ UUID (ตัวพิมพ์เล็ก/ใหญ่ก็ได้) */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
