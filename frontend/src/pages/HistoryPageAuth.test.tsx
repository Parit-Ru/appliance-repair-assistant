/**
 * ประวัติการซ่อมกับบัญชีผู้ใช้: ข้อความตามสถานะ และ "ผู้ใช้คนละคนไม่แชร์แคชกัน"
 * (ข้อ 4 ของการทดสอบด้วยมือ: A กับ B บนเบราว์เซอร์เดียวกันต้องไม่เห็นประวัติของกันและกัน)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '../api/queries'
import type { HistoryListResponse } from '../api/types'
import { AuthContext } from '../lib/authContext'
import type { AuthContextValue } from '../lib/authContext'
import { parseHistoryParams } from '../lib/historyParams'
import { ADMIN, GUEST, USER_A, USER_B } from '../lib/authTestValues'
import { HistoryPage } from './HistoryPage'

const GRAPH = {
  manualId: 'm_ac',
  entrySymptom: 'Not cooling',
  entrySymptomTh: 'แอร์ไม่เย็นของผู้ใช้เอ',
  deviceCategory: 'Air Conditioner' as const,
  brand: 'Samsung',
  modelPattern: 'AR70H',
}

const LIST_OF_A: HistoryListResponse = {
  items: [{ sessionId: 'sess-of-a', graphId: 'g1', startedAt: '2026-10-15T07:30:00.000Z', outcomeKind: 'user_fixed', graph: GRAPH }],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  facets: { categories: ['Air Conditioner'], brands: ['Samsung'] },
}

/** แคชที่ใส่ประวัติของผู้ใช้ identity ที่กำหนดไว้ (ตามพารามิเตอร์ของ URL '/history') */
function render(auth: AuthContextValue, cachedFor?: { identity: string; data: HistoryListResponse }): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (cachedFor !== undefined) {
    client.setQueryData(queryKeys.historyList(parseHistoryParams(new URLSearchParams('')), cachedFor.identity), cachedFor.data)
  }
  return renderToString(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <StaticRouter location="/history">
          <HistoryPage />
        </StaticRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('ข้อความของหน้าประวัติตามสถานะ', () => {
  it('guest → ข้อความเดิม (ผูกกับเบราว์เซอร์) + ลิงก์ชวนเข้าสู่ระบบ และไม่มีกล่องบอกประวัติเก่า', () => {
    const html = render(GUEST)
    expect(html).toContain('ผูกกับเบราว์เซอร์เครื่องนี้')
    expect(html).toContain('href="/login?next=%2Fhistory"')
    expect(html).not.toContain('ประวัติที่ทำก่อนเข้าสู่ระบบอยู่ที่ไหน')
  })

  it('ล็อกอิน → ข้อความของบัญชี + กล่องบอกว่าประวัติที่ทำก่อนล็อกอินอยู่กับเบราว์เซอร์ ดูได้เมื่อออกจากระบบ', () => {
    const html = render(USER_A)
    expect(html).toContain('ในบัญชีของคุณ')
    expect(html).not.toContain('ผูกกับเบราว์เซอร์เครื่องนี้')
    expect(html).toContain('ประวัติที่ทำก่อนเข้าสู่ระบบอยู่ที่ไหน')
    expect(html).toContain('หน้านี้แสดงเฉพาะการตรวจที่ทำขณะเข้าสู่ระบบ')
    expect(html).toContain('ดูได้เมื่อออกจากระบบ')
  })
})

describe('แคชไม่ข้ามผู้ใช้', () => {
  it('ผู้ใช้ A มีข้อมูลในแคช → A เห็น', () => {
    const html = render(USER_A, { identity: 'user-a', data: LIST_OF_A })
    expect(html).toContain('แอร์ไม่เย็นของผู้ใช้เอ')
  })

  it('ผู้ใช้ B บนแคชเดียวกันไม่เห็นข้อมูลของ A (ต้องโหลดของตัวเองใหม่)', () => {
    const html = render(USER_B, { identity: 'user-a', data: LIST_OF_A })
    expect(html).not.toContain('แอร์ไม่เย็นของผู้ใช้เอ')
    expect(html).not.toContain('sess-of-a')
    expect(html).toContain('กำลังโหลดประวัติ')
  })

  it('guest บนแคชเดียวกัน (หลังออกจากระบบ) ไม่เห็นข้อมูลของ A', () => {
    const html = render(GUEST, { identity: 'user-a', data: LIST_OF_A })
    expect(html).not.toContain('แอร์ไม่เย็นของผู้ใช้เอ')
    expect(html).toContain('กำลังโหลดประวัติ')
  })

  it('admin ก็ไม่เห็นประวัติของผู้ใช้ในแคชของคนอื่น', () => {
    const html = render(ADMIN, { identity: 'user-a', data: LIST_OF_A })
    expect(html).not.toContain('แอร์ไม่เย็นของผู้ใช้เอ')
  })

  it('key ของแคชที่ขึ้นกับผู้ใช้มี identity ต่างกันเสมอ · ค่าเริ่มต้นคือ guest (พฤติกรรมเดิม)', () => {
    const params = parseHistoryParams(new URLSearchParams(''))
    expect(queryKeys.historyList(params, 'a')).not.toEqual(queryKeys.historyList(params, 'b'))
    expect(queryKeys.historyDetail('s1', 'a')).not.toEqual(queryKeys.historyDetail('s1', 'b'))
    expect(queryKeys.session('s1', 'a')).not.toEqual(queryKeys.session('s1', 'b'))
    expect(queryKeys.adminSummary(30, 'a')).not.toEqual(queryKeys.adminSummary(30, 'b'))
    expect(queryKeys.adminFeedback({ page: 1 }, 'a')).not.toEqual(queryKeys.adminFeedback({ page: 1 }, 'b'))
    expect(queryKeys.historyList(params)).toEqual(queryKeys.historyList(params, 'guest'))
    expect(queryKeys.session('s1')).toEqual(queryKeys.session('s1', 'guest'))
  })
})
