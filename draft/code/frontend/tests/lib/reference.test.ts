import { describe, expect, it } from 'vitest'
import { formatPages, formatSourceLine } from './reference'
import type { NodeReference } from '../api/types'

// ที่มาจริงของสถานะในหน้า 43 ของคู่มือแอร์ AR70H
const REFERENCE_P43: NodeReference = {
  source: 'RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04',
  pageRange: [43, 43],
}

describe('formatPages', () => {
  it('หน้าเดียว บอกเลขหน้าเดียว', () => {
    expect(formatPages([43, 43])).toBe('หน้า 43')
  })

  it('หลายหน้า คั่นด้วยขีดยาว (en dash) ไม่ใช่ hyphen', () => {
    expect(formatPages([43, 44])).toBe('หน้า 43–44')
  })
})

describe('formatSourceLine', () => {
  it('ไม่ส่งชื่อคู่มือมา ใช้รหัสเอกสารแทน', () => {
    expect(formatSourceLine(REFERENCE_P43)).toBe(
      'ที่มาของขั้นตอนนี้: RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04 หน้า 43',
    )
  })

  it('ส่งชื่อคู่มือมา ใช้ชื่อคู่มือ', () => {
    expect(formatSourceLine(REFERENCE_P43, 'Samsung AR70H**D1***')).toBe(
      'ที่มาของขั้นตอนนี้: คู่มือ Samsung AR70H**D1*** หน้า 43',
    )
  })
})