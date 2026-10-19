/**
 * client id ของเบราว์เซอร์นี้ — UUID ที่สุ่มสร้างเองครั้งเดียวแล้วเก็บไว้ใน localStorage
 *
 * ใช้ผูก session กับ "ประวัติการซ่อม" ของเบราว์เซอร์นี้ ส่งไปกับคำขอผ่านหัวข้อ X-Client-Id
 * (ตอนเริ่มตรวจ และทุกคำขอของหน้าประวัติ) ดูรายละเอียดและข้อจำกัดใน docs/features/history-page.md
 *
 * ไม่ใช่การยืนยันตัวตน: ใครรู้ id นี้ก็เห็นประวัติของ id นี้ได้ และล้างข้อมูลเบราว์เซอร์ = id หาย = ประวัติเดิมหาย
 *
 * localStorage อาจใช้ไม่ได้ (โหมดส่วนตัวบางตัว, ปิดคุกกี้/ข้อมูลเว็บ) ทุกการอ่าน/เขียนจึงอยู่ใน try/catch
 * ถ้าเก็บไม่ได้ จะใช้ id ที่จำไว้ในหน่วยความจำของแท็บนี้ (หายเมื่อปิดแท็บ) แทนการทำให้การตรวจล้ม
 */

const STORAGE_KEY = 'fixstep.clientId'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** id ที่จำไว้ในหน่วยความจำของแท็บ: กันสร้างใหม่ทุกครั้งเมื่ออ่าน localStorage ไม่ได้ */
let memoryId: string | undefined

function isClientId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function readStored(): string | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isClientId(stored) ? stored.toLowerCase() : undefined
  } catch {
    return undefined
  }
}

/** id ของเบราว์เซอร์นี้ ถ้ายังไม่มี (หรือค่าที่เก็บไว้เสีย) จะสร้างใหม่และเก็บไว้ */
export function getClientId(): string {
  if (memoryId !== undefined) return memoryId

  const stored = readStored()
  if (stored !== undefined) {
    memoryId = stored
    return memoryId
  }

  // randomUUID ใช้ได้ในหน้า https และ localhost (secure context) ซึ่งครอบคลุมที่ deploy จริงและตอนพัฒนา
  const created = crypto.randomUUID().toLowerCase()
  try {
    localStorage.setItem(STORAGE_KEY, created)
  } catch {
    // เก็บไม่ได้: ใช้ในหน่วยความจำของแท็บนี้ต่อไป
  }
  // เปิดสองแท็บพร้อมกันครั้งแรก: ถ้าอีกแท็บเขียนไปก่อน ให้ใช้ค่าของมันเพื่อให้ทุกแท็บเป็น id เดียวกัน
  memoryId = readStored() ?? created
  return memoryId
}
