import { describe, expect, it } from 'vitest'
import { currentHashPath, loginUrl, safeNext } from './authRedirect'

describe('safeNext', () => {
  it('รับ path ภายในแอป (รวม query)', () => {
    expect(safeNext('/session/abc')).toBe('/session/abc')
    expect(safeNext('/history?page=2')).toBe('/history?page=2')
    expect(safeNext('/admin/analytics')).toBe('/admin/analytics')
  })

  it.each([
    ['ไม่มี', undefined],
    ['null', null],
    ['ว่าง', ''],
    ['URL เต็ม', 'https://evil.example/x'],
    ['protocol-relative', '//evil.example/x'],
    ['backslash', '/\\evil.example'],
    ['ไม่ขึ้นต้นด้วย /', 'session/abc'],
    ['javascript:', 'javascript:alert(1)'],
    ['หน้าล็อกอิน (กันวน)', '/login?next=/x'],
    ['หน้าสมัคร', '/register'],
  ])('ปฏิเสธ: %s', (_name, raw) => {
    expect(safeNext(raw)).toBeUndefined()
  })
})

describe('currentHashPath', () => {
  it('ตัด # ออก · ว่างเป็น /', () => {
    expect(currentHashPath('#/session/abc?x=1')).toBe('/session/abc?x=1')
    expect(currentHashPath('')).toBe('/')
    expect(currentHashPath('#')).toBe('/')
  })
})

describe('loginUrl', () => {
  it('ใส่เหตุผลและ next ที่ปลอดภัย', () => {
    expect(loginUrl('expired', '/session/abc')).toBe('/login?reason=expired&next=%2Fsession%2Fabc')
  })

  it('ไม่ใส่ next ที่ไม่ปลอดภัยหรือเป็นหน้าล็อกอินเอง', () => {
    expect(loginUrl('expired', '//evil')).toBe('/login?reason=expired')
    expect(loginUrl('expired', '/login')).toBe('/login?reason=expired')
    expect(loginUrl(undefined, undefined)).toBe('/login')
  })
})
