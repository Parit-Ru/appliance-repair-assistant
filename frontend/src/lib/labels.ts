import type { DeviceCategory, InputType, OutcomeKind } from '../api/types'

/**
 * แปลงค่าจากข้อมูล (ภาษาอังกฤษ) เป็นข้อความไทยที่แสดงบนหน้าจอ
 *
 * ไฟล์นี้มีแต่ค่าคงที่ ไม่มีตรรกะ จึงไม่มีเทส
 * ใช้ Record<..., string> ทุกตาราง ถ้าวันหนึ่งเพิ่มค่าใหม่ใน type
 * แต่ลืมเพิ่มในตาราง TypeScript จะ build ไม่ผ่าน จึงไม่มีทางลืมได้
 */

// ============================================================
// ประเภทเครื่อง — ใช้ที่หัวกลุ่มในหน้าเลือกอาการ
// ============================================================

/**
 * ต้องมี Microwave ด้วย แม้ไมโครเวฟถูกตัดออกจากขอบเขตแล้ว
 * เพราะ DeviceCategory ใน engine ยังมีค่านี้อยู่ ถ้าไม่ใส่ Record จะ compile ไม่ผ่าน
 * ถ้าลบออกจาก engine เมื่อไร ให้ลบบรรทัดนี้ตาม
 */
export const DEVICE_CATEGORY_LABELS: Record<DeviceCategory, string> = {
  'Air Conditioner': 'เครื่องปรับอากาศ',
  Refrigerator: 'ตู้เย็น',
  'Washing Machine': 'เครื่องซักผ้า',
  Television: 'โทรทัศน์',
}

// ============================================================
// หัวข้อของสถานะสิ้นสุด
// ============================================================

/**
 * outcomeKind บอกว่าจบแบบไหน สองแบบแรกคือ resolution สองแบบหลังคือ escalation
 * - handoff_informed = คู่มือบอกให้ติดต่อช่าง และเรามีข้อมูลให้ช่างได้ เช่น รหัสข้อผิดพลาด
 * - handoff_unknown  = เดินมาถึงทางที่คู่มือไม่ได้เขียนไว้ ระบบจึงไม่เดาต่อ
 */
export const OUTCOME_TITLES: Record<OutcomeKind, string> = {
  user_fixed: 'แก้ปัญหาได้แล้ว',
  normal_behavior: 'เครื่องทำงานปกติ ไม่ได้เสีย',
  handoff_informed: 'ส่งต่อศูนย์บริการ พร้อมข้อมูลสำหรับช่าง',
  handoff_unknown: 'คู่มือไม่ครอบคลุมกรณีนี้',
}

// ============================================================
// ป้ายชนิดของสถานะ
// ============================================================

/**
 * ชนิดของป้าย ไม่ใช่ NodeType ตรงๆ เพราะ
 *   1. instruction แบ่งเป็นสองป้าย ตามว่าต้องยืนยันคำเตือนหรือไม่
 *   2. resolution และ escalation ไม่มีป้ายนี้ เพราะสถานะสิ้นสุดใช้ OUTCOME_TITLES แทน
 * หน้าจอเป็นคนเลือก key จาก type + requiresSafetyConfirmation ของ RenderedNode
 */
export type StepKind = 'checkpoint' | 'instruction' | 'safety_instruction' | 'input'

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  checkpoint: 'คำถาม',
  instruction: 'ขั้นตอน',
  safety_instruction: 'ขั้นตอนที่ต้องยืนยันคำเตือน',
  input: 'กรอกข้อมูล',
}

// ============================================================
// ข้อความบนปุ่มส่งของสถานะ input
// ============================================================

export const INPUT_SUBMIT_LABELS: Record<InputType, string> = {
  error_code: 'ส่งรหัส',
  model_number: 'ส่งรุ่นเครื่อง',
  number: 'ส่ง',
  text: 'ส่ง',
}