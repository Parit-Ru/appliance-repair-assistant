import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../../lib/authContext'
import type { AuthContextValue } from '../../lib/authContext'
import { ADMIN, GUEST, USER_A } from '../../lib/authTestValues'
import { AppShell } from './AppShell'

function render(auth: AuthContextValue): string {
  const client = new QueryClient()
  return renderToString(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <StaticRouter location="/">
          <AppShell>
            <p>เนื้อหา</p>
          </AppShell>
        </StaticRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('AppShell: เมนูตามสถานะ', () => {
  it('guest → ลิงก์เข้าสู่ระบบ/สมัครสมาชิก · ไม่มีออกจากระบบ · ไม่มีเมนูผู้ดูแลระบบ · เมนูเดิมครบ', () => {
    const html = render(GUEST)
    expect(html).toContain('href="/login"')
    expect(html).toContain('href="/register"')
    expect(html).not.toContain('ออกจากระบบ')
    expect(html).not.toContain('href="/admin"')
    for (const href of ['/devices', '/symptoms/all', '/history']) {
      expect(html).toContain(`href="${href}"`)
    }
  })

  it('ผู้ใช้ธรรมดา → ชื่อ + ออกจากระบบ · ไม่มีลิงก์เข้าสู่ระบบ · ไม่มีเมนูผู้ดูแลระบบ', () => {
    const html = render(USER_A)
    expect(html).toContain('สมชาย')
    expect(html).toContain('ออกจากระบบ')
    expect(html).not.toContain('href="/login"')
    expect(html).not.toContain('href="/register"')
    expect(html).not.toContain('href="/admin"')
  })

  it('admin → เห็นเมนูผู้ดูแลระบบ', () => {
    const html = render(ADMIN)
    expect(html).toContain('href="/admin"')
    expect(html).toContain('ออกจากระบบ')
  })
})
