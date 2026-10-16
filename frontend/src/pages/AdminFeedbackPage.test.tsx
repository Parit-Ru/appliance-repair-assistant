import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { AdminFeedbackItem, AdminFeedbackResponse } from '../api/types'
import { parseFeedbackParams } from '../lib/adminParams'
import { AuthContext } from '../lib/authContext'
import { ADMIN } from '../lib/authTestValues'
import { AdminFeedbackPage } from './AdminFeedbackPage'

function item(partial: Partial<AdminFeedbackItem> & Pick<AdminFeedbackItem, 'sessionId'>): AdminFeedbackItem {
  return {
    helpful: true,
    comment: 'ใช้ได้ดี',
    createdAt: '2026-10-15T07:30:00.000Z',
    updatedAt: '2026-10-15T07:30:00.000Z',
    graphId: 'g1',
    deviceCategory: 'Microwave',
    brand: 'Samsung',
    ownerType: 'user',
    ...partial,
  }
}

function response(items: AdminFeedbackItem[], overrides: Partial<AdminFeedbackResponse> = {}): AdminFeedbackResponse {
  return { items, total: items.length, page: 1, pageSize: 20, totalPages: 1, ...overrides }
}

function render(url: string, data?: AdminFeedbackResponse): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (data !== undefined) {
    const search = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')
    client.setQueryData(queryKeys.adminFeedback(parseFeedbackParams(search), 'admin-1'), data)
  }
  return renderToString(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={ADMIN}>
        <StaticRouter location={url}>
          <AdminFeedbackPage />
        </StaticRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('AdminFeedbackPage', () => {
  it('แถวแสดง คะแนน ความเห็น ประเภทเครื่อง ยี่ห้อ ชนิดเจ้าของ และวันที่ (ไม่แสดงว่าใครเขียน)', () => {
    const html = render(
      '/admin/feedback',
      response([
        item({ sessionId: 's1', helpful: true, comment: 'ขั้นตอนชัดเจน', ownerType: 'user' }),
        item({ sessionId: 's2', helpful: false, comment: null, ownerType: 'guest', deviceCategory: null, brand: null }),
      ]),
    )

    expect(html).toContain('👍 เป็นประโยชน์')
    expect(html).toContain('👎 ไม่เป็นประโยชน์')
    expect(html).toContain('ขั้นตอนชัดเจน')
    expect(html).toContain('(ไม่มีข้อความ)')
    expect(html).toContain('ไมโครเวฟ')
    expect(html).toContain('Samsung')
    expect(html).toContain('ผู้ใช้ที่เข้าสู่ระบบ')
    expect(html).toContain('ผู้เยี่ยมชม')
    expect(html).toContain('ไม่ทราบประเภท') // ผังหาย → บอกตรงๆ
    expect(html).toContain('<time dateTime="2026-10-15T07:30:00.000Z"')
    expect(html).toContain('ทั้งหมด 2 รายการ')
  })

  it('ข้อความความเห็นที่มี HTML ถูก escape (ไม่ถูกตีความเป็นแท็ก)', () => {
    const html = render('/admin/feedback', response([item({ sessionId: 's1', comment: '<script>alert(1)</script>' })]))
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })

  it('ยังไม่มีความเห็นเลย / ไม่พบตามตัวกรอง คนละข้อความ', () => {
    expect(render('/admin/feedback', response([]))).toContain('ยังไม่มีความเห็นจากผู้ใช้')
    const filtered = render('/admin/feedback?helpful=false', response([]))
    expect(filtered).toContain('ไม่พบความเห็นที่ตรงกับตัวกรอง')
    expect(filtered).toContain('ล้างตัวกรอง')
  })

  it('ตัวกรองจาก URL ถูกสะท้อนในช่อง', () => {
    const html = render('/admin/feedback?helpful=false&from=2026-10-01&to=2026-10-16', response([]))
    expect(html).toContain('value="2026-10-01"')
    expect(html).toContain('value="2026-10-16"')
    expect(html).toContain('<option value="false" selected="">')
  })

  it('ยังโหลดอยู่ → ข้อความรอ · มีแถบลิงก์สองหน้า', () => {
    const html = render('/admin/feedback')
    expect(html).toContain('กำลังโหลดความเห็น')
    expect(html).toContain('href="/admin/analytics"')
  })

  it('แบ่งหน้าเมื่อมีหลายหน้า', () => {
    const html = render('/admin/feedback', response([item({ sessionId: 's1' })], { total: 45, totalPages: 3 }))
    expect(html.replace(/<!-- -->/g, '')).toContain('หน้า 1 จาก 3')
  })
})
