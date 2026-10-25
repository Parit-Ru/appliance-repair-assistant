import { createContext, useContext } from 'react'
import type { AuthUser } from '../api/types'

export type AuthStatus = 'verifying' | 'guest' | 'user'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | undefined
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
}

const GUEST_VALUE: AuthContextValue = {
  status: 'guest',
  user: undefined,
  login: () => Promise.reject(new Error('ต้องอยู่ใน AuthProvider')),
  register: () => Promise.reject(new Error('ต้องอยู่ใน AuthProvider')),
  logout: () => undefined,
}

export const AuthContext = createContext<AuthContextValue>(GUEST_VALUE)

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function useIdentity(): string {
  return useContext(AuthContext).user?.id ?? 'guest'
}
