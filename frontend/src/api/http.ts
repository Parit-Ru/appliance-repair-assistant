import { getStoredToken } from '../lib/authStorage'
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL
  if (!baseUrl) {
    throw new Error('ไม่ได้ตั้งค่า VITE_API_URL — ตรวจไฟล์ .env.development หรือ .env.production')
  }
  return baseUrl
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** object = ส่งเป็น JSON · FormData = ส่งแบบ multipart (อัปโหลดไฟล์) เบราว์เซอร์ใส่ Content-Type + boundary เอง */
  body?: unknown
  /** หัวข้อเพิ่มเติม เช่น X-Client-Id ของ guest (Content-Type ใส่ให้เองเมื่อมี body) */
  headers?: Record<string, string>
  /**
   * true = ไม่แนบ token และไม่ถือว่า 401 คือ "token เสีย" — ใช้กับ login/register
   * (401 ของการล็อกอินคือรหัสผ่านผิด ไม่ใช่เซสชันหมดอายุ จึงต้องไม่เด้งไปหน้าล็อกอินซ้ำ)
   */
  anonymous?: boolean
}

/**
 * ตัวจัดการเมื่อคำขอที่ "แนบ token ไป" ได้ 401 (token เสีย/หมดอายุ/บัญชีถูกลบ)
 * AuthProvider ลงทะเบียนไว้: ล้างการล็อกอิน + แคช แล้วพาไปหน้าเข้าสู่ระบบ
 * รับ token ที่ใช้ในคำขอนั้น เพื่อให้ตัวจัดการเมินถ้าผู้ใช้ล็อกอินใหม่/ออกไปแล้ว (คำขอเก่าที่ตอบช้า)
 */
type UnauthorizedHandler = (usedToken: string) => void

let unauthorizedHandler: UnauthorizedHandler | undefined

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler
}

/**
 * เรียกเซิร์ฟเวอร์หนึ่งครั้ง
 *
 * @param path ต้องขึ้นต้นด้วย / เช่น '/traversal/graphs'
 *             ส่วน VITE_API_URL ต้องไม่มี / ท้าย จะได้ไม่กลายเป็น //
 *
 * ถ้าล็อกอินอยู่ จะแนบ Authorization: Bearer <token> ให้ทุกคำขอ (ยกเว้น anonymous)
 * ไม่ล็อกอิน = ไม่มีหัวข้อนี้ และ 401 ไม่ทำให้เกิดการเด้งหรือวนซ้ำ (ไม่มี token ให้ถือว่าเสีย)
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, anonymous = false } = options
  const url = `${getBaseUrl()}${path}`

  const token = anonymous ? undefined : getStoredToken()
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const mergedHeaders: Record<string, string> = {
    // FormData: ห้ามใส่ Content-Type เอง (เบราว์เซอร์ต้องใส่ boundary ของ multipart ให้)
    ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
    ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: Object.keys(mergedHeaders).length === 0 ? undefined : mergedHeaders,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
  }

  if (!response.ok) {
    let parsed: ApiErrorBody | undefined
    try {
      parsed = (await response.json()) as ApiErrorBody
    } catch {
      parsed = undefined
    }

    if (response.status === 401 && token !== undefined) {
      unauthorizedHandler?.(token)
    }

    throw new ApiError(
      response.status,
      parsed?.code ?? 'UNKNOWN_ERROR',
      parsed?.message ?? `เซิร์ฟเวอร์ตอบรหัส ${response.status}`,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
