import { ApiError } from '../api/http'
import { MAX_FEEDBACK_COMMENT_LENGTH } from './feedback'
import { HISTORY_RETENTION_DAYS } from './historyView'
import { MAX_OUTCOME_LENGTH } from './outcome'

/**
 * แปลงข้อผิดพลาดจากเซิร์ฟเวอร์เป็นข้อความที่ผู้ใช้อ่านแล้วรู้ว่าต้องทำอะไรต่อ
 *
 * ตัดสินจาก code เท่านั้น ไม่ใช้ message ที่เซิร์ฟเวอร์ส่งมา
 * เพราะ message ของกลไกควบคุมเครื่องสถานะเขียนไว้ให้นักพัฒนาอ่าน
 * เช่น มีรหัสสถานะภาษาอังกฤษปนอยู่ ผู้ใช้ทั่วไปอ่านไม่เข้าใจ
 *
 * ฟังก์ชันนี้ใช้แสดงผลอย่างเดียว ไม่ได้ตัดสินว่าขั้นตอนถัดไปคืออะไร
 */

/**
 * สิ่งที่หน้าจอควรให้ผู้ใช้ทำต่อ
 * - retry            ลองส่งคำขอเดิมอีกครั้ง
 * - reload-session   ดึงสถานะล่าสุดของการตรวจจากเซิร์ฟเวอร์มาแสดงใหม่
 * - back-to-symptoms กลับไปหน้าเลือกอาการ
 * - back-to-history  กลับไปหน้าประวัติการซ่อม
 * - stay             อยู่ขั้นเดิม ไม่ต้องทำอะไรเพิ่ม
 * - login            เข้าสู่ระบบ (หรือเข้าใหม่) แล้วทำต่อ
 */
export type ErrorRecovery = 'retry' | 'reload-session' | 'back-to-symptoms' | 'back-to-history' | 'stay' | 'login'

export interface ErrorDescription {
  title: string
  detail: string
  recovery: ErrorRecovery
  /** แสดงให้เห็นเฉพาะกรณีข้อมูลขั้นตอนไม่สมบูรณ์ (500) เพื่อให้ผู้ใช้แจ้งผู้ดูแลระบบได้ */
  code?: string
}

const UNKNOWN_ERROR: ErrorDescription = {
  title: 'เกิดข้อผิดพลาดที่ระบบไม่รู้จัก',
  detail: 'ลองอีกครั้ง ถ้ายังเกิดซ้ำ ให้กลับไปเลือกอาการแล้วเริ่มตรวจใหม่',
  recovery: 'retry',
}
export function describeError(error: unknown): ErrorDescription {
  // Error ธรรมดา string หรือ undefined ไม่มี code ให้อ่าน จึงถือว่าไม่รู้จักทั้งหมด
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

  switch (error.code) {
    case 'NETWORK_ERROR':
      return {
        title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
        detail:
          'ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง ถ้าเพิ่งเปิดเว็บ เซิร์ฟเวอร์อาจใช้เวลาเริ่มทำงานสักครู่',
        recovery: 'retry',
      }

    case 'SAFETY_CONFIRMATION_REQUIRED':
      return {
        title: 'เซิร์ฟเวอร์ไม่ให้ข้ามขั้นตอนนี้',
        detail: 'อ่านคำเตือนและติ๊กยืนยันก่อน จึงจะไปขั้นถัดไปได้',
        recovery: 'stay',
      }

    case 'INVALID_ACTION':
      return {
        title: 'หน้าจอไม่ตรงกับเซิร์ฟเวอร์',
        detail: 'ขั้นตอนบนหน้าจอเก่ากว่าที่เซิร์ฟเวอร์บันทึกไว้ ดึงขั้นตอนล่าสุดมาแสดง แล้วทำต่อจากตรงนั้น',
        recovery: 'reload-session',
      }

    case 'SESSION_COMPLETED':
      return {
        title: 'การตรวจนี้จบไปแล้ว',
        detail: 'การตรวจนี้ถึงสถานะสิ้นสุดแล้ว ดึงข้อมูลล่าสุดมาแสดงเพื่อดูผลการตรวจ',
        recovery: 'reload-session',
      }

    case 'SESSION_NOT_FOUND':
      return {
        title: 'ไม่พบการตรวจนี้',
        detail: 'การตรวจนี้อาจหมดอายุหรือถูกยกเลิกไปแล้ว เลือกอาการเพื่อเริ่มตรวจใหม่',
        recovery: 'back-to-symptoms',
      }

    case 'GRAPH_MANUAL_MISMATCH':
      return {
        title: 'อาการนี้ไม่ใช่ของรุ่นที่เลือก',
        detail: 'ระบบไม่เริ่มตรวจให้ เพราะขั้นตอนของอาการนี้เป็นของคนละรุ่นกับที่เลือกไว้ กลับไปเลือกรุ่นและอาการใหม่',
        recovery: 'back-to-symptoms',
      }

    case 'GRAPH_NOT_FOUND':
      return {
        title: 'ไม่พบอาการนี้',
        detail: 'อาการนี้ไม่มีในระบบแล้ว เลือกอาการอื่นจากรายการ',
        recovery: 'back-to-symptoms',
      }

    //POST /symptom-search

    case 'INVALID_QUERY':
      return {
        title: 'ข้อความที่พิมพ์ใช้ค้นหาไม่ได้',
        detail: 'พิมพ์อาการที่พบให้ไม่ว่างและไม่ยาวเกิน 200 ตัวอักษร แล้วลองอีกครั้ง',
        recovery: 'stay',
      }

    case 'SEARCH_NOT_READY':
      return {
        title: 'ระบบค้นหากำลังเริ่มทำงาน',
        detail: 'รอสักครู่แล้วกดค้นหาอีกครั้ง หรือเลือกอาการจากหน้า "อาการทั้งหมด" ได้เลย',
        recovery: 'retry',
      }

    case 'SEARCH_UNAVAILABLE':
      return {
        title: 'ระบบค้นหาไม่พร้อมใช้งานตอนนี้',
        detail: 'เลือกอาการจากหน้า "อาการทั้งหมด" แทน ระบบจะถามทีละข้อตามคู่มือเหมือนกัน',
        recovery: 'stay',
      }

    //  (POST /traversal/sessions/:id/outcome)

    case 'INVALID_OUTCOME':
      return {
        title: 'ข้อความผลลัพธ์บันทึกไม่ได้',
        detail: `พิมพ์ข้อความให้ไม่ว่างและไม่ยาวเกิน ${MAX_OUTCOME_LENGTH} ตัวอักษร แล้วกดบันทึกอีกครั้ง`,
        recovery: 'stay',
      }

    case 'SESSION_NOT_COMPLETED':
      return {
        title: 'การตรวจนี้ยังไม่จบ',
        detail: 'บันทึกผลได้เมื่อการตรวจถึงขั้นสุดท้ายแล้ว ดึงข้อมูลล่าสุดมาแสดงเพื่อดูสถานะจริง',
        recovery: 'reload-session',
      }

    case 'OUTCOME_ALREADY_SUBMITTED':
      return {
        title: 'การตรวจนี้บันทึกผลไปแล้ว',
        detail: 'บันทึกผลได้ครั้งเดียวต่อการตรวจ ดึงข้อมูลล่าสุดมาแสดงเพื่อดูข้อความที่บันทึกไว้',
        recovery: 'reload-session',
      }

    //หน้าประวัติการซ่อม (GET/DELETE/POST /history…)

    case 'INVALID_CLIENT_ID':
      return {
        title: 'ระบบระบุเบราว์เซอร์นี้ไม่ได้',
        detail: 'รีเฟรชหน้าแล้วลองอีกครั้ง ถ้ายังเกิดซ้ำ ให้ล้างข้อมูลเว็บไซต์นี้ในเบราว์เซอร์',
        recovery: 'retry',
      }

    case 'INVALID_HISTORY_QUERY':
      return {
        title: 'ตัวกรองประวัติไม่ถูกต้อง',
        detail: 'ล้างตัวกรองแล้วลองอีกครั้ง',
        recovery: 'retry',
      }

    case 'INVALID_FEEDBACK':
      return {
        title: 'บันทึกความเห็นไม่ได้',
        detail: `ข้อความต้องไม่ยาวเกิน ${MAX_FEEDBACK_COMMENT_LENGTH} ตัวอักษร แล้วกดบันทึกอีกครั้ง`,
        recovery: 'stay',
      }

    case 'HISTORY_NOT_FOUND':
      return {
        title: 'ไม่พบรายการนี้ในประวัติ',
        detail: `รายการอาจถูกลบแล้ว หมดอายุ (เก็บไว้ ${HISTORY_RETENTION_DAYS} วัน) หรือไม่ใช่ของคุณ (ประวัติของผู้ใช้ที่เข้าสู่ระบบแยกจากประวัติของเบราว์เซอร์ที่ไม่ได้เข้าสู่ระบบ)`,
        recovery: 'back-to-history',
      }

    // บัญชีผู้ใช้ (POST /auth/register, /auth/login) และ guard ของ backend

    case 'INVALID_CREDENTIALS':
      return {
        title: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        detail: 'ตรวจอีเมลและรหัสผ่านอีกครั้ง (ระบบไม่บอกว่าผิดที่ช่องไหนเพื่อความปลอดภัย)',
        recovery: 'stay',
      }

    case 'EMAIL_TAKEN':
      return {
        title: 'อีเมลนี้สมัครไว้แล้ว',
        detail: 'ถ้าเป็นบัญชีของคุณ ให้ไปหน้าเข้าสู่ระบบ หรือใช้อีเมลอื่นสมัคร',
        recovery: 'stay',
      }

    case 'INVALID_AUTH_REQUEST':
      return {
        title: 'ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง',
        detail: 'ตรวจว่ากรอกอีเมลถูกรูปแบบ รหัสผ่านยาว 8–72 ตัวอักษร และชื่อที่แสดงยาว 1–100 ตัวอักษร',
        recovery: 'stay',
      }

    case 'UNAUTHENTICATED':
      return {
        title: 'ต้องเข้าสู่ระบบ',
        detail: 'การเข้าสู่ระบบหมดอายุหรือยังไม่ได้เข้าสู่ระบบ เข้าสู่ระบบอีกครั้งแล้วทำต่อ',
        recovery: 'login',
      }

    case 'FORBIDDEN':
      return {
        title: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้',
        detail: 'ส่วนนี้สำหรับผู้ดูแลระบบเท่านั้น',
        recovery: 'stay',
      }

    case 'INVALID_ADMIN_QUERY':
      return {
        title: 'ตัวกรองไม่ถูกต้อง',
        detail: 'ตรวจช่วงวันที่ (วันเริ่มต้องไม่หลังวันสิ้นสุด และช่วงไม่เกิน 366 วัน) แล้วลองอีกครั้ง',
        recovery: 'stay',
      }

    case 'GRAPH_NODE_MISSING':
    case 'GRAPH_SCHEMA_UNSUPPORTED':
      return {
        title: 'ข้อมูลขั้นตอนของอาการนี้ไม่สมบูรณ์',
        detail:
          'ระบบหยุดการตรวจไว้เพื่อไม่ให้แสดงขั้นตอนที่ผิด แจ้งรหัสด้านล่างให้ผู้ดูแลระบบ แล้วเลือกอาการอื่นไปก่อน',
        recovery: 'back-to-symptoms',
        code: error.code,
      }

    default:
      return UNKNOWN_ERROR
  }
}