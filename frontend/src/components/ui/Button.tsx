import type { ComponentProps } from 'react'
import { Icon } from './Icon'

export const LINK_CLASSES = 'text-accent underline-offset-4 hover:underline'

type ButtonVariant = 'primary' | 'secondary' | 'answer' | 'text'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'min-h-12 justify-center rounded-lg bg-accent px-4 py-2 text-base font-semibold text-canvas enabled:hover:brightness-110',
  secondary: 'min-h-12 justify-center rounded-lg border border-line bg-panel px-4 py-2 text-base text-ink enabled:hover:border-ink-faint',
  answer: 'min-h-14 w-full justify-start rounded-lg border border-line bg-panel px-4 py-3 text-left text-lg text-ink enabled:hover:border-accent',
  text: 'justify-center px-0 py-3 text-sm text-ink-soft underline-offset-4 enabled:hover:text-ink enabled:hover:underline',
}

const BASE_CLASSES = 'inline-flex items-center gap-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  isLoading?: boolean
}

export function Button({ variant = 'primary', isLoading = false, type = 'button', disabled, className, children, ...rest }: ButtonProps) {
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], className].filter(Boolean).join(' ')

  return (
    <button type={type} disabled={disabled || isLoading} aria-busy={isLoading || undefined} className={classes} {...rest}>
      {isLoading && <Icon name="spinner" className="h-4 w-4 shrink-0 animate-spin" />}
      {children}
    </button>
  )
}
