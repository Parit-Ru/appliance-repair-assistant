export function safeNext(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return undefined
  if (/^\/(login|register)(\/|\?|$)/.test(raw)) return undefined
  return raw
}

type LoginReason = 'expired' | 'login-required'

export function loginUrl(reason: LoginReason | undefined, next: string | undefined): string {
  const params = new URLSearchParams()
  if (reason !== undefined) params.set('reason', reason)
  const safe = safeNext(next)
  if (safe !== undefined) params.set('next', safe)
  const query = params.toString()
  return query === '' ? '/login' : `/login?${query}`
}
