import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getMe, login as apiLogin, register as apiRegister } from '../../api/auth'
import { setUnauthorizedHandler } from '../../api/http'
import { AuthContext } from '../../lib/authContext'
import type { AuthContextValue, AuthStatus } from '../../lib/authContext'
import { loginUrl } from '../../lib/authRedirect'
import { clearStoredAuth, getStoredToken, readStoredAuth, storeAuth } from '../../lib/authStorage'
import type { StoredAuth } from '../../lib/authStorage'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location)
  useEffect(() => {
    locationRef.current = location
  }, [location])

  const [stored, setStored] = useState<StoredAuth | null>(readStoredAuth)
  const [verifying, setVerifying] = useState(stored !== null)

  useEffect(() => {
    setUnauthorizedHandler((usedToken) => {
      if (getStoredToken() !== usedToken) return

      clearStoredAuth()
      setStored(null)
      setVerifying(false)
      queryClient.clear()
      navigate(loginUrl('expired', locationRef.current.pathname + locationRef.current.search), { replace: true })
    })
    return () => setUnauthorizedHandler(undefined)
  }, [navigate, queryClient])

  useEffect(() => {
    const token = getStoredToken()
    if (token === undefined) return

    let cancelled = false
    getMe().then((user) => {
        if (cancelled || getStoredToken() !== token) return
        const next = { token, user }
        storeAuth(next)
        setStored(next)
        setVerifying(false)
      }).catch(() => {
        if (!cancelled) setVerifying(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const applySession = useCallback(
    (session: StoredAuth) => {
      storeAuth(session)
      setStored(session)
      setVerifying(false)
      queryClient.clear()
    },
    [queryClient],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await apiLogin(email, password))
    },
    [applySession],
  )

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      applySession(await apiRegister(email, password, displayName))
    },
    [applySession],
  )

  const logout = useCallback(() => {
    clearStoredAuth()
    setStored(null)
    setVerifying(false)
    queryClient.clear()
    navigate('/')
  }, [navigate, queryClient])

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = stored === null ? 'guest' : verifying ? 'verifying' : 'user'
    return { status, user: stored?.user, login, register, logout }
  }, [stored, verifying, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


 /* ลำดับเหตุการณ์:
   1. เปิดแอป: ถ้ามี token ที่จำไว้ → status = 'verifying' แล้วยิง GET /auth/me
      ใช้ได้ → อัปเดตชื่อ/role จากเซิร์ฟเวอร์ · 401 → http.ts เรียกตัวจัดการด้านล่าง (ล้างแล้วเด้งไปล็อกอิน)
      เครือข่ายล่ม → ใช้ค่าที่จำไว้ต่อ (หน้า admin จะถูก backend ปฏิเสธเองถ้าไม่ใช่ admin จริง)
   2. login/register/logout/token หมดอายุ: ล้างแคชของ React Query ทั้งหมดเสมอ
      (ผู้ใช้คนก่อนต้องไม่เหลือข้อมูลในหน่วยความจำ · key ของแคชมี identity ด้วยอีกชั้น ดู api/queries.ts)
 
  token ถูกเก็บใน lib/authStorage.ts (http.ts อ่านจากที่นั่นทุกคำขอ*/