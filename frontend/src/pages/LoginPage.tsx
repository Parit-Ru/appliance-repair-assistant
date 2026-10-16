import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { TextField } from '../components/auth/TextField'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/Notice'
import { useAuth } from '../lib/authContext'
import { hasErrors, validateLogin } from '../lib/authForm'
import type { FormErrors } from '../lib/authForm'
import { safeNext } from '../lib/authRedirect'
import { describeError } from '../lib/errors'

/**
 * หน้าเข้าสู่ระบบ (/login) — ทางเลือกเสริม ไม่จำเป็นต่อการตรวจอาการ (guest ใช้ได้เหมือนเดิม)
 *
 * ?reason=expired        → บอกว่าการเข้าสู่ระบบหมดอายุ (มาจากการที่ token ถูกปฏิเสธ)
 * ?reason=login-required → มาจากหน้าที่ต้องเข้าสู่ระบบ (เช่น หน้าผู้ดูแลระบบ)
 * ?next=/path            → กลับไปหน้านั้นหลังสำเร็จ (เฉพาะ path ภายในแอป ดู safeNext)
 */
export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const reason = searchParams.get('reason')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})

  const submit = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: () => navigate(next ?? '/', { replace: true }),
  })

  // ล็อกอินอยู่แล้วเปิดหน้านี้ → ไปต่อเลย (ไม่ใช้ตอนกำลังส่งฟอร์ม เพราะ onSuccess พาไปเอง)
  if (status === 'user' && !submit.isPending) {
    return <Navigate to={next ?? '/'} replace />
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateLogin(email, password)
    setFieldErrors(errors)
    if (hasErrors(errors)) return
    submit.mutate()
  }

  const described = submit.isError ? describeError(submit.error) : undefined

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>
        <p className="text-ink-soft">เข้าสู่ระบบเพื่อเก็บประวัติการซ่อมไว้กับบัญชีของคุณ ไม่เข้าสู่ระบบก็ตรวจอาการได้ตามปกติ</p>
      </div>

      {reason === 'expired' && (
        <Notice tone="info" title="การเข้าสู่ระบบหมดอายุ">
          กรุณาเข้าสู่ระบบอีกครั้ง
        </Notice>
      )}
      {reason === 'login-required' && (
        <Notice tone="info" title="หน้านี้ต้องเข้าสู่ระบบ">
          เข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์แล้วระบบจะพากลับไปหน้าที่ต้องการ
        </Notice>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="อีเมล"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={fieldErrors.email}
          disabled={submit.isPending}
        />
        <TextField
          label="รหัสผ่าน"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={fieldErrors.password}
          disabled={submit.isPending}
        />

        {described !== undefined && (
          <div role="alert">
            <Notice tone="danger" title={described.title}>
              <p>{described.detail}</p>
            </Notice>
          </div>
        )}

        <Button type="submit" isLoading={submit.isPending} className="w-full">
          เข้าสู่ระบบ
        </Button>
      </form>

      <p className="text-sm text-ink-soft">
        ยังไม่มีบัญชี?{' '}
        <Link to={next === undefined ? '/register' : `/register?next=${encodeURIComponent(next)}`} className="text-accent underline-offset-4 hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  )
}
