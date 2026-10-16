/**
 * jwt-auth.guard.ts — ตรวจ "ล็อกอินแล้วหรือยัง" (401 ถ้ายัง)
 *
 * อ่าน Authorization: Bearer <token> → ตรวจลายเซ็น/วันหมดอายุ → วาง { sub, role } ไว้ที่ request.user
 * ไม่ใช้ passport (ตัดสินใจไว้แล้ว) ตรวจเองด้วย JwtService ของ @nestjs/jwt
 *
 * ใช้คู่กับ RolesGuard เมื่อต้องจำกัดบทบาท: @UseGuards(JwtAuthGuard, RolesGuard) — JwtAuthGuard ต้องมาก่อนเสมอ
 * endpoint ที่ไม่ใส่ guard นี้ยังเปิดสาธารณะเหมือนเดิม (traversal, history ใช้ X-Client-Id ตามเดิม)
 *
 * ความปลอดภัย:
 * - บังคับ algorithms: ['HS256'] ตอน verify กัน token ที่อ้างอัลกอริทึมอื่น
 * - เชื่อ payload เฉพาะเมื่อ sub เป็นข้อความไม่ว่างและ role เป็น Role จริง (isRole)
 * - ข้อความ 401 ทุกกรณีเหมือนกัน ไม่บอกว่าผิดเพราะอะไร (หมดอายุ / ลายเซ็นผิด / รูปแบบผิด)
 */

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { isRole, Role } from './role.enum';

/** สิ่งที่วางไว้ที่ request.user หลังผ่าน JwtAuthGuard */
export interface AuthUser {
  /** user id (users.id) */
  sub: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

const UNAUTHENTICATED_MESSAGE = 'กรุณาเข้าสู่ระบบ';

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== 'string') {
    return undefined;
  }
  const [scheme, token, ...rest] = header.split(' ');
  if (scheme !== 'Bearer' || !token || rest.length > 0) {
    return undefined;
  }
  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    let payload: { sub?: unknown; role?: unknown };
    try {
      payload = await this.jwtService.verifyAsync(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    if (typeof payload.sub !== 'string' || payload.sub === '' || !isRole(payload.role)) {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    request.user = { sub: payload.sub, role: payload.role };
    return true;
  }
}
