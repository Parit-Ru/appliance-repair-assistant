import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../common/api-error';
import { isRole, Role } from './role.enum';
import type { TokenService } from './token';

export interface AuthUser {
  sub: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

export function currentUser(request: Request): AuthUser | undefined {
  return (request as AuthenticatedRequest).user;
}

const UNAUTHENTICATED_MESSAGE = 'กรุณาเข้าสู่ระบบ';
const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE);

function readUser(request: Request, tokens: TokenService): AuthUser | undefined {
  const header = request.headers.authorization;
  if (header === undefined) {
    return undefined;
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw unauthenticated();
  }

  let payload: { sub?: unknown; role?: unknown };
  try {
    payload = tokens.verify(parts[1]);
  } catch {
    throw unauthenticated();
  }

  if (typeof payload.sub !== 'string' || payload.sub === '' || !isRole(payload.role)) {
    throw unauthenticated();
  }
  return { sub: payload.sub, role: payload.role };
}

export function createAuthMiddleware(tokens: TokenService): {
  optionalAuth: RequestHandler;
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
} {
  function optionalAuth(request: AuthenticatedRequest, _response: Response, next: NextFunction): void {
    try {
      const user = readUser(request, tokens);
      if (user) request.user = user;
      next();
    } catch (err) {
      next(err);
    }
  }

  function requireAuth(request: AuthenticatedRequest, _response: Response, next: NextFunction): void {
    try {
      const user = readUser(request, tokens);
      if (!user) throw unauthenticated();
      request.user = user;
      next();
    } catch (err) {
      next(err);
    }
  }

  function requireAdmin(request: AuthenticatedRequest, _response: Response, next: NextFunction): void {
    if (!request.user) {
      next(unauthenticated());
      return;
    }
    if (request.user.role !== Role.Admin) {
      next(new ApiError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้'));
      return;
    }
    next();
  }

  return { optionalAuth, requireAuth, requireAdmin };
}
