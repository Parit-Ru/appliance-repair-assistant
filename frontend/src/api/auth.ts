import { request } from './http'
import type { AuthResponse, AuthUser } from './types'

export interface Session {
  token: string
  user: AuthUser
}

function toAuthUser({ id, displayName, role }: AuthUser): AuthUser {
  return { id, displayName, role }
}

function toSession(response: AuthResponse): Session {
  return { token: response.accessToken, user: toAuthUser(response.user) }
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  })
  return toSession(response)
}

export async function register(email: string, password: string, displayName: string): Promise<Session> {
  const response = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
    anonymous: true,
  })
  return toSession(response)
}

export async function getMe(): Promise<AuthUser> {
  return toAuthUser(await request<AuthUser>('/auth/me'))
}
