/**
 * auth.dto.ts — รูปร่างข้อมูลและตัวตรวจ input ของ /auth/register และ /auth/login
 *
 * เหมือน history.dto.ts / traversal.dto.ts: ไม่ใช้ class-validator ตัวตรวจเป็นฟังก์ชันล้วนที่คืนค่าที่ผ่านการตรวจแล้ว
 * หรือโยน ApiError 400 INVALID_AUTH_REQUEST (AllExceptionsFilter แปลงเป็น response)
 *
 * ความปลอดภัย: parseRegisterBody อ่านเฉพาะ email / password / displayName เท่านั้น
 * field อื่นที่แนบมา (รวมถึง role) ถูกเมินทั้งหมด → สมัครผ่าน API สาธารณะได้เป็น user เสมอ
 * (ผลลัพธ์ของฟังก์ชันไม่มี role ให้ service ใช้ด้วยซ้ำ)
 */

import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import type { Role } from './role.enum';

const MIN_PASSWORD_LENGTH = 8;
/** bcrypt ใช้แค่ 72 ไบต์แรก — ดู parsePassword */
const MAX_PASSWORD_LENGTH = 72;
const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL_LENGTH = 255;
const MAX_DISPLAY_NAME_LENGTH = 100;
/** เพดานรหัสผ่านตอน login: ไม่บังคับกฎเดียวกับตอนสมัคร (กฎอาจเปลี่ยนทีหลัง) แต่กัน body ใหญ่เกินจริง */
const MAX_LOGIN_PASSWORD_LENGTH = 1000;

/** รูปแบบอีเมลแบบหลวม: มี @ หนึ่งตัว มีจุดในโดเมน ไม่มีช่องว่าง (ตรวจจริงด้วยการส่งอีเมลยืนยันไม่ได้ ไม่ในขอบเขตงานนี้) */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const invalidAuthRequest = (message: string) => new ApiError(400, 'INVALID_AUTH_REQUEST', message);

export interface RegisterBody {
  /** ตัวพิมพ์เล็ก ตัดช่องว่างหน้าหลังแล้ว */
  email: string;
  password: string;
  /** ตัดช่องว่างหน้าหลังแล้ว */
  displayName: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

/** ข้อมูลผู้ใช้ที่ส่งกลับให้หน้าจอ (ไม่มี password_hash เด็ดขาด) */
export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  /** ISO 8601 */
  createdAt: string;
}

/** response ของ register และ login */
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

/**
 * รหัสผ่านตอนสมัคร: ยาว 8-72 ตัวอักษร · ไม่บังคับอักขระพิเศษ · ไม่ตัดช่องว่าง (ช่องว่างเป็นส่วนหนึ่งของรหัสผ่านได้)
 *
 * นอกจากนับตัวอักษรแล้วยังจำกัดไม่เกิน 72 ไบต์ (UTF-8) ด้วย เพราะ bcrypt ตัดที่ 72 ไบต์ ไม่ใช่ 72 ตัวอักษร
 * อักษรไทย 1 ตัว = 3 ไบต์ ถ้าไม่ตรวจ รหัสผ่านภาษาไทยยาวๆ จะถูกตัดเงียบๆ และตัวท้ายไม่มีผลต่อการเข้าสู่ระบบ
 */
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

/** body ของ POST /auth/register: { email, password, displayName } — field อื่น (เช่น role) ถูกเมิน */
export function parseRegisterBody(body: unknown): RegisterBody {
  const obj = asObject(body);
  return {
    email: parseEmail(obj.email),
    password: parsePassword(obj.password),
    displayName: parseDisplayName(obj.displayName),
  };
}

/**
 * body ของ POST /auth/login: { email, password }
 * ตรวจแค่ว่าเป็นข้อความและไม่ว่าง — ถ้ารูปแบบผิดจะตอบ 400 ส่วนอีเมล/รหัสผ่านที่ "รูปแบบถูกแต่ไม่ตรง" ตอบ 401 แบบทั่วไป
 */
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
