import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { Route, Routes, StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { HistoryDetail, RenderedNode } from '../api/types'
import { HistoryDetailPage } from './HistoryDetailPage'

const SERVICE_CENTER_TEXT = 'ไม่พบสาเหตุที่ตรงกับคู่มือ แนะนำให้ติดต่อศูนย์บริการ Samsung'

function node(partial: Partial<RenderedNode> & Pick<RenderedNode, 'nodeId' | 'text'>): RenderedNode {
  return {
    type: 'checkpoint',
    safetyCritical: false,
    requiresSafetyConfirmation: false,
    isTerminal: false,
    reference: { source: 'AR70H-manual.pdf', pageRange: [12, 14] },
    ...partial,
  }
}

const DETAIL: HistoryDetail = {
  sessionId: 's1',
  graphId: 'g_ac',
  startedAt: '2026-10-15T07:30:00.000Z',
  modelSelection: 'selected',
  confidence: 0.812,
  graph: {
    manualId: 'm_ac',
    entrySymptom: 'Not cooling',
    entrySymptomTh: 'แอร์ไม่เย็น',
    deviceCategory: 'Air Conditioner',
    brand: 'Samsung',
    modelPattern: 'AR70H**D1***',
    displayName: 'AR70H ห้องนอน',
  },
  outcomeKind: 'user_fixed',
  available: true,
  steps: [
    { node: node({ nodeId: 'n_q1', text: 'เครื่องเปิดติดไหม' }), action: { type: 'answer', value: 'yes' } },
    {
      node: node({
        nodeId: 'n_safe',
        type: 'instruction',
        text: 'ถอดปลั๊กแล้วทำความสะอาดแผ่นกรอง',
        safetyCritical: true,
        requiresSafetyConfirmation: true,
        safetyWarning: 'ถอดปลั๊กไฟก่อนทำความสะอาด',
      }),
      action: { type: 'confirm_safety' },
    },
  ],
  finalNode: node({ nodeId: 'n_fixed', type: 'resolution', text: 'แก้ได้แล้ว แอร์กลับมาเย็น', isTerminal: true, outcomeKind: 'user_fixed' }),
  safetyWarnings: ['ถอดปลั๊กไฟก่อนทำความสะอาด'],
  reference: { source: 'AR70H-manual.pdf', pageRange: [12, 14] },
  outcome: 'ล้างแผ่นกรองแล้วเย็นดี',
  feedback: null,
}

function render(detail: HistoryDetail): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(queryKeys.historyDetail(detail.sessionId), detail)
  return renderToString(
    <QueryClientProvider client={client}>
      <StaticRouter location={`/history/${detail.sessionId}`}>
        <Routes>
          <Route path="/history/:sessionId" element={<HistoryDetailPage />} />
        </Routes>
      </StaticRouter>
    </QueryClientProvider>,
  )
}

describe('HistoryDetailPage: ข้อมูลครบ', () => {
  it('แสดงปัญหา ผลการตรวจ ขั้นตอนที่ผ่านมา แหล่งอ้างอิง และข้อความที่ผู้ใช้บันทึกเอง จากข้อมูลที่ API ส่งมา', () => {
    const html = render(DETAIL)

    expect(html).toContain('แอร์ไม่เย็น')
    expect(html).toContain('AR70H ห้องนอน')
    expect(html).toMatch(/rounded-full[^>]*>แก้ได้แล้ว</)
    expect(html).toContain('แก้ได้แล้ว แอร์กลับมาเย็น')

    // ขั้นตอนที่ผ่านมา: ข้อความโหนด + สิ่งที่ผู้ใช้ทำ (ตัวเดียวกับเส้นทางในหน้าตรวจ)
    expect(html).toContain('เครื่องเปิดติดไหม')
    expect(html).toContain('ตอบ ใช่')
    expect(html).toContain('ถอดปลั๊กแล้วทำความสะอาดแผ่นกรอง')
    expect(html).toContain('ยืนยันคำเตือนแล้ว')

    expect(html).toContain('ที่มาของขั้นตอนนี้')
    expect(html).toContain('คู่มือ Samsung AR70H ห้องนอน')
    expect(html).toContain('ล้างแผ่นกรองแล้วเย็นดี')
  })

  it('ไม่มีหัวข้อ "สาเหตุที่เป็นไปได้" (ไม่มีข้อมูลนี้ ไม่ใส่หัวข้อว่าง)', () => {
    const html = render(DETAIL)

    expect(html).not.toContain('สาเหตุ')
    expect(html).not.toContain('Possible Cause')
  })

  it('คะแนนมี: แสดงเป็นทศนิยม 3 ตำแหน่งแบบเดียวกับหน้าตรวจ', () => {
    const html = render(DETAIL)

    expect(html).toContain('0.812')
    expect(html).not.toContain('ไม่มีคะแนน')
  })

  it('คะแนนเป็น null: แสดง "ไม่มีคะแนน" ไม่ใช่ 0 และไม่ใช่ "ต่ำ"', () => {
    const html = render({ ...DETAIL, confidence: null })

    expect(html).toContain('ไม่มีคะแนน')
    expect(html).not.toMatch(/font-mono">0(\.|<)/) // ไม่ขึ้นเป็นตัวเลข 0 / 0.000
    expect(html).not.toContain('ต่ำ')
    expect(html).not.toContain('คะแนนความคล้าย')
  })
})

describe('HistoryDetailPage: คำเตือนความปลอดภัย', () => {
  it('มีคำเตือนในผังที่ผ่าน: กล่องแดงแสดงข้อความจากผังตรงๆ', () => {
    const html = render(DETAIL)

    expect(html).toContain('คำเตือนด้านความปลอดภัย')
    expect(html).toContain('border-danger/40')
    expect(html).toContain('ถอดปลั๊กไฟก่อนทำความสะอาด')
  })

  it('ไม่มีคำเตือน: ไม่มีกล่องแดงเลย', () => {
    const html = render({ ...DETAIL, safetyWarnings: [] })

    expect(html).not.toContain('คำเตือนด้านความปลอดภัย')
    expect(html).not.toContain('border-danger/40')
  })
})

describe('HistoryDetailPage: ผลการตรวจแต่ละแบบ', () => {
  it('หลักฐานไม่เพียงพอ: ใช้ข้อความของโหนดสุดท้ายจากเซิร์ฟเวอร์ ไม่เขียนคำแนะนำเอง', () => {
    const html = render({
      ...DETAIL,
      outcomeKind: 'handoff_unknown',
      finalNode: node({ nodeId: 'n_unknown', type: 'escalation', text: SERVICE_CENTER_TEXT, isTerminal: true, outcomeKind: 'handoff_unknown' }),
    })

    expect(html).toMatch(/rounded-full[^>]*>หลักฐานไม่เพียงพอ</)
    expect(html).toContain(SERVICE_CENTER_TEXT)
  })

  it('ยังไม่ได้แก้ และ เครื่องทำงานปกติ ใช้ป้ายที่ตกลงกัน', () => {
    const informed = render({ ...DETAIL, outcomeKind: 'handoff_informed' })
    const normal = render({ ...DETAIL, outcomeKind: 'normal_behavior' })

    expect(informed).toMatch(/rounded-full[^>]*>ยังไม่ได้แก้</)
    expect(normal).toMatch(/rounded-full[^>]*>เครื่องทำงานปกติ ไม่ได้เสีย</)
  })
})

describe('HistoryDetailPage: ปุ่มตรวจซ้ำ', () => {
  it('modelSelection มีค่า: "ตรวจอาการนี้อีกครั้ง" และ "ตรวจอาการอื่นของรุ่นนี้"', () => {
    const html = render(DETAIL)

    expect(html).toContain('ตรวจอาการนี้อีกครั้ง')
    expect(html).toContain('ตรวจอาการอื่นของรุ่นนี้')
  })

  it('modelSelection เป็น null: ป้ายไม่อ้างว่า "ของรุ่นนี้" (ไม่พาไปหน้าที่จะบันทึกเป็น selected)', () => {
    const html = render({ ...DETAIL, modelSelection: null })

    expect(html).toContain('ตรวจอาการนี้อีกครั้ง')
    expect(html).toContain('ตรวจอาการอื่น<')
    expect(html).not.toContain('ตรวจอาการอื่นของรุ่นนี้')
  })
})

describe('HistoryDetailPage: ให้คะแนน', () => {
  it('ยังไม่เคยให้: ฟอร์ม 👍/👎 + ช่องข้อความ ยังไม่ขึ้น "บันทึกแล้ว"', () => {
    const html = render(DETAIL)

    expect(html).toContain('ให้คะแนนผลการตรวจนี้')
    expect(html).toContain('ช่วยได้')
    expect(html).toContain('ไม่ช่วย')
    expect(html).toContain('<textarea')
    expect(html).toContain('maxLength="500"') // เพดานของช่องข้อความ
    expect(html).toMatch(/0(<!-- -->)?\/(<!-- -->)?500/) // ตัวนับ
    expect(html).toContain('ไม่บังคับ')
    expect(html).not.toContain('บันทึกแล้ว')
  })

  it('เคยให้แล้ว: ฟอร์มขึ้นพร้อมค่าเดิมและบอกว่าบันทึกแล้ว', () => {
    const html = render({ ...DETAIL, feedback: { helpful: true, comment: 'ใช้ได้ผลดี' } })

    expect(html).toContain('ใช้ได้ผลดี')
    expect(html).toContain('บันทึกแล้ว')
  })
})

describe('HistoryDetailPage: ผังเปลี่ยนไปแล้ว (available = false)', () => {
  const UNAVAILABLE: HistoryDetail = {
    ...DETAIL,
    outcomeKind: null,
    available: false,
    steps: [],
    finalNode: null,
    safetyWarnings: [],
    reference: null,
  }

  it('บอกว่าดูรายละเอียดไม่ได้ ไม่แสดงขั้นตอน/ผล/คำเตือน/คะแนน แต่ยังเห็นข้อความที่ผู้ใช้บันทึกเอง', () => {
    const html = render(UNAVAILABLE)

    expect(html).toContain('ข้อมูลผังเปลี่ยนไปแล้ว ดูรายละเอียดไม่ได้')
    expect(html).toContain('ล้างแผ่นกรองแล้วเย็นดี')
    expect(html).not.toContain('ขั้นตอนที่ผ่านมา')
    expect(html).not.toContain('>ผลการตรวจ<') // หัวข้อของการ์ดผล (ข้อความใน Notice มีคำนี้อยู่ในประโยคจึงไม่นับ)
    expect(html).not.toContain('คำเตือนด้านความปลอดภัย')
    expect(html).not.toContain('>ความมั่นใจ<')
    expect(html).not.toContain('แก้ได้แล้ว')
    expect(html).not.toContain('ให้คะแนนผลการตรวจนี้')
  })

  it('ผังยังอยู่ (ตรวจซ้ำได้) แต่ผังหายทั้งผัง: ไม่มีปุ่มตรวจซ้ำ แต่ยังลบได้และไปตรวจอาการอื่นได้', () => {
    const html = render({ ...UNAVAILABLE, graph: null })

    expect(html).toContain('ข้อมูลผังเปลี่ยนไปแล้ว ดูรายละเอียดไม่ได้')
    expect(html).not.toContain('ตรวจอาการนี้อีกครั้ง')
    expect(html).toContain('ลบรายการนี้ออกจากประวัติ')
    expect(html).not.toContain('undefined')
  })

  it('ผังยังอยู่: ตรวจอาการนี้อีกครั้งได้', () => {
    expect(render(UNAVAILABLE)).toContain('ตรวจอาการนี้อีกครั้ง')
  })
})
