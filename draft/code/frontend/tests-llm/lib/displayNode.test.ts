import { describe, expect, it } from 'vitest'
import type { RenderedNode } from '../api/types'
import { pickDisplayNode } from './displayNode'

const base: RenderedNode = {
  nodeId: 'n1',
  type: 'checkpoint',
  text: 'ตรวจว่าปลั๊กเสียบแน่น',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: false,
  reference: { source: 'คู่มือ', pageRange: [43, 43] },
}

describe('pickDisplayNode', () => {
  it('ไม่มี displayText (null/undefined) → ใช้ต้นฉบับ', () => {
    expect(pickDisplayNode(base, null)).toEqual({ node: base })
    expect(pickDisplayNode(base, undefined)).toEqual({ node: base })
  })

  it('displayText ว่างหรือเท่าต้นฉบับ → ใช้ต้นฉบับ ไม่แสดงป้าย AI', () => {
    expect(pickDisplayNode(base, '   ')).toEqual({ node: base })
    expect(pickDisplayNode(base, ' ตรวจว่าปลั๊กเสียบแน่น ')).toEqual({ node: base })
  })

  it('มี displayText ที่ต่าง → แทน text เฉพาะข้อความ ฟิลด์อื่นเหมือนเดิม และเก็บต้นฉบับไว้', () => {
    const r = pickDisplayNode(base, 'ลองดูว่าปลั๊กเสียบแน่นดีไหม')
    expect(r.node.text).toBe('ลองดูว่าปลั๊กเสียบแน่นดีไหม')
    expect(r.originalText).toBe('ตรวจว่าปลั๊กเสียบแน่น')
    expect({ ...r.node, text: base.text }).toEqual(base)
  })

  it('ไม่แตะโหนดความปลอดภัย (ทั้ง safetyCritical และ requiresSafetyConfirmation) แม้เซิร์ฟเวอร์ส่งมา', () => {
    expect(pickDisplayNode({ ...base, safetyCritical: true }, 'ข้อความใหม่')).toEqual({ node: { ...base, safetyCritical: true } })
    expect(pickDisplayNode({ ...base, requiresSafetyConfirmation: true }, 'ข้อความใหม่').originalText).toBeUndefined()
  })

  it('ไม่แตะโหนดสิ้นสุด', () => {
    const terminal = { ...base, type: 'escalation' as const, isTerminal: true }
    expect(pickDisplayNode(terminal, 'ข้อความใหม่')).toEqual({ node: terminal })
  })
})
