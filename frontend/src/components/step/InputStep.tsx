import { useState } from 'react'
import type { FormEvent } from 'react'
import type { InputType } from '../../api/types'
import { INPUT_SUBMIT_LABELS, STEP_KIND_LABELS } from '../../lib/labels'
import { Button } from '../ui/Button'
import { StepCard } from './StepCard'
import type { StepProps } from './StepView'

const BASE_INPUT_CLASSES = 'w-full rounded-lg border border-line bg-canvas px-4 py-3 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-40'

export function InputStep({ state, onAction, isPending, manualLabel }: StepProps) {
  const inputType: InputType = state.inputType ?? 'text'

  const [value, setValue] = useState('')
  const trimmed = value.trim()
  const canSubmit = trimmed !== '' && !isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    onAction({ type: 'input', value: trimmed })
  }

  const isCode = inputType === 'error_code' || inputType === 'model_number'
  const inputClasses = isCode ? `${BASE_INPUT_CLASSES} font-mono` : BASE_INPUT_CLASSES

  return (
    <StepCard label={STEP_KIND_LABELS.input} heading={state.text} reference={state.reference} manualLabel={manualLabel}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={value} onChange={(event) => setValue(event.target.value)} disabled={isPending} aria-label={state.text} inputMode={inputType === 'number' ? 'numeric' : 'text'} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} className={inputClasses} />

        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {INPUT_SUBMIT_LABELS[inputType]}
        </Button>
      </form>
    </StepCard>
  )
}
