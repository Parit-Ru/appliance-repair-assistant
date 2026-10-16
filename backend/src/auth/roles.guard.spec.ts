import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from './role.enum';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class Sample {
  open() {}

  @Roles(Role.Admin)
  adminOnly() {}

  @Roles(Role.User, Role.Admin)
  anyRole() {}
}

function contextFor(handler: () => void, user?: { sub: string; role: Role }): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Sample,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const sample = new Sample();

  it('ไม่มี @Roles → ผ่านทุกบทบาท (และแม้ไม่มี user)', () => {
    expect(guard.canActivate(contextFor(sample.open, { sub: 'u1', role: Role.User }))).toBe(true);
    expect(guard.canActivate(contextFor(sample.open))).toBe(true);
  });

  it('@Roles(Admin) + admin → ผ่าน', () => {
    expect(guard.canActivate(contextFor(sample.adminOnly, { sub: 'u1', role: Role.Admin }))).toBe(true);
  });

  it('@Roles(Admin) + user → 403', () => {
    expect(() => guard.canActivate(contextFor(sample.adminOnly, { sub: 'u1', role: Role.User }))).toThrow(
      ForbiddenException,
    );
  });

  it('@Roles(Admin) + ไม่มี user (ลืม JwtAuthGuard) → 401 ไม่ปล่อยผ่าน', () => {
    expect(() => guard.canActivate(contextFor(sample.adminOnly))).toThrow(UnauthorizedException);
  });

  it('@Roles หลายบทบาท → บทบาทใดบทบาทหนึ่งก็ผ่าน', () => {
    expect(guard.canActivate(contextFor(sample.anyRole, { sub: 'u1', role: Role.User }))).toBe(true);
  });
});
