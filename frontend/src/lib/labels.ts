import type { DeviceCategory, InputType, OutcomeKind } from '../api/types'


export const DEVICE_CATEGORY_LABELS: Record<DeviceCategory, string> = {
  'Air Conditioner': 'เครื่องปรับอากาศ',
  Microwave: 'เตาไมโครเวฟ',
  Refrigerator: 'ตู้เย็น',
  'Washing Machine': 'เครื่องซักผ้า',
  Television: 'โทรทัศน์',
}

export const OUTCOME_TITLES: Record<OutcomeKind, string> = {
  user_fixed: 'แก้ปัญหาได้แล้ว',
  normal_behavior: 'เครื่องทำงานปกติ ไม่ได้เสีย',
  handoff_informed: 'ส่งต่อศูนย์บริการ พร้อมข้อมูลสำหรับช่าง',
  handoff_unknown: 'คู่มือไม่ครอบคลุมกรณีนี้',
}


export type StepKind = 'checkpoint' | 'instruction' | 'safety_instruction' | 'input'

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  checkpoint: 'คำถาม',
  instruction: 'ขั้นตอน',
  safety_instruction: 'ขั้นตอนที่ต้องยืนยันคำเตือน',
  input: 'กรอกข้อมูล',
}


export const INPUT_SUBMIT_LABELS: Record<InputType, string> = {
  error_code: 'ส่งรหัส',
  model_number: 'ส่งรุ่นเครื่อง',
  number: 'ส่ง',
  text: 'ส่ง',
}