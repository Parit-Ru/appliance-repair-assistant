import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { GraphSummary, ManualSummary } from '../api/types'
import { MODEL_MATCH_HINT } from '../lib/modelSelection'
import { AllSymptomsPage } from './AllSymptomsPage'

const AC: GraphSummary = {
  graphId: 'g_ac_cool',
  manualId: 'm_ac',
  entrySymptom: 'AC not cooling',
  entrySymptomTh: 'แอร์ไม่เย็น',
  deviceCategory: 'Air Conditioner',
  brand: 'Samsung',
  modelPattern: 'AR70H**D1***',
}
const WA_DRAIN: GraphSummary = {
  graphId: 'g_wa_drain',
  manualId: 'm_wa21a',
  entrySymptom: 'Water does not drain',
  entrySymptomTh: 'น้ำไม่ไหลออก',
  deviceCategory: 'Washing Machine',
  brand: 'Samsung',
  modelPattern: 'WA21A8376G*',
}
const WT_SPIN: GraphSummary = {
  graphId: 'g_wt_spin',
  manualId: 'm_wt10j7',
  entrySymptom: 'Does not spin',
  entrySymptomTh: 'ถังไม่หมุน',
  deviceCategory: 'Washing Machine',
  brand: 'Samsung',
  modelPattern: 'WT10J7',
}

const MANUALS: ManualSummary[] = [
  { manualId: 'm_ac', deviceCategory: 'Air Conditioner', brand: 'Samsung', modelPattern: 'AR70H**D1***', graphCount: 1 },
  { manualId: 'm_wa21a', deviceCategory: 'Washing Machine', brand: 'Samsung', modelPattern: 'WA21A8376G*', displayName: 'WA21A ฝาบน 21 กก.', graphCount: 1 },
  { manualId: 'm_wt10j7', deviceCategory: 'Washing Machine', brand: 'Samsung', modelPattern: 'WT10J7', graphCount: 1 },
]

function render(url: string): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(queryKeys.manuals, MANUALS)
  client.setQueryData(queryKeys.graphs, [AC, WA_DRAIN, WT_SPIN])
  client.setQueryData(queryKeys.graphsOf('m_ac'), [AC])
  return renderToString(
    <QueryClientProvider client={client}>
      <StaticRouter location={url}>
        <AllSymptomsPage />
      </StaticRouter>
    </QueryClientProvider>,
  )
}

describe('AllSymptomsPage: ไม่มี ?manual= (ดูอาการทุกรุ่น)', () => {
  const html = render('/symptoms/all')

  it('แสดงอาการของทุกรุ่น ไม่ redirect ไปหน้าเลือกเครื่อง', () => {
    expect(html).toContain('อาการทั้งหมด')
    expect(html).toContain('แอร์ไม่เย็น')
    expect(html).toContain('น้ำไม่ไหลออก')
    expect(html).toContain('ถังไม่หมุน')
  })

  it('แยกกลุ่มตามรุ่น: หัวกลุ่มแสดงประเภท + ยี่ห้อ + displayName (ถ้าไม่มี แสดง modelPattern)', () => {
    expect(html).toContain('เครื่องปรับอากาศ')
    expect(html).toContain('เครื่องซักผ้า')
    expect(html).toContain('WA21A ฝาบน 21 กก.') // มี displayName
    expect(html).toContain('WT10J7') // ไม่มี displayName → modelPattern
    expect(html).toContain('AR70H**D1***')
  })

  it('ใช้ประโยคเดิมที่บอกว่าขั้นตอนต่างกันตามรุ่น (ตัวเดียวกับหน้าเลือกเครื่อง)', () => {
    expect(html).toContain(MODEL_MATCH_HINT)
  })

  it('ไม่มีปุ่ม "เปลี่ยนรุ่น" (ยังไม่ได้เลือกรุ่น) และมีทางไปเลือกเครื่อง', () => {
    expect(html).not.toContain('เปลี่ยนรุ่น')
    expect(html).toContain('เลือกเครื่องก่อนเพื่อพิมพ์อาการให้ระบบช่วยหา')
    expect(html).toContain('href="/devices"')
  })
})

describe('AllSymptomsPage: มี ?manual= (รุ่นเดียว)', () => {
  const html = render('/symptoms/all?manual=m_ac')

  it('แสดงเฉพาะอาการของรุ่นนั้น', () => {
    expect(html).toContain('แอร์ไม่เย็น')
    expect(html).not.toContain('น้ำไม่ไหลออก')
    expect(html).not.toContain('ถังไม่หมุน')
  })

  it('มี "เปลี่ยนรุ่น" และลิงก์ไปพิมพ์ค้นของรุ่นเดิม', () => {
    expect(html).toContain('เปลี่ยนรุ่น')
    expect(html).toContain('พิมพ์อาการให้ระบบช่วยหา')
    expect(html).toContain('/symptoms?manual=m_ac')
  })
})
