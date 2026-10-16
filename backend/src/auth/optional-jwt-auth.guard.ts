/**
 * optional-jwt-auth.guard.ts — "ล็อกอินหรือเป็น guest ก็ได้"
 *
 * ใช้กับ endpoint ที่ guest ต้องใช้ได้เหมือนเดิม (เดินขั้นตอน, ประวัติด้วย X-Client-Id) แต่ถ้าล็อกอินจะรู้ว่าเป็นใคร:
 *   - ไม่มี Authorization เลย        → ผ่าน เป็น guest (request.user เป็น undefined)
 *   - Bearer ถูกต้อง                 → ผ่าน และวาง request.user = { sub, role }
 *   - มี Authorization แต่ใช้ไม่ได้    → 401 (token เสีย/หมดอายุ/รูปแบบผิด) ไม่แอบลดเป็น guest
 *     เพราะผู้ใช้จะงงว่าประวัติของตัวเองหายไปไหน หน้าจอ (Step 4) ต้องจัดการ 401 ด้วยการพาไปล็อกอินใหม่
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { verifyBearer } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = await verifyBearer(request, this.jwtService);
    if (user) {
      request.user = user;
    }
    return true;
  }
}
