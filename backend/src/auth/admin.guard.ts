/**
 * admin.guard.ts — ด่าน "ต้องเป็น admin" (403 ถ้าไม่ใช่)
 *
 * ต้องวางหลัง JwtAuthGuard: @UseGuards(JwtAuthGuard, AdminGuard) — JwtAuthGuard เป็นคนวาง request.user ให้
 * - ไม่มี request.user (ลืมใส่ JwtAuthGuard หรือเรียงผิด) → 401 ไม่ใช่ปล่อยผ่าน (ปฏิเสธไว้ก่อน)
 * - ไม่ใช่ admin → 403
 *
 * ไฟล์นี้ไม่ import อะไรจาก NestJS เลย: Nest เรียกเมธอด canActivate() ของคลาสที่ใส่ใน @UseGuards ได้เองโดยไม่ต้อง implements
 * error ใช้ ApiError ของโปรเจกต์ (AllExceptionsFilter แปลงเป็น {statusCode, code, message} เหมือน exception ของ Nest ทุกประการ)
 * ใช้เป็น guard (ไม่ใช่ฟังก์ชันที่เรียกในแต่ละ handler) เพื่อให้ตรวจก่อนรับไฟล์อัปโหลดของ multer และลืมใส่ที่ handler ไม่ได้
 */

import { ApiError } from '../common/api-error';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { Role } from './role.enum';

/** ส่วนของ ExecutionContext (ของ Nest) ที่ใช้จริง — เขียนเป็นชนิดของเราเองจะได้ไม่ต้อง import */
interface RequestContext {
  switchToHttp(): { getRequest(): AuthenticatedRequest };
}

export class AdminGuard {
  canActivate(context: RequestContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ');
    }
    if (user.role !== Role.Admin) {
      throw new ApiError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
    }
    return true;
  }
}
