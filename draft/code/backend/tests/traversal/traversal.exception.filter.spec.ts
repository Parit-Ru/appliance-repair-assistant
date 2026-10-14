// backend/src/traversal/traversal.exception.filter.spec.ts

/**
 * เทสตารางแปลง error → HTTP response ของ TraversalExceptionFilter (toErrorBody)
 * เฉพาะส่วนของผลลัพธ์ที่ผู้ใช้กรอก + แถวเดิมที่ใกล้เคียงกัน กันรหัสสลับกัน
 *
 * toErrorBody เป็นฟังก์ชันล้วน (รับ error คืน object) เทสได้โดยไม่ต้องปลอม ArgumentsHost ของ NestJS
 * ตัวคลาส filter เองแค่เรียกฟังก์ชันนี้แล้วเขียนลง response จึงไม่ต้องเทสแยก
 */

import { InvalidOutcomeError, InvalidRequestBodyError } from './traversal.dto';
import { toErrorBody } from './traversal.exception.filter';
import {
  OutcomeAlreadySubmittedError,
  SessionNotCompletedError,
  SessionNotFoundError,
} from './traversal.service';

describe('toErrorBody — ผลลัพธ์ที่ผู้ใช้กรอก', () => {
  it('InvalidOutcomeError → 400 INVALID_OUTCOME', () => {
    expect(toErrorBody(new InvalidOutcomeError('text ต้องไม่ว่าง'))).toEqual({
      statusCode: 400,
      code: 'INVALID_OUTCOME',
      message: 'text ต้องไม่ว่าง',
    });
  });

  it('SessionNotCompletedError → 409 SESSION_NOT_COMPLETED', () => {
    const body = toErrorBody(new SessionNotCompletedError('s1'));
    expect(body.statusCode).toBe(409);
    expect(body.code).toBe('SESSION_NOT_COMPLETED');
  });

  it('OutcomeAlreadySubmittedError → 409 OUTCOME_ALREADY_SUBMITTED', () => {
    const body = toErrorBody(new OutcomeAlreadySubmittedError('s1'));
    expect(body.statusCode).toBe(409);
    expect(body.code).toBe('OUTCOME_ALREADY_SUBMITTED');
  });

  it('รหัสของผลลัพธ์ไม่ปนกับรหัสเดิม: body ผิดของ /actions ยังเป็น INVALID_ACTION · ไม่พบ session ยังเป็น 404', () => {
    expect(toErrorBody(new InvalidRequestBodyError('x')).code).toBe('INVALID_ACTION');
    expect(toErrorBody(new SessionNotFoundError('s1'))).toMatchObject({
      statusCode: 404,
      code: 'SESSION_NOT_FOUND',
    });
  });

  it('error ที่ไม่รู้จักยังเป็น 500 INTERNAL_ERROR เสมอ (ไม่ถูกจับเป็นรหัสผลลัพธ์โดยบังเอิญ)', () => {
    expect(toErrorBody(new Error('บั๊กอะไรสักอย่าง'))).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(toErrorBody('ไม่ใช่ Error')).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });
});
