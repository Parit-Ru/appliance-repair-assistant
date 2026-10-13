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
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
}

/**
 * เรียกเซิร์ฟเวอร์หนึ่งครั้ง
 *
 * @param path ต้องขึ้นต้นด้วย / เช่น '/traversal/graphs'
 *             ส่วน VITE_API_URL ต้องไม่มี / ท้าย จะได้ไม่กลายเป็น //
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options
  const url = `${getBaseUrl()}${path}`

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
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