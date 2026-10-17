/**
 * drafts.errors.ts — error ของโมดูล authoring (ตัวแปลงเป็น HTTP อยู่ที่ drafts.exception.filter.ts)
 */

export class InvalidDraftRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** ไฟล์ที่อัปโหลดไม่ใช่ PDF (ตรวจจากไบต์แรกของไฟล์ ไม่เชื่อ mimetype/นามสกุลที่ผู้ใช้ส่งมา) → 415 */
export class PdfUnsupportedTypeError extends Error {
  constructor() {
    super('ไฟล์ที่อัปโหลดไม่ใช่ PDF');
    this.name = this.constructor.name;
  }
}

export class DraftNotFoundError extends Error {
  constructor(id: string) {
    super(`ไม่พบร่างผัง '${id}'`);
    this.name = this.constructor.name;
  }
}

/** สถานะของร่างไม่อนุญาตการกระทำนี้ (เช่น publish ร่างที่ยังไม่ ready) → 409 */
export class DraftNotReadyError extends Error {
  constructor(action: string, status: string) {
    super(`ทำ '${action}' ไม่ได้ในสถานะ '${status}'`);
    this.name = this.constructor.name;
  }
}

/** มีร่างกำลังถูก LLM ร่างอยู่ (ทีละ 1 งาน) → 409 */
export class DraftBusyError extends Error {
  constructor() {
    super('มีร่างอื่นกำลังถูกร่างอยู่ รอให้เสร็จก่อนแล้วลองใหม่');
    this.name = this.constructor.name;
  }
}

/** validator พบ error → publish ไม่ได้ ไม่มี override → 409 */
export class DraftInvalidError extends Error {
  constructor(readonly errorCount: number) {
    super(`ร่างผังยังไม่ผ่านการตรวจ (${errorCount} error) แก้ให้ผ่านก่อนเผยแพร่ — ไม่มีทางข้ามการตรวจ`);
    this.name = this.constructor.name;
  }
}

/** มี warning แต่ผู้ตรวจยังไม่ส่ง acknowledgedWarnings: true → 409 */
export class WarningsNotAcknowledgedError extends Error {
  constructor(readonly warningCount: number) {
    super(`ร่างผังมีคำเตือน ${warningCount} ข้อ ต้องอ่านและส่ง acknowledgedWarnings: true ยืนยันก่อนเผยแพร่`);
    this.name = this.constructor.name;
  }
}

/** manual_id หรือ graph_id ชนกับของที่มีอยู่แล้ว (ห้ามเขียนทับผังที่ใช้งานอยู่) → 409 */
export class DraftIdConflictError extends Error {
  constructor(readonly conflicts: string[]) {
    super(`ชนกับข้อมูลที่มีอยู่แล้ว: ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? ` (และอีก ${conflicts.length - 5})` : ''} — ไม่เขียนทับ`);
    this.name = this.constructor.name;
  }
}

/** เขียนผังลงฐานข้อมูลสำเร็จแล้ว แต่โหลดเข้าหน่วยความจำของ backend ไม่สำเร็จ → 500 (ผังเดิมยังทำงานปกติ) */
export class PublishReloadError extends Error {
  constructor() {
    super('เผยแพร่ลงฐานข้อมูลแล้ว แต่โหลดผังเข้าระบบไม่สำเร็จ — ผังเดิมยังใช้งานได้ ให้รีสตาร์ต backend เพื่อโหลดผังใหม่');
    this.name = this.constructor.name;
  }
}
