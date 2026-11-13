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

// ApiError carries only a message, so the first issues are written into it (code + state + text)
const MAX_ISSUES_SHOWN = 5;
const describeIssues = (issues: Array<{ code: string; message: string; stateId?: string }>): string => {
  const shown = issues.slice(0, MAX_ISSUES_SHOWN).map((i) => `[${i.code}${i.stateId ? ` ${i.stateId}` : ''}] ${i.message}`);
  const rest = issues.length - shown.length;
  return shown.join(' · ') + (rest > 0 ? ` · …และอีก ${rest} ข้อ` : '');
};

export const structureInvalid = (errors: Array<{ code: string; message: string; stateId?: string }>) =>
  new ApiError(409, 'FLOW_STRUCTURE_INVALID', `โครงสร้างผังไม่ผ่านการตรวจ (${errors.length} error) ไม่มีทางข้ามการตรวจ: ${describeIssues(errors)}`);

export const structureWarningsUnacknowledged = (warnings: Array<{ code: string; message: string; stateId?: string }>) =>
  new ApiError(
    409,
    'FLOW_STRUCTURE_WARNINGS_UNACKNOWLEDGED',
    `โครงสร้างผังมีคำเตือน ${warnings.length} ข้อ ต้องอ่านและส่ง acknowledgedWarnings: true ยืนยันก่อนบันทึก: ${describeIssues(warnings)}`,
  );

export const stateInUse = (stateIds: string[]) =>
  new ApiError(
    409,
    'FLOW_STATE_IN_USE',
    `ลบขั้นตอนไม่ได้เพราะมีผู้ใช้กำลังเดินผังอยู่ที่ขั้นตอนนี้: ${stateIds.join(', ')} (ลบได้เมื่อ session เหล่านั้นจบหรือหมดอายุ)`,
  );

// Same code as stateInUse (the UI shows the server text): the state stays, but a session standing on it would meet a different kind of step
export const stateTypeInUse = (stateIds: string[]) =>
  new ApiError(
    409,
    'FLOW_STATE_IN_USE',
    `เปลี่ยนชนิดของขั้นตอนไม่ได้เพราะมีผู้ใช้กำลังเดินผังอยู่ที่ขั้นตอนนี้: ${stateIds.join(', ')} (แก้ข้อความหรือเส้นทางได้ แต่ชนิดต้องคงเดิมจนกว่า session เหล่านั้นจบหรือหมดอายุ)`,
  );

export const flowReloadFailed = () =>
  new ApiError(500, 'FLOW_RELOAD_FAILED', 'บันทึกลงฐานข้อมูลแล้ว แต่โหลดผังเข้าระบบไม่สำเร็จ — ผังเดิมในหน่วยความจำยังใช้งานได้ ให้รีสตาร์ต backend');
