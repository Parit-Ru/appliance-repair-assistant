import { describe, expect, it } from 'vitest'
import { toTrailEntry } from './trail'
import type { TrailMarker } from './trail'
import type { RenderedNode, TraversalAction } from '../api/types'
import { checkpointNode, inputNode, instructionNode, safetyGateNode } from '../mocks/fixtures'

/**
 * แต่ละแถวคือ สถานะที่เพิ่งผ่าน + action ที่ส่งไป → สิ่งที่ต้องแสดงบนเส้นทาง
 * จับคู่สถานะกับ action ให้ตรงกับที่เกิดขึ้นได้จริง
 * เช่น confirm_safety ส่งได้เฉพาะสถานะที่ต้องยืนยันคำเตือน
 */
const CASES: {
  name: string
  node: RenderedNode
  action: TraversalAction
  answerLabel: string
  marker: TrailMarker
}[] = [
  {
    name: 'ตอบใช่ที่คำถาม',
    node: checkpointNode,
    action: { type: 'answer', value: 'yes' },
    answerLabel: 'ตอบ ใช่',
    marker: 'dot',
  },
  {
    name: 'ตอบไม่ใช่ที่คำถาม',
    node: checkpointNode,
    action: { type: 'answer', value: 'no' },
    answerLabel: 'ตอบ ไม่ใช่',
    marker: 'dot',
  },
  {
    name: 'กดถัดไปที่ขั้นตอนธรรมดา',
    node: instructionNode,
    action: { type: 'continue' },
    answerLabel: 'ไปต่อแล้ว',
    marker: 'dot',
  },
  {
    name: 'ยืนยันคำเตือนที่ขั้นตอนอันตราย',
    node: safetyGateNode,
    action: { type: 'confirm_safety' },
    answerLabel: 'ยืนยันคำเตือนแล้ว',
    marker: 'switch-off',
  },
  {
    name: 'กรอกรหัสข้อผิดพลาด',
    node: inputNode,
    action: { type: 'input', value: 'E1' },
    answerLabel: 'กรอก E1',
    marker: 'dot',
  },
]

describe('toTrailEntry', () => {
  it.each(CASES)('$name', ({ node, action, answerLabel, marker }) => {
    expect(toTrailEntry(node, action)).toEqual({
      nodeId: node.nodeId,
      text: node.text,
      answerLabel,
      marker,
    })
  })

  it('แสดงค่าที่กรอกตามที่ผู้ใช้พิมพ์ ไม่แปลงหรือตรวจรูปแบบ', () => {
    // การตรวจว่ารหัสถูกรูปแบบไหมเป็นหน้าที่ของกลไกควบคุมเครื่องสถานะ ไม่ใช่หน้าจอ
    const entry = toTrailEntry(inputNode, { type: 'input', value: 'e1' })
    expect(entry.answerLabel).toBe('กรอก e1')
  })
})