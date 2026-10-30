import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  hint?: ReactNode
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="space-y-1 rounded-xl border border-line bg-panel p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      {hint !== undefined && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}
