/**
 * jwt-auth.guard.ts — ตรวจ "ล็อกอินแล้วหรือยัง" (401 ถ้ายัง)
 *
 * อ่าน Authorization: Bearer <token> → ตรวจลายเซ็น/วันหมดอายุ → วาง { sub, role } ไว้ที่ request.user
 * ไม่ใช้ passport (ตัดสินใจไว้แล้ว) ตรวจเองด้วย JwtService ของ @nestjs/jwt
 *
 * ใช้คู่กับ RolesGuard เมื่อต้องจำกัดบทบาท: @UseGuards(JwtAuthGuard, RolesGuard) — JwtAuthGuard ต้องมาก่อนเสมอ
 * endpoint ที่ไม่ใส่ guard นี้ยังเปิดสาธารณะเหมือนเดิม
 *
 * verifyBearer() แยกออกมาเป็นฟังก์ชันกลาง ใช้ร่วมกับ OptionalJwtAuthGuard (guest ได้ แต่ token เสีย = 401)
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

function extractBearerToken(header: string): string | undefined {
  const [scheme, token, ...rest] = header.split(' ');
  if (scheme !== 'Bearer' || !token || rest.length > 0) {
    return undefined;
  }
  return token;
}

/**
 * ตรวจ Authorization header ของคำขอ
 * - ไม่มี header เลย → undefined (ผู้เรียกตัดสินเองว่าจะ 401 หรือปล่อยเป็น guest)
 * - มี header แต่รูปแบบผิด / token เสีย / หมดอายุ / payload ผิด → โยน 401 เสมอ (ไม่แอบลดเป็น guest)
 * - ถูกต้อง → { sub, role }
 */
export async function verifyBearer(
  request: Request,
  jwtService: JwtService,
): Promise<AuthUser | undefined> {
  const header = request.headers.authorization;
  if (header === undefined) {
    return undefined;
  }

  const token = typeof header === 'string' ? extractBearerToken(header) : undefined;
  if (!token) {
    throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
  }

  let payload: { sub?: unknown; role?: unknown };
  try {
    payload = await jwtService.verifyAsync(token, { algorithms: ['HS256'] });
  } catch {
    throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
  }

  if (typeof payload.sub !== 'string' || payload.sub === '' || !isRole(payload.role)) {
    throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
  }

  return { sub: payload.sub, role: payload.role };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = await verifyBearer(request, this.jwtService);
    if (!user) {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    request.user = user;
    return true;
  }
}
