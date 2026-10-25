import { parseOptionalClientId, parseRequiredClientId } from '../traversal/traversal.dto';
import type { AuthUser } from './auth.middleware';
export type SessionOwner =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; clientId: string };

export function resolveRequiredOwner(user: AuthUser | undefined, clientIdHeader: unknown): SessionOwner {
  if (user) {
    return { kind: 'user', userId: user.sub };
  }
  return { kind: 'guest', clientId: parseRequiredClientId(clientIdHeader) };
}

export function resolveOptionalOwner(
  user: AuthUser | undefined,
  clientIdHeader: unknown,
): SessionOwner | undefined {
  if (user) {
    return { kind: 'user', userId: user.sub };
  }
  const clientId = parseOptionalClientId(clientIdHeader);
  return clientId === undefined ? undefined : { kind: 'guest', clientId };
}

export function ownerWhere(owner: SessionOwner): { sql: string; params: string[] } {
  if (owner.kind === 'user') {
    return { sql: '(user_id = ?)', params: [owner.userId] };
  }
  return { sql: '(client_id = ? AND user_id IS NULL)', params: [owner.clientId] };
}

export function ownerColumns(owner: SessionOwner | undefined): { userId: string | null; clientId: string | null } {
  if (owner === undefined) {
    return { userId: null, clientId: null };
  }
  return owner.kind === 'user'
    ? { userId: owner.userId, clientId: null }
    : { userId: null, clientId: owner.clientId };
}
