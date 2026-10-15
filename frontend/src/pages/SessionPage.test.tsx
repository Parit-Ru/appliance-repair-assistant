import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { Route, Routes, StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { GraphSummary, ManualSummary, SessionResponse } from '../api/types'
import { SessionPage } from './SessionPage'

const GRAPH: GraphSummary = {
  graphId: 'g_wa_drain',
  manualId: 'm_wa21a',
  entrySymptom: 'Water does not drain',
  entrySymptomTh: 'น้ำไม่ไหลออก',
  deviceCategory: 'Washing Machine',
  brand: 'Samsung',
  modelPattern: 'WA21A8376G*',
}

const MANUAL: ManualSummary = {
  manualId: 'm_wa21a',
  deviceCategory: 'Washing Machine',
  brand: 'Samsung',
  modelPattern: 'WA21A8376G*',
  displayName: 'WA21A ฝาบน 21 กก.',
  graphCount: 1,
}

const SESSION: SessionResponse = {
  sessionId: 's1',
  graphId: 'g_wa_drain',
  status: 'in_progress',
  node: {
    nodeId: 'n1',
    type: 'checkpoint',
    text: 'มีน้ำค้างในถังหลังจบรอบซักหรือไม่',
    safetyCritical: false,
    requiresSafetyConfirmation: false,
    isTerminal: false,
    reference: { source: 'คู่มือ Samsung', pageRange: [42, 42] },
  },
}

/** state = สิ่งที่ useStartSymptom ส่งมากับ navigate (undefined = เริ่มจากรายการทุกรุ่น หรือเปิดลิงก์ในแท็บใหม่) */
function render(state: unknown): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(queryKeys.session('s1'), SESSION)
  client.setQueryData(queryKeys.graphs, [GRAPH])
  client.setQueryData(queryKeys.manuals, [MANUAL])
  return renderToString(
    <QueryClientProvider client={client}>
      <StaticRouter location={{ pathname: '/session/s1', state }}>
        <Routes>
          <Route path="/session/:sessionId" element={<SessionPage />} />
        </Routes>
      </StaticRouter>
    </QueryClientProvider>,
  )
}

describe('SessionPage: แสดงชื่อรุ่นไม่ว่า modelSelection จะเป็นอะไร', () => {
  it('ไม่มี modelSelection (เริ่มจากรายการทุกรุ่น / แท็บใหม่): แสดงยี่ห้อ + ชื่อรุ่น และไม่ขึ้นกล่องไม่ทราบรุ่น', () => {
    const html = render(undefined)
    expect(html).toContain('น้ำไม่ไหลออก')
    expect(html).toContain('Samsung')
    expect(html).toContain('WA21A ฝาบน 21 กก.')
    expect(html).toContain('มีน้ำค้างในถังหลังจบรอบซักหรือไม่')
    expect(html).not.toContain('คุณเลือกรุ่นที่ใกล้เคียง')
  })

  it('selected: แสดงชื่อรุ่น ไม่มีกล่องไม่ทราบรุ่น', () => {
    const html = render({ modelSelection: 'selected' })
    expect(html).toContain('WA21A ฝาบน 21 กก.')
    expect(html).not.toContain('คุณเลือกรุ่นที่ใกล้เคียง')
  })

  it('unknown: แสดงชื่อรุ่น และมีกล่องไม่ทราบรุ่น (ข้อความเดิมจากต้นแบบ)', () => {
    const html = render({ modelSelection: 'unknown' })
    expect(html).toContain('WA21A ฝาบน 21 กก.')
    expect(html).toContain('คุณเลือกรุ่นที่ใกล้เคียง')
  })
})
