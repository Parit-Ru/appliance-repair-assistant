import type { AdminFlowListParams, AdminFlowStatusFilter } from '../api/types'
import { DEVICE_CATEGORIES } from './labels'

const STATUS_FILTERS: AdminFlowStatusFilter[] = ['active', 'deleted', 'all']
const MAX_QUERY_LENGTH = 100

// /admin/flows?q=&deviceCategory=&status=active|deleted|all&page=
export function parseAdminFlowParams(search: URLSearchParams): AdminFlowListParams {
  const q = (search.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH)
  const category = search.get('deviceCategory')
  const status = search.get('status')
  const page = Number(search.get('page'))

  return {
    q: q === '' ? undefined : q,
    deviceCategory: DEVICE_CATEGORIES.find((c) => c === category),
    status: STATUS_FILTERS.find((s) => s === status) ?? 'active',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** Defaults are omitted so the URL stays short */
export function adminFlowToSearchParams(params: AdminFlowListParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.q !== undefined) search.set('q', params.q)
  if (params.deviceCategory !== undefined) search.set('deviceCategory', params.deviceCategory)
  if (params.status !== 'active') search.set('status', params.status)
  if (params.page > 1) search.set('page', String(params.page))
  return search
}

/** Changing a filter goes back to page 1; changing only the page does not reset it */
export function patchAdminFlowParams(current: AdminFlowListParams, patch: Partial<AdminFlowListParams>): AdminFlowListParams {
  const changesFilter = 'q' in patch || 'deviceCategory' in patch || 'status' in patch
  const merged = { ...current, ...patch }
  if (changesFilter && !('page' in patch)) merged.page = 1
  return merged
}

export function hasAdminFlowFilters(params: AdminFlowListParams): boolean {
  return params.q !== undefined || params.deviceCategory !== undefined || params.status !== 'active'
}
