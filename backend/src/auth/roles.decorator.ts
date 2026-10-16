/**
 * roles.decorator.ts — @Roles(Role.Admin) ระบุว่า endpoint/controller นี้ต้องมีบทบาทอย่างใดอย่างหนึ่งที่ให้ไว้
 *
 * ตัวมันเองไม่บังคับอะไร แค่ติดป้าย (metadata) ให้ RolesGuard อ่าน — ต้องใช้คู่:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(Role.Admin)
 * endpoint ที่ไม่มี @Roles = ผู้ที่ล็อกอินแล้วทุกบทบาทเข้าได้ (ถ้ามี JwtAuthGuard)
 */

import { SetMetadata } from '@nestjs/common';

import type { Role } from './role.enum';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
