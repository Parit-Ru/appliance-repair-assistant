import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { AdminSummary } from '../api/types'
import { AuthContext } from '../lib/authContext'
import { ADMIN } from '../lib/authTestValues'
import { AdminAnalyticsPage } from './AdminAnalyticsPage'

const BASE: AdminSummary = {
  window: { days: 30, from: '2026-09-17', to: '2026-10-16' },
  sessions: {
    total: 22,
    completed: 18,
    inProgress: 3,
    expiredUnfinished: 1,
    byOwner: { user: 2, guest: 7, none: 13 },
  },
  feedback: { total: 4, helpful: 3, notHelpful: 1, satisfactionRate: 0.75 },
  confidence: { average: 0.712, sampleSize: 4 },
  outcomes: { user_fixed: 10, normal_behavior: 1, handoff_informed: 4, handoff_unknown: 2, unknown: 1 },
  topGraphs: [{ graphId: 'g1', entrySymptomTh: 'แอร์ไม่เย็น', count: 9 }],
  topDevices: [
    { deviceCategory: 'Air Conditioner', count: 9 },
    { deviceCategory: 'unknown', count: 1 },
  ],
  perDay: [
    { date: '2026-10-15', started: 0, completed: 0 },
    { date: '2026-10-16', started: 5, completed: 3 },
  ],
}

/** React แทรก <!-- --> ระหว่างข้อความกับตัวแปรตอน renderToString จึงตัดออกก่อนเทียบข้อความ */
const plain = (html: string) => html.replace(/<!-- -->/g, '')

function render(data?: AdminSummary, url = '/admin/analytics'): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (data !== undefined) {
    const days = Number(new URLSearchParams(url.split('?')[1] ?? '').get('days') ?? 30)
    client.setQueryData(queryKeys.adminSummary(days, 'admin-1'), data)
  }
  return plain(renderToString(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={ADMIN}>
        <StaticRouter location={url}>
          <AdminAnalyticsPage />
        </StaticRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  ))
}

describe('AdminAnalyticsPage', () => {
  it('ยังโหลดอยู่ → ข้อความรอ', () => {
    expect(render()).toContain('กำลังโหลดสถิติ')
  })

  it('แสดงการ์ดสรุป กราฟ และคำที่ตกลงไว้ (เดินค้างแล้วหมดอายุ ไม่ใช่ abandoned)', () => {
    const html = render(BASE)
    expect(html).toContain('เดินค้างแล้วหมดอายุ')
    expect(html).not.toMatch(/abandon/i)
    expect(html).toContain('75.0%') // อัตราความพอใจ
    expect(html).toContain('0.712') // ความมั่นใจเฉลี่ย
    expect(html).toContain('แอร์ไม่เย็น') // top graph
    expect(html).toContain('เครื่องปรับอากาศ') // top device
    expect(html).toContain('จำนวนการตรวจรายวัน')
    expect(html).toContain('ผลการตรวจที่จบแล้ว')
  })

  it('ค่า null → "-" ไม่ใช่ 0 (อัตราความพอใจ และความมั่นใจเฉลี่ย)', () => {
    const html = render({
      ...BASE,
      feedback: { total: 0, helpful: 0, notHelpful: 0, satisfactionRate: null },
      confidence: { average: null, sampleSize: 0 },
    })
    // การ์ด 2 ใบนี้ต้องขึ้น "-" · ใช้รูปแบบ <p ...>-</p> ของค่าในการ์ด
    expect(html.match(/<p class="text-2xl font-semibold text-ink">-<\/p>/g)).toHaveLength(2)
    expect(html).not.toContain('0.0%')
    expect(html).not.toContain('0.000')
  })

  it('ค่า 0 จริงยังแสดงเป็น 0 (ไม่สับสนกับ null)', () => {
    const html = render({
      ...BASE,
      feedback: { total: 2, helpful: 0, notHelpful: 2, satisfactionRate: 0 },
    })
    expect(html).toContain('0.0%')
  })

  it('มีหมายเหตุว่ากลุ่ม "ไม่ระบุเจ้าของ" อาจรวมโปรเจกต์เดิมที่ใช้ฐานข้อมูลเดียวกัน', () => {
    const html = render(BASE)
    expect(html).toContain('ไม่ระบุเจ้าของ')
    expect(html).toContain('โปรเจกต์เดิมที่ใช้ฐานข้อมูลเดียวกัน')
  })

  it('ตัวเลือกช่วงเวลา 7/30/90 วัน และอ่าน ?days= จาก URL', () => {
    const html = render({ ...BASE, window: { days: 7, from: '2026-10-10', to: '2026-10-16' } }, '/admin/analytics?days=7')
    expect(html).toContain('7 วัน')
    expect(html).toContain('30 วัน')
    expect(html).toContain('90 วัน')
    expect(html).toMatch(/aria-pressed="true"[^>]*>7 วัน/)
  })

  it('มีแถบลิงก์ไปสองหน้าของผู้ดูแลระบบ', () => {
    const html = render(BASE)
    expect(html).toContain('href="/admin/analytics"')
    expect(html).toContain('href="/admin/feedback"')
  })

  it('ไม่มีข้อมูลเลย (ระบบใหม่) → ไม่ล้ม และกราฟบอกว่ายังไม่มีข้อมูล', () => {
    const html = render({
      ...BASE,
      sessions: { total: 0, completed: 0, inProgress: 0, expiredUnfinished: 0, byOwner: { user: 0, guest: 0, none: 0 } },
      outcomes: { user_fixed: 0, normal_behavior: 0, handoff_informed: 0, handoff_unknown: 0, unknown: 0 },
      topGraphs: [],
      topDevices: [],
      perDay: [{ date: '2026-10-16', started: 0, completed: 0 }],
    })
    expect(html).toContain('ยังไม่มีการตรวจในช่วงนี้')
    expect(html).toContain('ยังไม่มีข้อมูลในช่วงนี้')
  })
})
