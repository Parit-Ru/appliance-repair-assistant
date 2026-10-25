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
  body?: unknown
  headers?: Record<string, string>
  anonymous?: boolean
}


type UnauthorizedHandler = (usedToken: string) => void
let unauthorizedHandler: UnauthorizedHandler | undefined

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, anonymous = false } = options
  const url = `${getBaseUrl()}${path}`

  const token = anonymous ? undefined : getStoredToken()
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const mergedHeaders: Record<string, string> = {
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
