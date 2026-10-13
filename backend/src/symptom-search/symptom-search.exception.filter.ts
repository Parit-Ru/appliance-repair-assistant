/**
 * symptom-search.exception.filter.ts — แปลง error ของงานค้นหาอาการเป็น HTTP response
 *
 * แนวเดียวกับ traversal.exception.filter.ts: ใช้ instanceof กับคลาส error โดยตรง
 * ไม่จับจากข้อความ (message) และแยก toErrorBody() ออกมาเป็นฟังก์ชันล้วนให้เทสได้
 * โดยไม่ต้องปลอม ArgumentsHost ของ NestJS
 *
 * ตารางแปลง:
 *   InvalidSearchQueryError → 400 INVALID_QUERY        (body ผิดรูปแบบ)
 *   SearchNotReadyError     → 503 SEARCH_NOT_READY     (กำลังโหลดโมเดล ลองใหม่ได้)
 *   SearchUnavailableError  → 503 SEARCH_UNAVAILABLE   (ปิดอยู่หรือโหลดไม่สำเร็จ)
 *   อื่นๆ ทั้งหมด            → 500 INTERNAL_ERROR
 *
 * ขอบเขตที่รู้อยู่แล้ว (เหมือน traversal filter): JSON ที่ผิดไวยากรณ์ล้วนๆ (เช่น `{`)
 * ถูก body-parser ของ Express โยนก่อนถึง route handler จึงไม่ผ่าน filter นี้
 */

import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import type { ApiErrorBody } from '../traversal/traversal.exception.filter';
import { InvalidSearchQueryError } from './symptom-search.dto';
import {
  SearchNotReadyError,
  SearchUnavailableError,
} from './symptom-search.service';

export function toErrorBody(exception: unknown): ApiErrorBody {
  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';

  if (exception instanceof InvalidSearchQueryError) {
    return { statusCode: 400, code: 'INVALID_QUERY', message };
  }
  if (exception instanceof SearchNotReadyError) {
    return { statusCode: 503, code: 'SEARCH_NOT_READY', message };
  }
  if (exception instanceof SearchUnavailableError) {
    return { statusCode: 503, code: 'SEARCH_UNAVAILABLE', message };
  }

  // ทุกอย่างที่ไม่รู้จัก ต้องเป็น 500 เสมอ เพราะไม่รู้สาเหตุจริง
  return { statusCode: 500, code: 'INTERNAL_ERROR', message };
}

@Catch()
export class SymptomSearchExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SymptomSearchExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);

    // log เฉพาะ 500: ส่วน 400 และ 503 เป็นผลที่คาดไว้ (กรอกผิด, ระบบยังโหลดอยู่/ปิดอยู่)
    // และสถานะของระบบดูได้จาก GET /symptom-search/status อยู่แล้ว
    if (body.statusCode === 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(body.statusCode).json(body);
  }
}