import { useHealth } from '../../api/queries'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

type ServerState = 'checking' | 'ok' | 'degraded' | 'offline'

const STATES: Record<ServerState, { label: string; icon: IconName; color: string }> = {
  checking: { label: 'กำลังเชื่อมต่อเซิร์ฟเวอร์', icon: 'spinner', color: 'text-ink-faint' },
  ok: { label: 'เซิร์ฟเวอร์พร้อมใช้งาน', icon: 'success', color: 'text-success' },
  degraded: { label: 'ฐานข้อมูลของเซิร์ฟเวอร์มีปัญหา', icon: 'warning', color: 'text-accent' },
  offline: { label: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', icon: 'warning', color: 'text-danger' },
}

export function ServerStatus() {
  const health = useHealth()

  let state: ServerState
  if (health.isPending) {
    state = 'checking'
  } else if (health.isError) {
    state = 'offline'
  } else if (health.data.status === 'degraded') {
    state = 'degraded'
  } else {
    state = 'ok'
  }

  const { label, icon, color } = STATES[state]

  return (
    <div role="status" title={health.error?.message} className={`flex items-center gap-2 text-xs ${color}`}>
      <Icon name={icon} className={state === 'checking' ? 'h-4 w-4 shrink-0 animate-spin' : 'h-4 w-4 shrink-0'} />
      <span>{label}</span>
    </div>
  )
}
