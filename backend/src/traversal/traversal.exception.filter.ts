/**
 * traversal.exception.filter.ts — แปลง error ที่เกิดใน TraversalController ให้เป็น HTTP response
 *
 * ใช้ instanceof กับคลาส error โดยตรง ไม่จับจากข้อความ (error.message) เพราะข้อความ
 * เขียนไว้ให้นักพัฒนาอ่าน เปลี่ยนได้ตลอดโดยไม่ควรกระทบพฤติกรรมของ API
 *
 * error ที่ต้องรู้จักมาจาก 3 ที่: traversal-engine/types.ts (การเดินเครื่องสถานะ),
 * traversal.service.ts (หาผัง/session ไม่เจอ, session ยังไม่จบ, บันทึกผลลัพธ์ซ้ำ)
 * และ traversal.dto.ts (body ผิดรูปแบบ, ข้อความผลลัพธ์ใช้ไม่ได้)
 *
 * toErrorBody() แยกออกจากคลาส filter เพราะเป็นตรรกะล้วน (รับ error คืน object)
 * ทดสอบได้โดยไม่ต้องปลอม ArgumentsHost/Response ของ NestJS
 * ส่วนคลาส filter แค่เรียกมันแล้วเขียนผลลง HTTP response
 *
 * ข้อจำกัดที่รู้อยู่: filter ทำงานเฉพาะ error ที่เกิด "ระหว่าง" รัน route handler
 * ถ้า body เป็น JSON ที่ผิดไวยากรณ์ (เช่น `{`) Express โยน SyntaxError จาก body-parser เอง
 * ก่อนถึง route handler filter นี้จึงไม่ทำงาน (ต่างจาก JSON ที่ถูกแต่ field ผิด
 * ซึ่ง parseTraversalAction จับได้ตามปกติ)
 */

import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { InvalidOutcomeError, InvalidRequestBodyError } from './traversal.dto';
import {
  GraphNotFoundError,
  OutcomeAlreadySubmittedError,
  SessionNotCompletedError,
  SessionNotFoundError,
} from './traversal.service';
import {
  InvalidActionError,
  NodeNotFoundError,
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
  UnsupportedSchemaVersionError,
} from '../traversal-engine/types';

/** รูปร่าง response ตอน error ทุกกรณี ตรงกับ ApiErrorBody ฝั่งหน้าจอ */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/**
 * ตารางแปลง error → HTTP response
 *
 * ลำดับการเช็คสลับกันได้ เพราะ error ทุกชนิดเป็นพี่น้องกัน (extends Error หรือ TraversalError
 * โดยตรง) ไม่มีคลาสไหนเป็น superclass ของอีกคลาส
 *
 * แถวสุดท้ายดักทุกอย่างที่ไม่รู้จัก — บั๊กที่ยังไม่เจอ, error จาก mysql2 เอง,
 * หรือ error ชนิดที่ยังไม่ได้เพิ่มเข้าตารางนี้ ต้องเป็น 500 เสมอ เพราะไม่รู้สาเหตุจริง
 * ใช้ INTERNAL_ERROR ไม่ใช่ UNKNOWN_ERROR ที่ mock ฝั่งหน้าจอใช้
 */
export function toErrorBody(exception: unknown): ApiErrorBody {
  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';

  if (exception instanceof SafetyConfirmationRequiredError) {
    return { statusCode: 400, code: 'SAFETY_CONFIRMATION_REQUIRED', message };
  }
  if (exception instanceof InvalidActionError) {
    return { statusCode: 400, code: 'INVALID_ACTION', message };
  }
  if (exception instanceof InvalidRequestBodyError) {
    // ใช้ code เดียวกับ InvalidActionError เพราะสองแถวนี้ต่างกันแค่ "ผิดตอนไหน"
    // แต่ผู้ใช้เห็นข้อความไทยเดียวกัน
    return { statusCode: 400, code: 'INVALID_ACTION', message };
  }
  if (exception instanceof InvalidOutcomeError) {
    // ข้อความผลลัพธ์ผิดรูปแบบ (ว่าง/ยาวเกิน/ไม่ใช่ข้อความ) ใช้รหัสของตัวเอง ไม่ปนกับ INVALID_ACTION
    return { statusCode: 400, code: 'INVALID_OUTCOME', message };
  }
  if (exception instanceof SessionAlreadyCompletedError) {
    return { statusCode: 409, code: 'SESSION_COMPLETED', message };
  }
  if (exception instanceof SessionNotCompletedError) {
    // ตรงข้ามกับ SESSION_COMPLETED: บันทึกผลลัพธ์ได้เฉพาะ session ที่จบแล้ว
    return { statusCode: 409, code: 'SESSION_NOT_COMPLETED', message };
  }
  if (exception instanceof OutcomeAlreadySubmittedError) {
    return { statusCode: 409, code: 'OUTCOME_ALREADY_SUBMITTED', message };
  }
  if (exception instanceof SessionNotFoundError) {
    return { statusCode: 404, code: 'SESSION_NOT_FOUND', message };
  }
  if (exception instanceof GraphNotFoundError) {
    return { statusCode: 404, code: 'GRAPH_NOT_FOUND', message };
  }
  if (exception instanceof NodeNotFoundError) {
    return { statusCode: 500, code: 'GRAPH_NODE_MISSING', message };
  }
  if (exception instanceof UnsupportedSchemaVersionError) {
    return { statusCode: 500, code: 'GRAPH_SCHEMA_UNSUPPORTED', message };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message };
}

@Catch()
export class TraversalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TraversalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);

    // log เฉพาะ 500 เท่านั้น: 400/404/409 เป็นผลที่คาดไว้แล้วของการใช้งานปกติ
    // (กรอกผิด, session หมดอายุ, กดซ้ำ) ไม่ใช่เรื่องที่นักพัฒนาต้องมานั่งไล่ดู log
    // ส่วน 500 ทุกกรณีคือสิ่งที่ไม่ควรเกิด (ข้อมูลกราฟเสีย, บั๊ก, หรือ error ที่ยังไม่รู้จัก)
    // จึงต้องมี stack trace ให้ตามรอยได้เสมอ
    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`[${body.code}] ${body.message}`, stack);
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(body.statusCode).json(body);
  }
}