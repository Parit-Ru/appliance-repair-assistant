import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { HistoryListItem, HistoryListResponse } from '../api/types'
import { parseHistoryParams } from '../lib/historyParams'
import { HistoryPage } from './HistoryPage'

const AC = {
  manualId: 'm_ac',
  entrySymptom: 'Not cooling',
  entrySymptomTh: 'แอร์ไม่เย็น',
  deviceCategory: 'Air Conditioner' as const,
  brand: 'Samsung',
  modelPattern: 'AR70H**D1***',
  displayName: 'AR70H ห้องนอน',
}

const FRIDGE = {
  manualId: 'm_rf',
  entrySymptom: 'Water leaking',
  entrySymptomTh: 'ตู้เย็นมีน้ำรั่ว',
  deviceCategory: 'Refrigerator' as const,
  brand: 'Samsung',
  modelPattern: 'RS5000',
}

function item(partial: Partial<HistoryListItem> & Pick<HistoryListItem, 'sessionId'>): HistoryListItem {
  return {
    graphId: 'g_ac',
    startedAt: '2026-10-15T07:30:00.000Z',
    outcomeKind: 'user_fixed',
    graph: AC,
    ...partial,
  }
}

function response(items: HistoryListItem[], overrides: Partial<HistoryListResponse> = {}): HistoryListResponse {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    facets: { categories: ['Air Conditioner', 'Refrigerator'], brands: ['Samsung'] },
    ...overrides,
  }
}

/** url = path + query ของหน้า · data = ผลที่ใส่แคชไว้ให้ตรงกับพารามิเตอร์ใน url (ไม่ใส่ = ยังโหลดอยู่) */
function render(url: string, data?: HistoryListResponse): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (data !== undefined) {
    const search = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')
    client.setQueryData(queryKeys.historyList(parseHistoryParams(search)), data)
  }
  return renderToString(
    <QueryClientProvider client={client}>
      <StaticRouter location={url}>
        <HistoryPage />
      </StaticRouter>
    </QueryClientProvider>,
  )
}

describe('HistoryPage: รายการ', () => {
  const rows = [
    item({ sessionId: 's-fixed', outcomeKind: 'user_fixed' }),
    item({ sessionId: 's-informed', outcomeKind: 'handoff_informed', graphId: 'g_rf', graph: FRIDGE }),
    item({ sessionId: 's-unknown', outcomeKind: 'handoff_unknown' }),
    item({ sessionId: 's-normal', outcomeKind: 'normal_behavior' }),
  ]

  it('แต่ละแถวมี สรุปปัญหา · ประเภท/ยี่ห้อ/รุ่น · วันที่ · สถานะ และลิงก์ไปรายละเอียด', () => {
    const html = render('/history', response(rows))

    expect(html).toContain('แอร์ไม่เย็น')
    expect(html).toContain('ตู้เย็นมีน้ำรั่ว')
    expect(html).toContain('เครื่องปรับอากาศ')
    expect(html).toContain('ตู้เย็น')
    expect(html).toContain('Samsung')
    expect(html).toContain('AR70H ห้องนอน') // displayName
    expect(html).toContain('RS5000') // ไม่มี displayName → modelPattern
    expect(html).toContain('<time dateTime="2026-10-15T07:30:00.000Z">')
    expect(html).toContain('href="/history/s-fixed"')
    expect(html).toContain('href="/history/s-normal"')
  })

  it('ป้ายสถานะครบทั้ง 4 แบบ ตามที่ตกลง', () => {
    const html = render('/history', response(rows))

    // อยู่ในตัวกรองด้วย จึงเช็กป้ายในแถวผ่านคลาสของป้าย (rounded-full)
    expect(html).toMatch(/rounded-full[^>]*>แก้ได้แล้ว</)
    expect(html).toMatch(/rounded-full[^>]*>ยังไม่ได้แก้</)
    expect(html).toMatch(/rounded-full[^>]*>หลักฐานไม่เพียงพอ</)
    expect(html).toMatch(/rounded-full[^>]*>เครื่องทำงานปกติ ไม่ได้เสีย</)
  })

  it('แถวที่ผังหาย: แสดงเท่าที่มี ไม่เดาชื่ออาการ/สถานะ แต่ยังเปิดดูและลบได้', () => {
    const html = render('/history', response([item({ sessionId: 's-gone', graph: null, outcomeKind: null })]))

    expect(html).toContain('ข้อมูลผังเปลี่ยนไปแล้ว ดูรายละเอียดไม่ได้')
    expect(html).toContain('href="/history/s-gone"')
    expect(html).toContain('>ลบ</button>')
    expect(html).not.toContain('undefined')
    expect(html).not.toMatch(/rounded-full[^>]*>แก้ได้แล้ว</)
  })

  it('บอกจำนวนทั้งหมด และข้อจำกัดว่าผูกกับเบราว์เซอร์ + เก็บ 90 วัน', () => {
    const html = render('/history', response(rows))

    expect(html).toMatch(/ทั้งหมด (<!-- -->)?4(<!-- -->)? รายการ/)
    expect(html).toContain('ผูกกับเบราว์เซอร์เครื่องนี้')
    expect(html).toMatch(/เก็บไว้ (<!-- -->)?90(<!-- -->)? วัน/)
  })
})

describe('HistoryPage: ตัวกรองจาก URL', () => {
  it('ค่าใน URL ถูกเลือกในตัวกรอง และตัวเลือกประเภท/ยี่ห้อมาจากประวัติของผู้ใช้', () => {
    const html = render(
      '/history?category=Refrigerator&brand=Samsung&status=handoff_unknown&sort=oldest',
      response([item({ sessionId: 's1', outcomeKind: 'handoff_unknown', graph: FRIDGE })]),
    )

    expect(html).toMatch(/<option value="Refrigerator" selected/)
    expect(html).toMatch(/<option value="Samsung" selected/)
    expect(html).toMatch(/<option value="handoff_unknown" selected/)
    expect(html).toMatch(/<option value="oldest" selected/)
    expect(html).toMatch(/พบ (<!-- -->)?1(<!-- -->)? รายการ/)
    expect(html).toContain('ล้างตัวกรอง')
  })

  it('คำค้นใน URL อยู่ในช่องค้นหา', () => {
    const html = render('/history?q=%E0%B9%81%E0%B8%AD%E0%B8%A3%E0%B9%8C', response([item({ sessionId: 's1' })]))

    expect(html).toContain('value="แอร์"')
  })

  it('ค่าที่ไม่รู้จักใน URL ไม่ทำให้หน้าพัง (ปัดเป็นค่าเริ่มต้น)', () => {
    const html = render('/history?category=Toaster&status=done&page=-4', response([item({ sessionId: 's1' })]))

    expect(html).toContain('แอร์ไม่เย็น')
    expect(html).not.toContain('Toaster')
    expect(html).not.toContain('undefined')
  })
})

describe('HistoryPage: สถานะอื่น', () => {
  it('กำลังโหลด', () => {
    const html = render('/history')

    expect(html).toContain('กำลังโหลดประวัติ')
    expect(html).not.toContain('ยังไม่มีประวัติการซ่อม')
  })

  it('ยังไม่มีประวัติเลย (ไม่มีตัวกรอง): บอกและมีทางไปเลือกเครื่อง', () => {
    const html = render('/history', response([]))

    expect(html).toContain('ยังไม่มีประวัติการซ่อม')
    expect(html).toContain('href="/devices"')
    expect(html).not.toContain('ไม่พบรายการที่ตรงกับที่ค้นหา')
  })

  it('ไม่พบตามตัวกรอง: บอกต่างจากกรณีไม่มีประวัติ และมีปุ่มล้างตัวกรอง', () => {
    const html = render('/history?status=user_fixed', response([]))

    expect(html).toContain('ไม่พบรายการที่ตรงกับที่ค้นหา')
    expect(html).toContain('ล้างตัวกรอง')
    expect(html).not.toContain('ยังไม่มีประวัติการซ่อม')
  })

  it('หลายหน้า: มี pagination และบอกหน้าที่เซิร์ฟเวอร์ส่งจริง', () => {
    const html = render('/history?page=2', response([item({ sessionId: 's11' })], { total: 25, page: 2, totalPages: 3 }))

    expect(html).toMatch(/หน้า (<!-- -->)?2(<!-- -->)? จาก (<!-- -->)?3/)
    expect(html).toContain('ก่อนหน้า')
    expect(html).toContain('ถัดไป')
  })

  it('หน้าเดียว: ไม่มี pagination', () => {
    const html = render('/history', response([item({ sessionId: 's1' })]))

    expect(html).not.toContain('แบ่งหน้า')
    expect(html).not.toContain('ถัดไป')
  })
})
