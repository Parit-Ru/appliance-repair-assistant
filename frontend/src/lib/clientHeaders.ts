import { getStoredToken } from './authStorage'
import { getClientId } from './clientId'

export function ownerHeaders(): Record<string, string> {
  return getStoredToken() === undefined ? { 'X-Client-Id': getClientId() } : {}
}
