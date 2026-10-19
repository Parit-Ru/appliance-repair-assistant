/**
 * drafts.errors.ts — error ของงานร่างผัง (ใช้ ApiError รหัสละตัว · AllExceptionsFilter แปลงเป็น response)
 * ฟังก์ชันสร้างเหล่านี้มีไว้เพราะบางตัวถูกโยนจากหลายที่ (service / store) ข้อความจะได้เหมือนกันทุกที่
 */

import { ApiError } from '../common/api-error';

/** ข้อมูลที่ส่งมา (ฟอร์ม / body / ผังที่แก้) ผิดรูปแบบ */
export const invalidDraftRequest = (message: string) => new ApiError(400, 'INVALID_DRAFT_REQUEST', message);

export const pdfUnsupportedType = () => new ApiError(415, 'PDF_UNSUPPORTED_TYPE', 'ไฟล์ที่อัปโหลดไม่ใช่ PDF');

export const draftNotFound = (id: string) => new ApiError(404, 'DRAFT_NOT_FOUND', `ไม่พบร่างผัง '${id}'`);

/** สถานะของร่างไม่อนุญาตให้ทำการนี้ (action = edit / reject / publish) */
export const draftNotReady = (action: string, status: string) =>
  new ApiError(409, 'DRAFT_NOT_READY', `ทำ '${action}' ไม่ได้ในสถานะ '${status}'`);

export const draftBusy = () => new ApiError(409, 'DRAFT_BUSY', 'มีร่างอื่นกำลังถูกร่างอยู่ รอให้เสร็จก่อนแล้วลองใหม่');

export const draftInvalid = (errorCount: number) =>
  new ApiError(409, 'DRAFT_INVALID', `ร่างผังยังไม่ผ่านการตรวจ (${errorCount} error) แก้ให้ผ่านก่อนเผยแพร่ — ไม่มีทางข้ามการตรวจ`);

export const warningsNotAcknowledged = (warningCount: number) =>
  new ApiError(409, 'DRAFT_WARNINGS_UNACKNOWLEDGED', `ร่างผังมีคำเตือน ${warningCount} ข้อ ต้องอ่านและส่ง acknowledgedWarnings: true ยืนยันก่อนเผยแพร่`);

export const draftIdConflict = (conflicts: string[]) =>
  new ApiError(
    409,
    'DRAFT_ID_CONFLICT',
    `ชนกับข้อมูลที่มีอยู่แล้ว: ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? ` (และอีก ${conflicts.length - 5})` : ''} — ไม่เขียนทับ`,
  );

/** เขียนลงฐานข้อมูลแล้ว แต่โหลดผังเข้าหน่วยความจำไม่สำเร็จ */
export const publishReloadFailed = () =>
  new ApiError(500, 'PUBLISH_RELOAD_FAILED', 'เผยแพร่ลงฐานข้อมูลแล้ว แต่โหลดผังเข้าระบบไม่สำเร็จ — ผังเดิมยังใช้งานได้ ให้รีสตาร์ต backend เพื่อโหลดผังใหม่');
