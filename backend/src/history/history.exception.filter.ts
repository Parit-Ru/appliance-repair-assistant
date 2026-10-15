/**
 * history.exception.filter.ts — แปลง error ของ /history ให้เป็น HTTP response
 *
 * รูปแบบเดียวกับ traversal.exception.filter.ts (ApiErrorBody ตัวเดียวกัน หน้าจอแปลงด้วย describeError)
 * error ของโมดูลนี้จัดการเอง ส่วนที่เหลือ (InvalidClientIdError, error ไม่รู้จัก → 500) ส่งต่อให้ toErrorBody ของ traversal
 * เพื่อไม่ต้องคัดลอกตารางซ้ำ
 */

import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { toErrorBody } from '../traversal/traversal.exception.filter';
import type { ApiErrorBody } from '../traversal/traversal.exception.filter';
import { InvalidFeedbackError, InvalidHistoryQueryError } from './history.dto';
import { HistoryNotFoundError } from './history.service';

export function toHistoryErrorBody(exception: unknown): ApiErrorBody {
  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';

  if (exception instanceof InvalidHistoryQueryError) {
    return { statusCode: 400, code: 'INVALID_HISTORY_QUERY', message };
  }
  if (exception instanceof InvalidFeedbackError) {
    return { statusCode: 400, code: 'INVALID_FEEDBACK', message };
  }
  if (exception instanceof HistoryNotFoundError) {
    return { statusCode: 404, code: 'HISTORY_NOT_FOUND', message };
  }

  return toErrorBody(exception);
}

@Catch()
export class HistoryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HistoryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toHistoryErrorBody(exception);

    // log เฉพาะ 500 เหมือน TraversalExceptionFilter
    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(body.statusCode).json(body);
  }
}
