/**
 * error-handler.ts — แปลง error ทุกชนิดเป็น HTTP response (error middleware ตัวเดียวของทั้งแอป)
 *
 * ลงทะเบียนเป็น middleware ตัวท้ายสุดใน app.ts — route ไหนโยน error (หรือเรียก next(err)) ก็มาจบที่นี่
 * หน้าจอ (frontend/src/lib/errors.ts) ตัดสินจาก code ไม่ใช้ message
 *
 * ลำดับตัดสิน:
 *   1. JSON ที่ผิดไวยากรณ์จาก body parser (SyntaxError) / path ที่ถอดรหัส % ไม่ได้ (URIError)
 *        → 400 {message, error: 'Bad Request', statusCode} (รูปแบบเดิมของ NestJS ที่หน้าจอเคยได้)
 *   2. ApiError                          → status/code/message ตามที่โยนมา
 *   3. error ของ traversal-engine 4 ชนิด → ตารางด้านล่าง (engine ไม่รู้จัก HTTP จึงแปลงที่นี่)
 *   4. error ที่มี statusCode 4xx–5xx ของมันเอง (เช่น 413 body ใหญ่เกินจาก body parser) → {statusCode, message}
 *   5. ที่เหลือ (บั๊ก, error ของ mysql2, ค่าที่ไม่ใช่ Error) → 500 INTERNAL_ERROR เสมอ เพราะไม่รู้สาเหตุจริง
 *
 * ไฟล์นี้มีอีก 2 อย่างที่ใช้คู่กัน: notFoundHandler (404 ของ path ที่ไม่มี) และ asyncRoute (ส่ง error ของ handler แบบ async มาที่นี่)
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import {
  InvalidActionError,
  NodeNotFoundError,
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
} from '../traversal-engine/types';
import { ApiError } from './api-error';
import { createLogger } from './logger';

const logger = createLogger('ErrorHandler');

interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/** error ของ engine → HTTP */
const ENGINE_ERRORS: Array<[new (...args: never[]) => Error, number, string]> = [
  [SafetyConfirmationRequiredError, 400, 'SAFETY_CONFIRMATION_REQUIRED'],
  [InvalidActionError, 400, 'INVALID_ACTION'],
  [SessionAlreadyCompletedError, 409, 'SESSION_COMPLETED'],
  [NodeNotFoundError, 500, 'GRAPH_NODE_MISSING'],
];

/**
 * error ที่มากับรหัส HTTP ของมันเอง เช่น body ใหญ่เกิน (413) จาก body parser
 * ต้องเป็นจำนวนเต็มช่วง 4xx–5xx และมีข้อความ ไม่ตรง = ไม่ถือว่าเป็น error ประเภทนี้ (ตกไปเป็น 500 INTERNAL_ERROR)
 */
function hasHttpStatus(exception: unknown): exception is { statusCode: number; message: string } {
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

function toBody(exception: unknown): ApiErrorBody {
  if (exception instanceof ApiError) {
    return { statusCode: exception.status, code: exception.code, message: exception.message };
  }

  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';
  const engine = ENGINE_ERRORS.find(([errorClass]) => exception instanceof errorClass);
  if (engine) return { statusCode: engine[1], code: engine[2], message };

  return { statusCode: 500, code: 'INTERNAL_ERROR', message };
}

export function errorHandler(exception: unknown, _request: Request, response: Response, next: NextFunction): void {
  if (response.headersSent) {
    next(exception);
    return;
  }

  // 1. JSON ผิดไวยากรณ์ (body parser ใส่ type = 'entity.parse.failed') / path ถอดรหัสไม่ได้
  //    SyntaxError ที่เกิดใน handler เอง (เช่น ข้อมูลใน DB เสีย) ไม่เข้าข้อนี้ → ตกไปเป็น 500 ตามข้อ 5
  const fromBodyParser = exception instanceof SyntaxError && (exception as { type?: unknown }).type === 'entity.parse.failed';
  if (fromBodyParser || exception instanceof URIError) {
    response.status(400).json({ message: exception.message, error: 'Bad Request', statusCode: 400 });
    return;
  }

  // 4. error ที่มี status ของตัวเอง (ApiError มาก่อนเสมอ แม้จะมี statusCode ปนมา)
  if (!(exception instanceof ApiError) && hasHttpStatus(exception)) {
    response.status(exception.statusCode).json({ statusCode: exception.statusCode, message: exception.message });
    return;
  }

  const body = toBody(exception);
  // log เฉพาะ 5xx: 4xx เป็นผลที่คาดไว้ของการใช้งานปกติ (กรอกผิด, ไม่พบ, กดซ้ำ) ส่วน 5xx ต้องมี stack ให้ตามรอย
  if (body.statusCode >= 500) {
    logger.error(`[${body.code}] ${body.message}`, exception instanceof Error ? exception.stack : undefined);
  }
  response.status(body.statusCode).json(body);
}

/** path ที่ไม่มี route → 404 รูปแบบเดิม {message: 'Cannot GET /x', error: 'Not Found', statusCode: 404} */
export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({ message: `Cannot ${request.method} ${request.originalUrl}`, error: 'Not Found', statusCode: 404 });
}

/**
 * ห่อ handler แบบ async ให้ error (ทั้ง throw และ Promise ที่ล้ม) ไปถึง errorHandler
 * (Express 4 ไม่จับ error ของ async function ให้เอง)
 */
export function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    handler(request, response).catch(next);
  };
}
