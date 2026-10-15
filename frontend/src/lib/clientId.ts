/**
 * client id ของเบราว์เซอร์นี้ — UUID ที่สุ่มสร้างเองครั้งเดียวแล้วเก็บไว้ใน localStorage
 *
 * ใช้ผูก session กับ "ประวัติการซ่อม" ของเบราว์เซอร์นี้ ส่งไปกับคำขอผ่านหัวข้อ X-Client-Id
 * (ตอนเริ่มตรวจ และทุกคำขอของหน้าประวัติ) ดูรายละเอียดและข้อจำกัดใน docs/history-page.md
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

export function isClientId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // เบราว์เซอร์ที่ไม่มี randomUUID (หรือไม่ใช่บริบทที่ปลอดภัย): ประกอบ UUID v4 เอง
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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

  const created = generateId().toLowerCase()
  try {
    localStorage.setItem(STORAGE_KEY, created)
  } catch {
    // เก็บไม่ได้: ใช้ในหน่วยความจำของแท็บนี้ต่อไป
  }
  // เปิดสองแท็บพร้อมกันครั้งแรก: ถ้าอีกแท็บเขียนไปก่อน ให้ใช้ค่าของมันเพื่อให้ทุกแท็บเป็น id เดียวกัน
  memoryId = readStored() ?? created
  return memoryId
}
