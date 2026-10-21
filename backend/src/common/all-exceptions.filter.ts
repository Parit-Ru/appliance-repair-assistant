import { ArgumentsHost, Catch, ForbiddenException, HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import {InvalidActionError,NodeNotFoundError,SafetyConfirmationRequiredError,SessionAlreadyCompletedError,} from '../traversal-engine/types';
import { ApiError } from './api-error';

interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

// error ของ engine → HTTP (ลูกพี่น้องกันทั้งหมด ลำดับสลับกันได้) 
const ENGINE_ERRORS: Array<[abstract new (...args: never[]) => Error, number, string]> = [
  [SafetyConfirmationRequiredError, 400, 'SAFETY_CONFIRMATION_REQUIRED'],
  [InvalidActionError, 400, 'INVALID_ACTION'],
  [SessionAlreadyCompletedError, 409, 'SESSION_COMPLETED'],
  [NodeNotFoundError, 500, 'GRAPH_NODE_MISSING'],
];

/** ข้อความใน HttpException อาจเป็น string หรือ object ({ message }) */
function httpExceptionMessage(exception: HttpException, fallback: string): string {
  const response = exception.getResponse();
  if (typeof response === 'string' && response !== '') return response;
  if (typeof response === 'object' && response !== null) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return fallback;
}

/*
  error ที่มากับรหัส HTTP ของมันเอง เช่น body ใหญ่เกิน (413) จาก body-parser ของ Express ซึ่งไม่ใช่ HttpException ของ Nest
  ต้องเป็นรหัสจำนวนเต็มช่วง 4xx–5xx และมีข้อความ ไม่ตรง = ไม่ถือว่าเป็น error ประเภทนี้ (ตกไปเป็น 500 INTERNAL_ERROR)
 */
function hasHttpStatus(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false;
  const { statusCode, message } = exception as { statusCode?: unknown; message?: unknown };
  return (
    typeof statusCode === 'number' &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599 &&
    typeof message === 'string' &&
    message !== ''
  );
}

// undefined = ปล่อยให้ Nest ตอบเอง (HttpException ที่เราไม่ได้กำหนดรหัสไว้ หรือ error ที่มากับรหัส HTTP ของมันเอง) */
function toBody(exception: unknown): ApiErrorBody | undefined {
  if (exception instanceof ApiError) {
    return { statusCode: exception.status, code: exception.code, message: exception.message };
  }

  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';

  const engine = ENGINE_ERRORS.find(([errorClass]) => exception instanceof errorClass);
  if (engine) return { statusCode: engine[1], code: engine[2], message };

  if (exception instanceof UnauthorizedException) {
    return { statusCode: 401, code: 'UNAUTHENTICATED', message: httpExceptionMessage(exception, 'กรุณาเข้าสู่ระบบ') };
  }
  if (exception instanceof ForbiddenException) {
    return { statusCode: 403, code: 'FORBIDDEN', message: httpExceptionMessage(exception, 'ไม่มีสิทธิ์เข้าถึงส่วนนี้') };
  }
  if (exception instanceof HttpException || hasHttpStatus(exception)) return undefined;

  return { statusCode: 500, code: 'INTERNAL_ERROR', message };
}

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  override catch(exception: unknown, host: ArgumentsHost): void {
    const body = toBody(exception);
    if (body === undefined) {
      super.catch(exception, host);
      return;
    }

    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
