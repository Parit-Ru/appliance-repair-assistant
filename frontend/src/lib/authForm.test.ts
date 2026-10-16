import { describe, expect, it } from 'vitest'
import { hasErrors, validateLogin, validateRegister } from './authForm'

describe('validateLogin', () => {
  it('ผ่านเมื่อมีอีเมลถูกรูปแบบและรหัสผ่าน (ไม่บังคับความยาวตอนเข้าสู่ระบบ)', () => {
    expect(hasErrors(validateLogin('a@b.com', 'x'))).toBe(false)
  })

  it('อีเมลว่าง/ผิดรูปแบบ และรหัสผ่านว่าง', () => {
    expect(validateLogin('', '')).toEqual({ email: 'กรอกอีเมล', password: 'กรอกรหัสผ่าน' })
    expect(validateLogin('nope', 'x').email).toContain('ไม่ถูกรูปแบบ')
  })
})

describe('validateRegister', () => {
  const ok = ['a@b.com', 'abcdefgh', 'สมชาย'] as const

  it('ข้อมูลถูกต้องผ่าน', () => {
    expect(hasErrors(validateRegister(...ok))).toBe(false)
  })

  it('รหัสผ่าน 8–72 ตัวอักษร (ขอบเขตพอดีผ่าน)', () => {
    expect(validateRegister('a@b.com', 'a'.repeat(7), 'x').password).toBeDefined()
    expect(validateRegister('a@b.com', 'a'.repeat(8), 'x').password).toBeUndefined()
    expect(validateRegister('a@b.com', 'a'.repeat(72), 'x').password).toBeUndefined()
    expect(validateRegister('a@b.com', 'a'.repeat(73), 'x').password).toBeDefined()
  })

  it('รหัสผ่านไทยที่ไม่เกิน 72 ตัวอักษรแต่เกิน 72 ไบต์ถูกปฏิเสธ (bcrypt จะตัดทิ้ง)', () => {
    const thai = 'ก'.repeat(30) // 30 ตัวอักษร = 90 ไบต์
    expect(validateRegister('a@b.com', thai, 'x').password).toContain('หลายไบต์')
    expect(validateRegister('a@b.com', 'ก'.repeat(24), 'x').password).toBeUndefined() // 72 ไบต์พอดี
  })

  it('ชื่อที่แสดง 1–100 ตัวอักษร ตัดช่องว่างหน้าหลังก่อนนับ', () => {
    expect(validateRegister('a@b.com', 'abcdefgh', '   ').displayName).toBeDefined()
    expect(validateRegister('a@b.com', 'abcdefgh', 'x'.repeat(100)).displayName).toBeUndefined()
    expect(validateRegister('a@b.com', 'abcdefgh', 'x'.repeat(101)).displayName).toBeDefined()
  })
})
