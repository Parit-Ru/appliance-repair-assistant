/**
 * drafts.exception.filter.ts — แปลง error ของ /admin/drafts เป็น HTTP response รูปแบบ {statusCode, code, message}
 *
 * ต้องติดที่ controller เสมอ (@UseFilters) ไม่งั้น 401/403 ของ guard และ 413 ของ multer กลายเป็น 500
 * error ที่ไม่รู้จักส่งต่อให้ตัวแปลงของ auth (→ 500 INTERNAL_ERROR)
 */

import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, Logger, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';

import { toAuthErrorBody } from '../auth/auth.exception.filter';
import type { ApiErrorBody } from '../traversal/traversal.exception.filter';
import { DraftParseError } from './draft-schema';
import {
  DraftBusyError,
  DraftIdConflictError,
  DraftInvalidError,
  DraftNotFoundError,
  DraftNotReadyError,
  InvalidDraftRequestError,
  PdfUnsupportedTypeError,
  PublishReloadError,
  WarningsNotAcknowledgedError,
} from './drafts.errors';
import { PdfNoTextError, PdfPageRangeError, PdfPageTooLongError, PdfTooManyPagesError, PdfUnreadableError } from './pdf-text';

export function toDraftsErrorBody(exception: unknown): ApiErrorBody {
  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';

  if (exception instanceof InvalidDraftRequestError || exception instanceof PdfPageRangeError || exception instanceof DraftParseError) {
    return { statusCode: 400, code: 'INVALID_DRAFT_REQUEST', message };
  }
  // multer: ไฟล์ใหญ่เกิน (LIMIT_FILE_SIZE) → Nest แปลงเป็น PayloadTooLargeException · อย่างอื่น (ฟิลด์เกิน ชื่อฟิลด์ผิด) → BadRequestException
  if (exception instanceof PayloadTooLargeException) {
    return { statusCode: 413, code: 'PDF_TOO_LARGE', message: 'ไฟล์ใหญ่เกินที่รองรับ' };
  }
  if (exception instanceof BadRequestException) {
    return { statusCode: 400, code: 'INVALID_DRAFT_REQUEST', message: 'คำขออัปโหลดไม่ถูกต้อง (ส่งไฟล์เดียวในฟิลด์ชื่อ file และฟิลด์ข้อความตามที่กำหนด)' };
  }
  if (exception instanceof PdfTooManyPagesError) return { statusCode: 413, code: 'PDF_TOO_LARGE', message };
  if (exception instanceof PdfUnsupportedTypeError) return { statusCode: 415, code: 'PDF_UNSUPPORTED_TYPE', message };
  if (exception instanceof PdfNoTextError) return { statusCode: 422, code: 'PDF_NO_TEXT', message };
  if (exception instanceof PdfUnreadableError) return { statusCode: 422, code: 'PDF_UNREADABLE', message };
  if (exception instanceof PdfPageTooLongError) return { statusCode: 422, code: 'PDF_PAGE_TOO_LONG', message };
  if (exception instanceof DraftNotFoundError) return { statusCode: 404, code: 'DRAFT_NOT_FOUND', message };
  if (exception instanceof DraftNotReadyError) return { statusCode: 409, code: 'DRAFT_NOT_READY', message };
  if (exception instanceof DraftBusyError) return { statusCode: 409, code: 'DRAFT_BUSY', message };
  if (exception instanceof DraftInvalidError) return { statusCode: 409, code: 'DRAFT_INVALID', message };
  if (exception instanceof WarningsNotAcknowledgedError) return { statusCode: 409, code: 'DRAFT_WARNINGS_UNACKNOWLEDGED', message };
  if (exception instanceof DraftIdConflictError) return { statusCode: 409, code: 'DRAFT_ID_CONFLICT', message };
  if (exception instanceof PublishReloadError) return { statusCode: 500, code: 'PUBLISH_RELOAD_FAILED', message };

  return toAuthErrorBody(exception);
}

@Catch()
export class DraftsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DraftsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toDraftsErrorBody(exception);

    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
