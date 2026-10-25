const STORAGE_KEY = 'fixstep.clientId'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// id ที่จำไว้ในหน่วยความจำของแท็บ
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
