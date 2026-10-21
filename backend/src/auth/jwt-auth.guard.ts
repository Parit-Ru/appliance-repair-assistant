import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { isRole, Role } from './role.enum';

export interface AuthUser {
  sub: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

const UNAUTHENTICATED_MESSAGE = 'กรุณาเข้าสู่ระบบ';

export async function verifyBearer(request: Request,jwtService: JwtService,): Promise<AuthUser | undefined> {
  const header = request.headers.authorization;
  if (header === undefined) {
    return undefined;
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
  }
  const token = parts[1];

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
