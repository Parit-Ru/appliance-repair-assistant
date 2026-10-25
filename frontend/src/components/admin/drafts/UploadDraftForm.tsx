import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUploadDraft } from '../../../api/queries'
import { DEVICE_CATEGORIES, DEVICE_CATEGORY_LABELS } from '../../../lib/labels'
import { MAX_DRAFT_PAGES, isDemoManualId, validateUploadForm } from '../../../lib/draftView'
import type { UploadFormErrors, UploadFormValues } from '../../../lib/draftView'
import { ErrorNotice } from '../../ErrorNotice'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'

const FIELD_CLASSES =
  'min-h-12 w-full rounded-lg border bg-canvas px-3 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const EMPTY: Omit<UploadFormValues, 'file'> = {
  manualId: 'demo_',
  deviceCategory: '',
  brand: '',
  modelPattern: '',
  sourceManual: '',
  displayName: '',
  pageFrom: '',
  pageTo: '',
}

interface FieldProps {
  label: string
  hint?: string
  error?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = useId()
  const errorId = useId()
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-ink-soft">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-ink-faint">
          {hint}
        </p>
      )}
      {children(id, describedBy)}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * ฟอร์มอัปโหลด PDF เพื่อให้ AI ร่างแผนผังขั้นตอน
 * ตรวจฝั่งหน้าจอเพื่อบอกทันที (UX) · backend ตรวจซ้ำทุกฟิลด์และตรวจไฟล์จริง (ขนาด ชนิด ข้อความ)
 * สำเร็จแล้วไปหน้าตรวจของร่างนั้น (หน้านั้นถามสถานะเองทุก 3 วินาทีระหว่างร่าง)
 */
export function UploadDraftForm() {
  const navigate = useNavigate()
  const upload = useUploadDraft()
  const [file, setFile] = useState<File | null>(null)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<UploadFormErrors>({})

  const set = (key: keyof typeof EMPTY) => (value: string) => setValues((current) => ({ ...current, [key]: value }))
  const border = (key: keyof UploadFormValues) => (errors[key] ? 'border-danger' : 'border-line')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validateUploadForm({ ...values, file: file === null ? null : { name: file.name, type: file.type } })
    setErrors(found)
    if (Object.keys(found).length > 0 || file === null) return

    upload.mutate(
      {
        file,
        manualId: values.manualId.trim(),
        deviceCategory: values.deviceCategory,
        brand: values.brand.trim(),
        modelPattern: values.modelPattern.trim(),
        sourceManual: values.sourceManual.trim(),
        displayName: values.displayName.trim() || undefined,
        pageFrom: Number(values.pageFrom),
        pageTo: Number(values.pageTo),
      },
      { onSuccess: (result) => navigate(`/admin/drafts/${result.id}`) },
    )
  }

  return (
    <section aria-label="อัปโหลดคู่มือ" className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">อัปโหลดคู่มือ PDF เพื่อร่างแผนผังขั้นตอน</h2>
        <p className="text-sm text-ink-soft">
          AI จะอ่านเฉพาะช่วงหน้าที่เลือก (ไม่เกิน {MAX_DRAFT_PAGES} หน้า) แล้วร่างแผนผังขั้นตอน ระบบตรวจด้วยกฎที่เขียนเป็นโค้ด และต้องมีผู้ดูแลอนุมัติก่อนผู้ใช้จะเห็น
          ไฟล์ PDF ไม่ถูกเก็บ — เก็บเฉพาะข้อความของหน้าที่เลือก
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="ไฟล์คู่มือ (PDF ที่เลือกคัดลอกข้อความได้ ไม่รองรับภาพสแกน)" error={errors.file}>
          {(id, describedBy) => (
            <input
              id={id}
              type="file"
              accept="application/pdf,.pdf"
              aria-describedby={describedBy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={upload.isPending}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-canvas file:px-3 file:py-2 file:text-ink"/>
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="หน้าเริ่ม" hint="เลขหน้าตามไฟล์ PDF (หน้าแรกของไฟล์ = 1)" error={errors.pageFrom}>
            {(id, describedBy) => (
              <input id={id} inputMode="numeric" value={values.pageFrom} onChange={(e) => set('pageFrom')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} ${border('pageFrom')}`} />
            )}
          </Field>
          <Field label="หน้าสุดท้าย" hint={`ช่วงหน้า Troubleshooting ไม่เกิน ${MAX_DRAFT_PAGES} หน้า`} error={errors.pageTo}>
            {(id, describedBy) => (
              <input id={id} inputMode="numeric" value={values.pageTo} onChange={(e) => set('pageTo')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} ${border('pageTo')}`} />
            )}
          </Field>
        </div>

        <Field
          label="รหัสคู่มือ (manual_id)"
          hint="a-z 0-9 _ เท่านั้น ต้องเป็นคู่มือใหม่ที่ยังไม่มีในระบบ · การทดสอบให้ขึ้นต้นด้วย demo_ เพื่อลบทีหลังได้ปลอดภัย"
          error={errors.manualId}
        >
          {(id, describedBy) => (
            <input id={id} value={values.manualId} onChange={(e) => set('manualId')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} font-mono ${border('manualId')}`} />
          )}
        </Field>
        {values.manualId.trim().length >= 3 && !isDemoManualId(values.manualId) && (
          <Notice tone="info" title="รหัสไม่ได้ขึ้นต้นด้วย demo_">
            ถ้าเป็นการทดสอบ แนะนำให้ขึ้นต้นด้วย demo_ เพราะคู่มือที่เผยแพร่แล้วลบได้ด้วย SQL เท่านั้น (ดู docs/authoring/authoring-step5.md)
          </Notice>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ประเภทเครื่อง" error={errors.deviceCategory}>
            {(id, describedBy) => (
              <select id={id} value={values.deviceCategory} onChange={(e) => set('deviceCategory')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} ${border('deviceCategory')}`}>
                <option value="">เลือกประเภทเครื่อง</option>
                {DEVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {DEVICE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="ยี่ห้อ" error={errors.brand}>
            {(id, describedBy) => (
              <input id={id} value={values.brand} onChange={(e) => set('brand')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} ${border('brand')}`} />
            )}
          </Field>
          <Field label="รุ่น (model pattern)" error={errors.modelPattern}>
            {(id, describedBy) => (
              <input id={id} value={values.modelPattern} onChange={(e) => set('modelPattern')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} ${border('modelPattern')}`} />
            )}
          </Field>
          <Field label="ชื่อที่แสดง (ไม่บังคับ)" error={errors.displayName}>
            {(id, describedBy) => (
              <input id={id} value={values.displayName} onChange={(e) => set('displayName')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} ${border('displayName')}`} />
            )}
          </Field>
        </div>

        <Field label="ชื่อคู่มือต้นฉบับ (แสดงเป็นเอกสารอ้างอิงให้ผู้ใช้)" error={errors.sourceManual}>
          {(id, describedBy) => (
            <input id={id} value={values.sourceManual} onChange={(e) => set('sourceManual')(e.target.value)} aria-describedby={describedBy} disabled={upload.isPending} className={`${FIELD_CLASSES} ${border('sourceManual')}`} />
          )}
        </Field>

        {upload.isError && <ErrorNotice error={upload.error} />}

        <Button type="submit" isLoading={upload.isPending}>
          อัปโหลดและเริ่มร่าง
        </Button>
      </form>
    </section>
  )
}
