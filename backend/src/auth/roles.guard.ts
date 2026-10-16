/**
 * roles.guard.ts — ตรวจ "บทบาทพอไหม" (403 ถ้าไม่พอ)
 *
 * ต้องวางหลัง JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard)
 * - ไม่มี @Roles บน handler/controller → ผ่าน (ใครล็อกอินแล้วก็เข้าได้)
 * - มี @Roles แต่ไม่มี request.user (ลืมใส่ JwtAuthGuard หรือเรียงผิด) → 401 ไม่ใช่ปล่อยผ่าน (ปฏิเสธไว้ก่อน)
 * - role ไม่อยู่ในรายการ → 403
 *
 * @Roles ที่ handler เหนือกว่าที่ controller (getAllAndOverride)
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from './jwt-auth.guard';
import { ROLES_KEY } from './roles.decorator';
import type { Role } from './role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงส่วนนี้');
    }
    return true;
  }
}
