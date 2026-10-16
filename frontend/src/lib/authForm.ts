/**
 * ตรวจฟอร์มเข้าสู่ระบบ/สมัครสมาชิกฝั่งหน้าจอ (ฟังก์ชันล้วน)
 *
 * ตรวจเพื่อบอกผู้ใช้ทันทีเท่านั้น (UX) · backend ตรวจซ้ำเสมอและเป็นฝ่ายตัดสิน
 * กฎต้องตรงกับ backend/src/auth/auth.dto.ts: อีเมลรูปแบบหลวม, รหัสผ่าน 8–72 ตัวอักษร และไม่เกิน 72 ไบต์,
 * ชื่อที่แสดง 1–100 ตัวอักษร
 */

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72
/** bcrypt ใช้แค่ 72 ไบต์แรก อักษรไทย 1 ตัว = 3 ไบต์ จึงตรวจไบต์ด้วย */
export const MAX_PASSWORD_BYTES = 72
export const MAX_EMAIL_LENGTH = 255
export const MAX_DISPLAY_NAME_LENGTH = 100

/** เหมือน EMAIL_PATTERN ใน backend */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export interface FormErrors {
  email?: string
  password?: string
  displayName?: string
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0
}

function checkEmail(email: string): string | undefined {
  const value = email.trim()
  if (value === '') return 'กรอกอีเมล'
  if (value.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(value)) return 'อีเมลไม่ถูกรูปแบบ เช่น name@example.com'
  return undefined
}

export function validateLogin(email: string, password: string): FormErrors {
  const errors: FormErrors = {}
  const emailError = checkEmail(email)
  if (emailError !== undefined) errors.email = emailError
  if (password === '') errors.password = 'กรอกรหัสผ่าน'
  return errors
}

export function validateRegister(email: string, password: string, displayName: string): FormErrors {
  const errors: FormErrors = {}

  const emailError = checkEmail(email)
  if (emailError !== undefined) errors.email = emailError

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `รหัสผ่านต้องยาว ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} ตัวอักษร`
  } else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    errors.password = 'รหัสผ่านยาวเกินไป (อักษรไทยและอีโมจิใช้พื้นที่หลายไบต์ต่อตัว) ลองให้สั้นลง'
  }

  const name = displayName.trim()
  if (name.length < 1 || name.length > MAX_DISPLAY_NAME_LENGTH) {
    errors.displayName = `ชื่อที่แสดงต้องยาว 1–${MAX_DISPLAY_NAME_LENGTH} ตัวอักษร`
  }

  return errors
}
