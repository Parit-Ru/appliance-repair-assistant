/**
 * api-error.ts — error ที่ตอบเป็น HTTP ได้ตรงๆ: status + code + message
 *
 * ทุกที่ในระบบที่ต้องตอบ error ให้หน้าจอ (ข้อมูลผิดรูปแบบ, ไม่พบ, ขัดกับสถานะ ฯลฯ) โยน ApiError พร้อมรหัสของมันเลย
 * AllExceptionsFilter (common/all-exceptions.filter.ts) เป็นที่เดียวที่แปลงเป็น response {statusCode, code, message}
 * หน้าจอ (frontend/src/lib/errors.ts) ตัดสินจาก code เท่านั้น ข้อความ message เขียนให้คนอ่าน
 *
 * ไม่ใช้กับ error ภายในที่ไม่เกี่ยวกับ HTTP (เช่น error ของ traversal-engine ที่ engine ไม่ควรรู้จัก HTTP)
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
