import { Button } from '../ui/Button'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  disabled?: boolean
}

export function Pagination({ page, totalPages, onChange, disabled = false }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="แบ่งหน้า" className="flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        ก่อนหน้า
      </Button>
      <span className="text-sm text-ink-soft">
        หน้า {page} จาก {totalPages}
      </span>
      <Button variant="secondary" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        ถัดไป
      </Button>
    </nav>
  )
}
