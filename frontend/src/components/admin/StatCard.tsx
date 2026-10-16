import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  /** ข้อความที่จัดรูปแล้ว (ค่า null ให้ส่ง "-" มา ห้ามส่ง 0) */
  value: string
  hint?: ReactNode
}

/** การ์ดตัวเลขสรุป */
export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="space-y-1 rounded-xl border border-line bg-panel p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      {hint !== undefined && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}
