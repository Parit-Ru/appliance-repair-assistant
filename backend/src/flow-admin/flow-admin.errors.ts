import { ApiError } from '../common/api-error';

export const invalidAdminQuery = (message: string) => new ApiError(400, 'INVALID_ADMIN_QUERY', message);
export const invalidFlowRequest = (message: string) => new ApiError(400, 'INVALID_FLOW_REQUEST', message);

// Separate from FLOW_NOT_FOUND: that one is worded for end users, this one for admins.
export const adminFlowNotFound = (flowId: string) =>
  new ApiError(404, 'ADMIN_FLOW_NOT_FOUND', `ไม่พบผังขั้นตอน '${flowId}'`);

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
const whenText = (epoch: number | null): string => (epoch === null ? '' : ` เมื่อ ${dateTimeFormatter.format(new Date(epoch * 1000))}`);

export const flowDeleted = (deletedByName: string | null, deletedEpoch: number | null) =>
  new ApiError(409, 'FLOW_DELETED', `ผังนี้ถูกลบแล้ว${deletedByName ? ` โดย ${deletedByName}` : ''}${whenText(deletedEpoch)}`);

// The message names who saved first, so the UI needs no extra fields to explain the conflict
export const flowEditConflict = (editedByName: string | null, editedEpoch: number | null) =>
  new ApiError(
    409,
    'FLOW_EDIT_CONFLICT',
    `มีผู้ดูแลคนอื่นบันทึกผังนี้ไปก่อนแล้ว${editedByName ? ` (${editedByName})` : ''}${whenText(editedEpoch)} ข้อความที่คุณแก้ยังอยู่ในฟอร์ม โหลดฉบับล่าสุดแล้วแก้ซ้ำ`,
  );

export const flowAlreadyDeleted = (deletedByName: string | null, deletedEpoch: number | null) =>
  new ApiError(409, 'FLOW_ALREADY_DELETED', `ผังนี้ถูกลบไปแล้ว${deletedByName ? ` โดย ${deletedByName}` : ''}${whenText(deletedEpoch)}`);

export const flowNotDeleted = () => new ApiError(409, 'FLOW_NOT_DELETED', 'ผังนี้ไม่ได้ถูกลบ จึงไม่ต้องกู้คืน');

export const flowReloadFailed = () =>
  new ApiError(500, 'FLOW_RELOAD_FAILED', 'บันทึกลงฐานข้อมูลแล้ว แต่โหลดผังเข้าระบบไม่สำเร็จ — ผังเดิมในหน่วยความจำยังใช้งานได้ ให้รีสตาร์ต backend');
