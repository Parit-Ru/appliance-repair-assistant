import type { ReactNode } from 'react'
import { Icon } from './ui/Icon'

export function LoadingText({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-ink-soft">
      <Icon name="spinner" className="h-5 w-5 animate-spin" />
      {children}
    </p>
  )
}
