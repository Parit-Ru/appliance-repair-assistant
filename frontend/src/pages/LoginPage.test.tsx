import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../lib/authContext'
import type { AuthContextValue } from '../lib/authContext'
import { GUEST, USER_A } from '../lib/authTestValues'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'

function render(page: 'login' | 'register', url: string, auth: AuthContextValue = GUEST): string {
  const client = new QueryClient()
  return renderToString(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <StaticRouter location={url}>{page === 'login' ? <LoginPage /> : <RegisterPage />}</StaticRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LoginPage', () => {
  it('ฟอร์มอีเมล/รหัสผ่าน และบอกว่าไม่เข้าสู่ระบบก็ตรวจอาการได้', () => {
    const html = render('login', '/login')
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain('autoComplete="current-password"')
    expect(html).toContain('ไม่เข้าสู่ระบบก็ตรวจอาการได้ตามปกติ')
    expect(html).toContain('href="/register"')
  })

  it('?reason=expired → บอกว่าการเข้าสู่ระบบหมดอายุ', () => {
    expect(render('login', '/login?reason=expired')).toContain('การเข้าสู่ระบบหมดอายุ')
    expect(render('login', '/login')).not.toContain('การเข้าสู่ระบบหมดอายุ')
  })

  it('?reason=login-required → บอกว่าหน้านี้ต้องเข้าสู่ระบบ', () => {
    expect(render('login', '/login?reason=login-required')).toContain('หน้านี้ต้องเข้าสู่ระบบ')
  })

  it('?next ที่ปลอดภัยถูกส่งต่อไปลิงก์สมัคร · ที่ไม่ปลอดภัยถูกทิ้ง', () => {
    expect(render('login', '/login?next=%2Fsession%2Fabc')).toContain('href="/register?next=%2Fsession%2Fabc"')
    expect(render('login', '/login?next=https%3A%2F%2Fevil.example')).toContain('href="/register"')
  })

  it('ล็อกอินอยู่แล้ว → ไม่แสดงฟอร์ม (เด้งไปต่อ)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const html = render('login', '/login', USER_A)
    expect(html).not.toContain('type="password"')
  })
})

describe('RegisterPage', () => {
  it('ฟอร์มชื่อที่แสดง/อีเมล/รหัสผ่าน พร้อมคำใบ้ความยาว และไม่มีช่อง role', () => {
    const html = render('register', '/register')
    expect(html).toContain('ชื่อที่แสดง')
    expect(html).toContain('autoComplete="new-password"')
    expect(html).toContain('ยาว 8–72 ตัวอักษร')
    expect(html).not.toMatch(/role|บทบาท/i)
    expect(html).toContain('href="/login"')
  })
})
