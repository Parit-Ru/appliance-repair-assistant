import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../lib/authContext'
import type { AuthContextValue } from '../../lib/authContext'
import { ADMIN, GUEST, USER_A, VERIFYING } from '../../lib/authTestValues'
import { AdminRoute } from './AdminRoute'

function render(auth: AuthContextValue): string {
  return renderToString(
    <AuthContext.Provider value={auth}>
      <StaticRouter location="/admin/analytics">
        <AdminRoute>
          <p>เนื้อหาผู้ดูแลระบบ</p>
        </AdminRoute>
      </StaticRouter>
    </AuthContext.Provider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminRoute (UX · backend คือการป้องกันจริง)', () => {
  it('admin → เห็นเนื้อหา', () => {
    const html = render(ADMIN)
    expect(html).toContain('เนื้อหาผู้ดูแลระบบ')
    expect(html).not.toContain('ไม่มีสิทธิ์')
  })

  it('ผู้ใช้ธรรมดา → หน้า "ไม่มีสิทธิ์" (ไม่ใช่หน้าว่าง) และไม่เห็นเนื้อหา', () => {
    const html = render(USER_A)
    expect(html).toContain('ไม่มีสิทธิ์เข้าถึงหน้านี้')
    expect(html).toContain('href="/"')
    expect(html).not.toContain('เนื้อหาผู้ดูแลระบบ')
  })

  it('ยังไม่ล็อกอิน → ไม่เห็นเนื้อหา และไม่ขึ้นหน้า "ไม่มีสิทธิ์" (เด้งไปหน้าเข้าสู่ระบบแทน)', () => {
    // <Navigate> ใน StaticRouter เตือนทาง console.warn (ทำงานจริงในเบราว์เซอร์) จึงปิดเสียงเตือนในเทสต์นี้
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const html = render(GUEST)
    expect(html).not.toContain('เนื้อหาผู้ดูแลระบบ')
    expect(html).not.toContain('ไม่มีสิทธิ์')
  })

  it('กำลังยืนยัน token → "กำลังตรวจสอบสิทธิ์" ไม่กะพริบหน้า "ไม่มีสิทธิ์" และไม่เปิดเนื้อหา', () => {
    const html = render(VERIFYING)
    expect(html).toContain('กำลังตรวจสอบสิทธิ์')
    expect(html).not.toContain('ไม่มีสิทธิ์')
    expect(html).not.toContain('เนื้อหาผู้ดูแลระบบ')
  })
})
