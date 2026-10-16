/**
 * auth.exception.filter.ts — แปลง error ของ /auth และของ guard (401/403) ให้เป็น HTTP response
 *
 * รูปแบบเดียวกับ history.exception.filter.ts (ApiErrorBody ตัวเดียวกัน)
 *
 * ทำไมต้องรู้จัก HttpException: JwtAuthGuard / RolesGuard โยน UnauthorizedException / ForbiddenException ของ Nest
 * แต่ filter ของโมดูลอื่น (toErrorBody ของ traversal) ไม่รู้จักมัน → จะกลายเป็น 500
 * ดังนั้น controller ใดก็ตามที่ใช้ JwtAuthGuard/RolesGuard (เช่น admin endpoint ใน Step 3)
 * ต้องใส่ @UseFilters(AuthExceptionFilter) ด้วย
 *
 * ตาราง code:
 *   400 INVALID_AUTH_REQUEST  body ผิดรูปแบบ
 *   401 INVALID_CREDENTIALS   อีเมล/รหัสผ่านไม่ถูกต้อง (ข้อความเดียวทุกกรณี)
 *   401 UNAUTHENTICATED       ไม่มี/ใช้ token ไม่ได้
 *   403 FORBIDDEN             ล็อกอินแล้วแต่บทบาทไม่พอ
 *   409 EMAIL_TAKEN           อีเมลซ้ำตอนสมัคร
 *   อื่นๆ ส่งต่อให้ toErrorBody ของ traversal (ไม่รู้จัก → 500 INTERNAL_ERROR)
 */

import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException, HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';

import { toErrorBody } from '../traversal/traversal.exception.filter';
import type { ApiErrorBody } from '../traversal/traversal.exception.filter';
import { InvalidAuthRequestError } from './auth.dto';
import { EmailTakenError, InvalidCredentialsError } from './auth.service';

/** ข้อความใน HttpException อาจเป็น string หรือ object ({ message }) */
function httpExceptionMessage(exception: HttpException, fallback: string): string {
  const response = exception.getResponse();
  if (typeof response === 'string' && response !== '') {
    return response;
  }
  if (typeof response === 'object' && response !== null) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }
  return fallback;
}

export function toAuthErrorBody(exception: unknown): ApiErrorBody {
  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';

  if (exception instanceof InvalidAuthRequestError) {
    return { statusCode: 400, code: 'INVALID_AUTH_REQUEST', message };
  }
  if (exception instanceof InvalidCredentialsError) {
    return { statusCode: 401, code: 'INVALID_CREDENTIALS', message };
  }
  if (exception instanceof EmailTakenError) {
    return { statusCode: 409, code: 'EMAIL_TAKEN', message };
  }
  if (exception instanceof UnauthorizedException) {
    return { statusCode: 401, code: 'UNAUTHENTICATED', message: httpExceptionMessage(exception, 'กรุณาเข้าสู่ระบบ') };
  }
  if (exception instanceof ForbiddenException) {
    return { statusCode: 403, code: 'FORBIDDEN', message: httpExceptionMessage(exception, 'ไม่มีสิทธิ์เข้าถึงส่วนนี้') };
  }

  return toErrorBody(exception);
}

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toAuthErrorBody(exception);

    // log เฉพาะ 500 เหมือน filter อื่น: 400/401/403/409 เป็นผลที่คาดไว้ของการใช้งานปกติ
    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(body.statusCode).json(body);
  }
}
