import type { NodeReference, RenderedNode } from '../api/types'
const REFERENCE_P43: NodeReference = {
  source: 'RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04',
  pageRange: [43, 43],
}

const REFERENCE_P44: NodeReference = {
  source: 'RAC255-00_IB_26Y_AR80H_WindFree_GEO_CB_EN-WEB_251229-D04',
  pageRange: [44, 44],
}

export const checkpointNode: RenderedNode = {
  nodeId: 'n2',
  type: 'checkpoint',
  text: 'เบรกเกอร์ไฟฟ้า (circuit breaker) ตัดอยู่หรือไม่?',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: false,
  reference: REFERENCE_P43,
}

export const instructionNode: RenderedNode = {
  nodeId: 'n0',
  type: 'instruction',
  text: 'ก่อนอื่น ทราบไว้ว่าไม่มีชิ้นส่วนใดในเครื่องปรับอากาศที่สร้างกลิ่นแรงด้วยตัวเอง กลิ่นที่ได้มักมาจากอากาศในห้องหรือท่อน้ำทิ้งที่สกปรก',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  isTerminal: false,
  reference: REFERENCE_P44,
}
export const safetyGateNode: RenderedNode = {
  nodeId: 'n_fix_breaker',
  type: 'instruction',
  text: 'สับเบรกเกอร์กลับขึ้น แล้วลองเปิดเครื่องใหม่',
  safetyCritical: true,
  safetyWarning:
    'ก่อนแตะเบรกเกอร์: ตรวจสอบว่ามือแห้งและยืนบนพื้นแห้ง หากเบรกเกอร์ตัดซ้ำทันทีหลังสับขึ้น ห้ามสับซ้ำอีก — ให้ติดต่อช่างไฟฟ้าทันที (อาจมีไฟฟ้าลัดวงจร)',
  requiresSafetyConfirmation: true,
  isTerminal: false,
  reference: REFERENCE_P43,
}

export const inputNode: RenderedNode = {
  nodeId: 'n_record_code',
  type: 'input',
  text: 'กรอกรหัสข้อผิดพลาดที่แสดงบนหน้าจอ เช่น E1 หรือ C4 (กรอกให้ครบทั้งตัวอักษรและตัวเลข)',
  safetyCritical: false,
  requiresSafetyConfirmation: false,
  inputType: 'error_code',
  isTerminal: false,
  reference: REFERENCE_P44,
}
