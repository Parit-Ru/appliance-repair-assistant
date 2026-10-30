import { request } from './http'
import type { StoredAuth } from '../lib/authStorage'
import type { AuthResponse, AuthUser } from './types'

function toAuthUser({ id, displayName, role }: AuthUser): AuthUser {
  return { id, displayName, role }
}

function toStoredAuth(response: AuthResponse): StoredAuth {
  return { token: response.accessToken, user: toAuthUser(response.user) }
}

export async function login(email: string, password: string): Promise<StoredAuth> {
  const response = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  })
  return toStoredAuth(response)
}

export async function register(email: string, password: string, displayName: string): Promise<StoredAuth> {
  const response = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
    anonymous: true,
  })
  return toStoredAuth(response)
}

export async function getMe(): Promise<AuthUser> {
  return toAuthUser(await request<AuthUser>('/auth/me'))
}
