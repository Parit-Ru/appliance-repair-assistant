import type { HistoryFlowInfo, OutcomeKind } from '../api/types'
import { symptomName } from './symptoms'

export const HISTORY_RETENTION_DAYS = 90
export const FLOW_CHANGED_MESSAGE = 'ข้อมูลผังเปลี่ยนไปแล้ว ดูรายละเอียดไม่ได้'

export const STATUS_BADGE_CLASSES: Record<OutcomeKind, string> = {
  user_fixed: 'border-success/40 text-success',
  normal_behavior: 'border-info/40 text-info',
  handoff_informed: 'border-accent/40 text-accent',
  handoff_unknown: 'border-accent/40 text-accent',
}

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

export function formatStartedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

export function historyTitle(flow: HistoryFlowInfo | null): string {
  return flow === null ? FLOW_CHANGED_MESSAGE : symptomName(flow)
}
