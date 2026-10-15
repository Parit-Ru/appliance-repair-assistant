import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { ManualSummary } from '../api/types'
import { DevicesPage } from './DevicesPage'

const MANUALS: ManualSummary[] = [
  { manualId: 'm_ac', deviceCategory: 'Air Conditioner', brand: 'Samsung', modelPattern: 'AR70H**D1***', graphCount: 13 },
  { manualId: 'm_wa21a', deviceCategory: 'Washing Machine', brand: 'Samsung', modelPattern: 'WA21A8376G*', displayName: 'WA21A ฝาบน 21 กก.', graphCount: 33 },
  { manualId: 'm_wt10j7', deviceCategory: 'Washing Machine', brand: 'Samsung', modelPattern: 'WT10J7', graphCount: 6 },
]

function render(url: string): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(queryKeys.manuals, MANUALS)
  return renderToString(
    <QueryClientProvider client={client}>
      <StaticRouter location={url}>
        <DevicesPage />
      </StaticRouter>
    </QueryClientProvider>,
  )
}

describe('DevicesPage', () => {
  it('ขั้น 1: แสดงเฉพาะประเภทที่มีคู่มือ พร้อมจำนวนรุ่น', () => {
    const html = render('/devices')
    expect(html).toContain('เลือกเครื่องที่มีปัญหา')
    expect(html).toContain('เครื่องปรับอากาศ')
    expect(html).toContain('เครื่องซักผ้า')
    expect(html).toMatch(/2(<!-- -->)? รุ่นในระบบ/)
    expect(html).not.toContain('ตู้เย็น')
    expect(html).not.toContain('โทรทัศน์')
  })
  it('ขั้น 2: แสดงรุ่นของประเภทนั้นเท่านั้น ใช้ displayName ถ้ามี ไม่งั้น modelPattern', () => {
    const html = render('/devices?category=Washing%20Machine')
    expect(html).toContain('WA21A ฝาบน 21 กก.')
    expect(html).toContain('WA21A8376G*') // modelPattern แสดงกำกับเมื่อมี displayName
    expect(html).toContain('WT10J7') // ไม่มี displayName → แสดง modelPattern
    expect(html).not.toContain('AR70H')
    expect(html).toContain('ฉันไม่ทราบรุ่น')
    expect(html).not.toContain('ขั้นตอนอาจไม่ตรงกับเครื่องของคุณ') // คำเตือนโผล่เฉพาะเมื่อกด "ไม่ทราบรุ่น"
  })
})

describe('DevicesPage: category ที่ไม่รู้จัก', () => {
  it('?category=Foo (พิมพ์ URL เอง) → กลับไปขั้น 1 ไม่ขึ้น undefined', () => {
    const html = render('/devices?category=Foo')
    expect(html).toContain('เลือกเครื่องที่มีปัญหา')
    expect(html).not.toContain('undefined')
    expect(html).toContain('เครื่องซักผ้า')
  })
})
