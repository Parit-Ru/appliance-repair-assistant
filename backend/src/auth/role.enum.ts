export enum Role {
  User = 'user',
  Admin = 'admin',
}

const ROLE_VALUES: readonly string[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value);
}
