import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/http'
import { TextField } from '../components/auth/TextField'
import { ErrorNotice } from '../components/ErrorNotice'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/authContext'
import { MAX_DISPLAY_NAME_LENGTH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, hasErrors, validateRegister } from '../lib/authForm'
import type { FormErrors } from '../lib/authForm'
import { safeNext } from '../lib/authRedirect'

export function RegisterPage() {
  const { status, register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})

  const submit = useMutation({
    mutationFn: () => register(email.trim(), password, displayName.trim()),
    onSuccess: () => navigate(next ?? '/history', { replace: true }),
  })

  if (status === 'user' && !submit.isPending) {
    return <Navigate to={next ?? '/'} replace />
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateRegister(email, password, displayName)
    setFieldErrors(errors)
    if (hasErrors(errors)) return
    submit.mutate()
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">สมัครสมาชิก</h1>
        <p className="text-ink-soft">สมัครเพื่อเก็บประวัติการซ่อมไว้กับบัญชี ไม่สมัครก็ตรวจอาการได้ตามปกติ</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="ชื่อที่แสดง"
          type="text"
          value={displayName}
          onChange={setDisplayName}
          autoComplete="nickname"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          error={fieldErrors.displayName}
          disabled={submit.isPending} />
        <TextField
          label="อีเมล"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={fieldErrors.email}
          disabled={submit.isPending}/>
        <TextField
          label="รหัสผ่าน"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`ยาว ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} ตัวอักษร`}
          maxLength={MAX_PASSWORD_LENGTH}
          error={fieldErrors.password}
          disabled={submit.isPending}/>

        {submit.isError && (
          <ErrorNotice error={submit.error}>
            {submit.error instanceof ApiError && submit.error.code === 'EMAIL_TAKEN' && (
              <p className="mt-2">
                <Link to="/login" className="text-accent underline-offset-4 hover:underline">
                  ไปหน้าเข้าสู่ระบบ
                </Link>
              </p>
            )}
          </ErrorNotice>
        )}

        <Button type="submit" isLoading={submit.isPending} className="w-full">
          สมัครสมาชิก
        </Button>
      </form>

      <p className="text-sm text-ink-soft">
        มีบัญชีอยู่แล้ว?{' '}
        <Link to={next === undefined ? '/login' : `/login?next=${encodeURIComponent(next)}`} className="text-accent underline-offset-4 hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  )
}
