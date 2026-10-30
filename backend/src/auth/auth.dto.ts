import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import type { Role } from './role.enum';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL_LENGTH = 255;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_LOGIN_PASSWORD_LENGTH = 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const invalidAuthRequest = (message: string) => new ApiError(400, 'INVALID_AUTH_REQUEST', message);

export interface RegisterBody {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
}

function asObject(body: unknown): Record<string, unknown> {
  if (!isPlainObject(body)) {
    throw invalidAuthRequest('body ต้องเป็น JSON object');
  }
  return body;
}

function requireString(raw: unknown, name: string): string {
  if (typeof raw !== 'string') {
    throw invalidAuthRequest(`${name} ต้องเป็นข้อความ`);
  }
  return raw;
}

function parseEmail(raw: unknown): string {
  const email = requireString(raw, 'email').trim().toLowerCase();
  if (email === '') {
    throw invalidAuthRequest('ต้องระบุ email');
  }
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw invalidAuthRequest('email ไม่ถูกรูปแบบ');
  }
  return email;
}


function parsePassword(raw: unknown): string {
  const password = requireString(raw, 'password');
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw invalidAuthRequest(
      `password ต้องยาว ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} ตัวอักษร`,
    );
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw invalidAuthRequest(
      `password ยาวเกินไป (เกิน ${MAX_PASSWORD_BYTES} ไบต์ — อักษรไทยและอีโมจิใช้หลายไบต์ต่อตัว) ลองให้สั้นลง`,
    );
  }
  return password;
}

function parseDisplayName(raw: unknown): string {
  const name = requireString(raw, 'displayName').trim();
  if (name.length < 1 || name.length > MAX_DISPLAY_NAME_LENGTH) {
    throw invalidAuthRequest(`displayName ต้องยาว 1-${MAX_DISPLAY_NAME_LENGTH} ตัวอักษร`);
  }
  return name;
}

/** body ของ POST /auth/register: { email, password, displayName } */
export function parseRegisterBody(body: unknown): RegisterBody {
  const obj = asObject(body);
  return {
    email: parseEmail(obj.email),
    password: parsePassword(obj.password),
    displayName: parseDisplayName(obj.displayName),
  };
}

/** body ของ POST /auth/login: { email, password } */
export function parseLoginBody(body: unknown): LoginBody {
  const obj = asObject(body);

  const email = requireString(obj.email, 'email').trim().toLowerCase();
  if (email === '' || email.length > MAX_EMAIL_LENGTH) {
    throw invalidAuthRequest('ต้องระบุ email');
  }

  const password = requireString(obj.password, 'password');
  if (password === '' || password.length > MAX_LOGIN_PASSWORD_LENGTH) {
    throw invalidAuthRequest('ต้องระบุ password');
  }

  return { email, password };
}
