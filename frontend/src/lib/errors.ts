import { ApiError } from '../api/http'
import { MAX_FEEDBACK_COMMENT_LENGTH, MAX_OUTCOME_LENGTH } from './textInput'
import { HISTORY_RETENTION_DAYS } from './historyView'

type ErrorRecovery = 'retry' | 'reload-session' | 'back-to-symptoms' | 'back-to-history' | 'stay' | 'login'

interface ErrorDescription {
  title: string
  detail: string
  recovery: ErrorRecovery
  code?: string
}

const UNKNOWN_ERROR: ErrorDescription = {
  title: 'เกิดข้อผิดพลาดที่ระบบไม่รู้จัก',
  detail: 'ลองอีกครั้ง ถ้ายังเกิดซ้ำ ให้กลับไปเลือกอาการแล้วเริ่มตรวจใหม่',
  recovery: 'retry',
}

/** ข้อความของแต่ละ code ที่เซิร์ฟเวอร์ส่งมา */
const MESSAGES: Record<string, ErrorDescription> = {
  NETWORK_ERROR: {
    title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
    detail: 'ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง ถ้าเพิ่งเปิดเว็บ เซิร์ฟเวอร์อาจใช้เวลาเริ่มทำงานสักครู่',
    recovery: 'retry',
  },
  SAFETY_CONFIRMATION_REQUIRED: {
    title: 'เซิร์ฟเวอร์ไม่ให้ข้ามขั้นตอนนี้',
    detail: 'อ่านคำเตือนและติ๊กยืนยันก่อน จึงจะไปขั้นถัดไปได้',
    recovery: 'stay',
  },
  INVALID_ACTION: {
    title: 'หน้าจอไม่ตรงกับเซิร์ฟเวอร์',
    detail: 'ขั้นตอนบนหน้าจอเก่ากว่าที่เซิร์ฟเวอร์บันทึกไว้ ดึงขั้นตอนล่าสุดมาแสดง แล้วทำต่อจากตรงนั้น',
    recovery: 'reload-session',
  },
  SESSION_COMPLETED: {
    title: 'การตรวจนี้จบไปแล้ว',
    detail: 'การตรวจนี้ถึงสถานะสิ้นสุดแล้ว ดึงข้อมูลล่าสุดมาแสดงเพื่อดูผลการตรวจ',
    recovery: 'reload-session',
  },
  SESSION_NOT_FOUND: {
    title: 'ไม่พบการตรวจนี้',
    detail: 'การตรวจนี้อาจหมดอายุหรือถูกยกเลิกไปแล้ว เลือกอาการเพื่อเริ่มตรวจใหม่',
    recovery: 'back-to-symptoms',
  },
  GRAPH_MANUAL_MISMATCH: {
    title: 'อาการนี้ไม่ใช่ของรุ่นที่เลือก',
    detail: 'ระบบไม่เริ่มตรวจให้ เพราะขั้นตอนของอาการนี้เป็นของคนละรุ่นกับที่เลือกไว้ กลับไปเลือกรุ่นและอาการใหม่',
    recovery: 'back-to-symptoms',
  },
  GRAPH_NOT_FOUND: {
    title: 'ไม่พบอาการนี้',
    detail: 'อาการนี้ไม่มีในระบบแล้ว เลือกอาการอื่นจากรายการ',
    recovery: 'back-to-symptoms',
  },
  GRAPH_NODE_MISSING: {
    title: 'ข้อมูลขั้นตอนของอาการนี้ไม่สมบูรณ์',
    detail: 'ระบบหยุดการตรวจไว้เพื่อไม่ให้แสดงขั้นตอนที่ผิด แจ้งรหัสด้านล่างให้ผู้ดูแลระบบ แล้วเลือกอาการอื่นไปก่อน',
    recovery: 'back-to-symptoms',
    code: 'GRAPH_NODE_MISSING',
  },

  INVALID_QUERY: {
    title: 'ข้อความที่พิมพ์ใช้ค้นหาไม่ได้',
    detail: 'พิมพ์อาการที่พบให้ไม่ว่างและไม่ยาวเกิน 200 ตัวอักษร แล้วลองอีกครั้ง',
    recovery: 'stay',
  },
  SEARCH_NOT_READY: {
    title: 'ระบบค้นหากำลังเริ่มทำงาน',
    detail: 'รอสักครู่แล้วกดค้นหาอีกครั้ง หรือเลือกอาการจากหน้า "อาการทั้งหมด" ได้เลย',
    recovery: 'retry',
  },
  SEARCH_UNAVAILABLE: {
    title: 'ระบบค้นหาไม่พร้อมใช้งานตอนนี้',
    detail: 'เลือกอาการจากหน้า "อาการทั้งหมด" แทน ระบบจะถามทีละข้อตามคู่มือเหมือนกัน',
    recovery: 'stay',
  },
  INVALID_OUTCOME: {
    title: 'ข้อความผลลัพธ์บันทึกไม่ได้',
    detail: `พิมพ์ข้อความให้ไม่ว่างและไม่ยาวเกิน ${MAX_OUTCOME_LENGTH} ตัวอักษร แล้วกดบันทึกอีกครั้ง`,
    recovery: 'stay',
  },
  SESSION_NOT_COMPLETED: {
    title: 'การตรวจนี้ยังไม่จบ',
    detail: 'บันทึกผลได้เมื่อการตรวจถึงขั้นสุดท้ายแล้ว ดึงข้อมูลล่าสุดมาแสดงเพื่อดูสถานะจริง',
    recovery: 'reload-session',
  },
  OUTCOME_ALREADY_SUBMITTED: {
    title: 'การตรวจนี้บันทึกผลไปแล้ว',
    detail: 'บันทึกผลได้ครั้งเดียวต่อการตรวจ ดึงข้อมูลล่าสุดมาแสดงเพื่อดูข้อความที่บันทึกไว้',
    recovery: 'reload-session',
  },
  INVALID_CLIENT_ID: {
    title: 'ระบบระบุเบราว์เซอร์นี้ไม่ได้',
    detail: 'รีเฟรชหน้าแล้วลองอีกครั้ง ถ้ายังเกิดซ้ำ ให้ล้างข้อมูลเว็บไซต์นี้ในเบราว์เซอร์',
    recovery: 'retry',
  },
  INVALID_HISTORY_QUERY: {
    title: 'ขอหน้าประวัติไม่ถูกต้อง',
    detail: 'กลับไปหน้าแรกของประวัติแล้วลองอีกครั้ง',
    recovery: 'back-to-history',
  },
  INVALID_FEEDBACK: {
    title: 'บันทึกความเห็นไม่ได้',
    detail: `ข้อความต้องไม่ยาวเกิน ${MAX_FEEDBACK_COMMENT_LENGTH} ตัวอักษร แล้วกดบันทึกอีกครั้ง`,
    recovery: 'stay',
  },
  HISTORY_NOT_FOUND: {
    title: 'ไม่พบรายการนี้ในประวัติ',
    detail: `รายการอาจถูกลบแล้ว หมดอายุ (เก็บไว้ ${HISTORY_RETENTION_DAYS} วัน) หรือไม่ใช่ของคุณ (ประวัติของผู้ใช้ที่เข้าสู่ระบบแยกจากประวัติของเบราว์เซอร์ที่ไม่ได้เข้าสู่ระบบ)`,
    recovery: 'back-to-history',
  },
  INVALID_CREDENTIALS: {
    title: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    detail: 'ตรวจอีเมลและรหัสผ่านอีกครั้ง (ระบบไม่บอกว่าผิดที่ช่องไหนเพื่อความปลอดภัย)',
    recovery: 'stay',
  },
  EMAIL_TAKEN: {
    title: 'อีเมลนี้สมัครไว้แล้ว',
    detail: 'ถ้าเป็นบัญชีของคุณ ให้ไปหน้าเข้าสู่ระบบ หรือใช้อีเมลอื่นสมัคร',
    recovery: 'stay',
  },
  INVALID_AUTH_REQUEST: {
    title: 'ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง',
    detail: 'ตรวจว่ากรอกอีเมลถูกรูปแบบ รหัสผ่านยาว 8–72 ตัวอักษร และชื่อที่แสดงยาว 1–100 ตัวอักษร',
    recovery: 'stay',
  },
  UNAUTHENTICATED: {
    title: 'ต้องเข้าสู่ระบบ',
    detail: 'การเข้าสู่ระบบหมดอายุหรือยังไม่ได้เข้าสู่ระบบ เข้าสู่ระบบอีกครั้งแล้วทำต่อ',
    recovery: 'login',
  },
  FORBIDDEN: {
    title: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้',
    detail: 'ส่วนนี้สำหรับผู้ดูแลระบบเท่านั้น',
    recovery: 'stay',
  },
  INVALID_ADMIN_QUERY: {
    title: 'ตัวกรองไม่ถูกต้อง',
    detail: 'ตรวจช่วงวันที่ (วันเริ่มต้องไม่หลังวันสิ้นสุด และช่วงไม่เกิน 366 วัน) แล้วลองอีกครั้ง',
    recovery: 'stay',
  },
  INVALID_DRAFT_REQUEST: {
    title: 'ข้อมูลที่ส่งไม่ถูกต้อง',
    detail: 'ตรวจข้อมูลคู่มือ ช่วงหน้า และไฟล์ แล้วลองอีกครั้ง',
    recovery: 'stay',
  },
  PDF_TOO_LARGE: {
    title: 'ไฟล์ PDF ใหญ่เกินไป',
    detail: 'ไฟล์ใหญ่เกินเพดานที่ตั้งไว้ (ค่าเริ่มต้น 10 MB) หรือเกิน 200 หน้า — ใช้ไฟล์ที่เล็กลง หรือผู้ดูแลเซิร์ฟเวอร์ปรับ AUTHORING_MAX_PDF_MB',
    recovery: 'stay',
  },
  PDF_UNSUPPORTED_TYPE: {
    title: 'ไฟล์นี้ไม่ใช่ PDF',
    detail: 'เลือกไฟล์คู่มือที่เป็น PDF (ระบบตรวจจากเนื้อไฟล์จริง ไม่ใช่จากนามสกุล)',
    recovery: 'stay',
  },
  PDF_NO_TEXT: {
    title: 'ไม่พบข้อความใน PDF ช่วงหน้าที่เลือก',
    detail: 'ไฟล์อาจเป็นภาพสแกน ซึ่งระบบไม่รองรับ (ไม่ทำ OCR) — ใช้ PDF ที่เลือกคัดลอกข้อความได้ หรือเลือกช่วงหน้าอื่น',
    recovery: 'stay',
  },
  PDF_UNREADABLE: {
    title: 'อ่านไฟล์ PDF ไม่ได้',
    detail: 'ไฟล์อาจเสียหรือมีรหัสผ่าน ลองดาวน์โหลดไฟล์ใหม่จากแหล่งเดิม',
    recovery: 'stay',
  },
  PDF_PAGE_TOO_LONG: {
    title: 'มีหน้าที่ข้อความยาวเกินไป',
    detail: 'ระบบไม่ตัดข้อความทิ้งให้เพราะอาจทำให้คำเตือนหาย — เลือกช่วงหน้าใหม่',
    recovery: 'stay',
  },
  DRAFT_NOT_FOUND: {
    title: 'ไม่พบร่างแผนผังขั้นตอนนี้',
    detail: 'ร่างอาจถูกลบออกจากฐานข้อมูลแล้ว กลับไปที่รายการร่าง',
    recovery: 'stay',
  },
  DRAFT_NOT_READY: {
    title: 'ทำรายการนี้ไม่ได้ในสถานะปัจจุบันของร่าง',
    detail: 'ร่างอาจถูกเผยแพร่ ปฏิเสธ หรือกำลังร่างอยู่ — ดึงข้อมูลล่าสุดมาดูสถานะจริง',
    recovery: 'retry',
  },
  DRAFT_BUSY: {
    title: 'มีร่างอื่นกำลังถูกร่างอยู่',
    detail: 'ระบบร่างได้ทีละ 1 งาน รอให้งานเดิมเสร็จก่อน แล้วลองอีกครั้ง',
    recovery: 'retry',
  },
  DRAFT_INVALID: {
    title: 'ร่างยังไม่ผ่านการตรวจ เผยแพร่ไม่ได้',
    detail: 'แก้ข้อผิดพลาดในรายงานการตรวจให้หมดก่อน — ไม่มีทางข้ามการตรวจนี้',
    recovery: 'stay',
  },
  DRAFT_WARNINGS_UNACKNOWLEDGED: {
    title: 'ยังไม่ได้ยืนยันว่าอ่านคำเตือนแล้ว',
    detail: 'อ่านคำเตือนในรายงานการตรวจ แล้วติ๊กรับทราบคำเตือนก่อนเผยแพร่',
    recovery: 'stay',
  },
  DRAFT_ID_CONFLICT: {
    title: 'รหัสซ้ำกับข้อมูลที่ใช้งานอยู่',
    detail: 'ระบบไม่เขียนทับแผนผังขั้นตอนที่ใช้งานอยู่ — ใช้รหัสคู่มือใหม่',
    recovery: 'stay',
  },
  PUBLISH_RELOAD_FAILED: {
    title: 'เผยแพร่ลงฐานข้อมูลแล้ว แต่ระบบยังไม่โหลดแผนผังขั้นตอนใหม่',
    detail: 'แผนผังขั้นตอนเดิมยังใช้งานได้ตามปกติ รีสตาร์ตเซิร์ฟเวอร์ (backend) เพื่อให้แผนผังขั้นตอนใหม่ปรากฏ',
    recovery: 'stay',
    code: 'PUBLISH_RELOAD_FAILED',
  },
}

export function describeError(error: unknown): ErrorDescription {
  if (!(error instanceof ApiError)) {
    return UNKNOWN_ERROR
  }

  if (error.code === 'UNKNOWN_ERROR' && error.status === 400) {
    return {
      title: 'เซิร์ฟเวอร์อ่านคำขอไม่ได้',
      detail: 'ลองอีกครั้ง ถ้ายังเกิดซ้ำ ให้รีเฟรชหน้าแล้วทำใหม่',
      recovery: 'retry',
    }
  }

  if (!Object.hasOwn(MESSAGES, error.code)) {
    return UNKNOWN_ERROR
  }
  const known = MESSAGES[error.code]

  // 3 รหัสของร่างแผนผังใช้ข้อความจากเซิร์ฟเวอร์ประกอบ เพราะเป็นข้อความภาษาไทยที่เขียนให้ผู้ดูแลอ่าน
  // และบอกจุดที่ผิดเจาะจง (เช่น ฟิลด์ไหน id ไหน)
  if (error.code === 'INVALID_DRAFT_REQUEST' || error.code === 'PDF_PAGE_TOO_LONG') {
    return { ...known, detail: error.message || known.detail }
  }
  if (error.code === 'DRAFT_ID_CONFLICT') {
    return { ...known, detail: `${error.message ? `${error.message} ` : ''}${known.detail}` }
  }
  return known
}
