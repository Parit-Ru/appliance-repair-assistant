import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

type NoticeTone = 'info' | 'danger'

const TONE_CLASSES: Record<NoticeTone, { box: string; accent: string }> = {
  info: { box: 'border-info/40 bg-info/10', accent: 'text-info' },
  danger: { box: 'border-danger/40 bg-danger/10', accent: 'text-danger' },
}

const DEFAULT_ICONS: Record<NoticeTone, IconName> = {
  info: 'info',
  danger: 'warning',
}

interface NoticeProps {
  tone: NoticeTone
  title?: string
  children?: ReactNode
}

export function Notice({ tone, title, children }: NoticeProps) {
  const toneClasses = TONE_CLASSES[tone]
  const boxClasses = `flex gap-3 rounded-lg border p-4 text-sm ${toneClasses.box}`

  return (
    <div className={boxClasses}>
      <Icon name={DEFAULT_ICONS[tone]} className={`mt-0.5 h-5 w-5 shrink-0 ${toneClasses.accent}`} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className={`font-semibold ${toneClasses.accent}`}>{title}</p>}
        {children && <div className="text-ink">{children}</div>}
      </div>
    </div>
  )
}
