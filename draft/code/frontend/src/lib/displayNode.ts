import type { RenderedNode } from '../api/types'

export interface DisplayNode {
  /** โหนดที่ใช้แสดง: text อาจเป็นข้อความที่ AI ปรับถ้อยคำ ฟิลด์อื่นเหมือนต้นฉบับทุกตัว */
  node: RenderedNode
  /** ข้อความต้นฉบับจากคู่มือ มีเมื่อ node.text ถูกปรับถ้อยคำเท่านั้น */
  originalText?: string
}

/**
 * เลือกข้อความที่จะแสดงของโหนดปัจจุบัน
 *
 * เซิร์ฟเวอร์ส่ง displayText มาเมื่อเปิดโมดูลเรียบเรียงถ้อยคำและข้อความผ่านด่านตรวจแล้วเท่านั้น
 * กรณีอื่นทั้งหมดใช้ข้อความต้นฉบับ (fallback): ไม่มีค่า, ว่าง, เท่าต้นฉบับ
 *
 * ป้องกันซ้ำที่ฝั่งหน้าจอ: ถึงเซิร์ฟเวอร์จะส่งมา ก็ไม่แทนข้อความของโหนดความปลอดภัยและโหนดสิ้นสุด
 * (คำเตือน และคำแนะนำให้ติดต่อศูนย์บริการ ต้องเป็นถ้อยคำตามคู่มือเสมอ)
 */
export function pickDisplayNode(node: RenderedNode, displayText: string | null | undefined): DisplayNode {
  if (typeof displayText !== 'string') return { node }

  const text = displayText.trim()
  if (text === '' || text === node.text.trim()) return { node }
  if (node.safetyCritical || node.requiresSafetyConfirmation || node.isTerminal) return { node }

  return { node: { ...node, text }, originalText: node.text }
}
