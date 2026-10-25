import { useId } from 'react'

const FIELD_CLASSES =
  'min-h-12 w-full rounded-lg border bg-canvas px-3 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

interface TextFieldProps {
  label: string
  type: 'email' | 'password' | 'text'
  value: string
  onChange: (value: string) => void
  autoComplete: string
  error?: string
  hint?: string
  maxLength?: number
  disabled?: boolean
}

/** ช่องกรอกของฟอร์มเข้าสู่ระบบ/สมัครสมาชิก: ป้ายกำกับ + คำใบ้ + ข้อความผิดพลาดที่ผูกกับช่อง (aria) */
export function TextField({ label, type, value, onChange, autoComplete, error, hint, maxLength, disabled }: TextFieldProps) {
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()

  const describedBy = [hint !== undefined ? hintId : undefined, error !== undefined ? errorId : undefined]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm text-ink-soft">
        {label}
      </label>
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-ink-faint">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className={`${FIELD_CLASSES} ${error !== undefined ? 'border-danger' : 'border-line'}`}/>
      {error !== undefined && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
