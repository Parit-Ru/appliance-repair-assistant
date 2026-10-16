import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { Role } from './role.enum';

function fakeJwt(verify: (token: string) => unknown): JwtService {
  return {
    verifyAsync: async (token: string) => {
      const result = verify(token);
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as JwtService;
}

function contextWith(authorization?: string): { context: ExecutionContext; request: { headers: object; user?: unknown } } {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: authorization === undefined ? {} : { authorization },
  };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { context, request };
}

const goodJwt = fakeJwt((token) =>
  token === 'good' ? { sub: 'user-a', role: Role.User } : new Error('invalid signature'),
);

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard(goodJwt);

  it('ไม่มี Authorization → ผ่านเป็น guest (request.user ว่าง)', async () => {
    const { context, request } = contextWith();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('Bearer ถูกต้อง → ผ่านและวาง request.user', async () => {
    const { context, request } = contextWith('Bearer good');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'user-a', role: Role.User });
  });

  it('token เสีย/หมดอายุ → 401 ไม่แอบลดเป็น guest', async () => {
    const { context } = contextWith('Bearer expired');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('รูปแบบ Authorization ผิด (ไม่ใช่ Bearer / ว่าง) → 401', async () => {
    await expect(guard.canActivate(contextWith('Basic abc').context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(contextWith('').context)).rejects.toThrow(UnauthorizedException);
  });

  it('payload ผิดรูป (role ไม่รู้จัก) → 401', async () => {
    const odd = new OptionalJwtAuthGuard(fakeJwt(() => ({ sub: 'user-a', role: 'root' })));
    await expect(odd.canActivate(contextWith('Bearer x').context)).rejects.toThrow(UnauthorizedException);
  });
});

describe('JwtAuthGuard (ยังบังคับล็อกอินเหมือนเดิมหลังแยก verifyBearer)', () => {
  const guard = new JwtAuthGuard(goodJwt);

  it('ไม่มี Authorization → 401', async () => {
    await expect(guard.canActivate(contextWith().context)).rejects.toThrow(UnauthorizedException);
  });

  it('Bearer ถูกต้อง → ผ่าน', async () => {
    const { context, request } = contextWith('Bearer good');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'user-a', role: Role.User });
  });
});
