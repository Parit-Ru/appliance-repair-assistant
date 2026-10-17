/**
 * admin.exception.filter.ts — แปลง error ของ /admin/* เป็น HTTP response รูปแบบ {statusCode, code, message}
 *
 * จุดสำคัญ: guard (JwtAuthGuard / RolesGuard) โยน UnauthorizedException / ForbiddenException ของ Nest
 * ถ้า controller ไม่ใส่ filter ที่รู้จักมัน (หรือใส่ filter ของโมดูลอื่น) จะกลายเป็น 500
 * ไฟล์นี้จึงส่งต่อให้ toAuthErrorBody ที่รู้จัก 401/403 อยู่แล้ว และเพิ่มเฉพาะ 400 ของ admin
 * (ตอนนี้ไม่มีเทสต์อัตโนมัติยืนยันเรื่องนี้ — ตรวจด้วยมือ: ไม่มี token ต้องได้ 401, ไม่ใช่ admin ต้องได้ 403)
 */

import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { toAuthErrorBody } from '../auth/auth.exception.filter';
import type { ApiErrorBody } from '../traversal/traversal.exception.filter';
import { InvalidAdminQueryError } from './admin.dto';

export function toAdminErrorBody(exception: unknown): ApiErrorBody {
  if (exception instanceof InvalidAdminQueryError) {
    return { statusCode: 400, code: 'INVALID_ADMIN_QUERY', message: exception.message };
  }
  return toAuthErrorBody(exception);
}

@Catch()
export class AdminExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AdminExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toAdminErrorBody(exception);

    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
