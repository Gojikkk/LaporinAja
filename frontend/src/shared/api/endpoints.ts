import { apiData, apiDownload, apiList, type ListPayload } from './client'
import type { Status } from '../report-data'
import type {
  AdminCategoryDto,
  AdminReportDetailDto,
  AdminStatsDto,
  CategoryDto,
  CreateReportInput,
  FollowUpDto,
  FollowUpInput,
  GeocodingCandidateDto,
  NotificationDto,
  OwnerReportDetailDto,
  PublicReportDetailDto,
  PublicReportListItemDto,
  PublicStatsDto,
  PublicTrendsDto,
  SessionUser,
  StatusChangeInput,
} from './types'

type QueryValue = string | number | boolean | null | undefined

function queryString(params: Record<string, QueryValue>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/* ------------------------------------------------------------------- auth */

export function register(input: { name: string; email: string; password: string }) {
  return apiData<SessionUser>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
}

export function login(input: { email: string; password: string }) {
  return apiData<SessionUser>('/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function loginGoogle(credential: string) {
  return apiData<SessionUser>('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) })
}

export function logout() {
  return apiData<{ ok: boolean }>('/auth/logout', { method: 'POST' })
}

export function me() {
  return apiData<SessionUser>('/auth/me')
}

/* -------------------------------------------------------------- categories */

export function getCategories() {
  return apiData<CategoryDto[]>('/categories')
}

export function getAdminCategories() {
  return apiData<AdminCategoryDto[]>('/admin/categories')
}

export function createCategory(input: { name: string; slug: string; isActive?: boolean }) {
  return apiData<AdminCategoryDto>('/admin/categories', { method: 'POST', body: JSON.stringify(input) })
}

export function updateCategory(id: number, input: { name?: string; slug?: string; isActive?: boolean }) {
  return apiData<AdminCategoryDto>(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

/* ----------------------------------------------------------------- reports */

export type PublicReportQuery = {
  q?: string
  category?: string
  status?: Status | ''
  district?: string
  village?: string
  page?: number
  limit?: number
}

export function getPublicReports(params: PublicReportQuery = {}) {
  return apiList<PublicReportListItemDto>(`/reports${queryString(params)}`)
}

export function getPublicReport(code: string) {
  return apiData<PublicReportDetailDto>(`/reports/${encodeURIComponent(code)}`)
}

export function createReport(input: CreateReportInput) {
  const body = new FormData()
  body.append('categoryId', String(input.categoryId))
  body.append('title', input.title)
  body.append('description', input.description)
  body.append('city', input.city)
  body.append('district', input.district)
  body.append('village', input.village)
  body.append('locationDetail', input.locationDetail)
  if (input.latitude !== undefined) body.append('latitude', String(input.latitude))
  if (input.longitude !== undefined) body.append('longitude', String(input.longitude))
  body.append('submissionKey', input.submissionKey)
  for (const photo of input.photos) body.append('photos', photo)
  return apiData<{ code: string; status: Status }>('/reports', { method: 'POST', body })
}

export function searchReportLocations(query: string) {
  return apiData<GeocodingCandidateDto[]>(`/location/search${queryString({ q: query })}`)
}

export type OwnerReportQuery = { status?: Status | ''; page?: number; limit?: number }

export function getMyReports(params: OwnerReportQuery = {}) {
  return apiList<PublicReportListItemDto>(`/me/reports${queryString(params)}`)
}

export function getMyReport(code: string) {
  return apiData<OwnerReportDetailDto>(`/me/reports/${encodeURIComponent(code)}`)
}

export type AdminReportQuery = { status?: Status | ''; category?: string; page?: number; limit?: number }

export function getAdminReports(params: AdminReportQuery = {}) {
  return apiList<AdminReportDetailDto>(`/admin/reports${queryString(params)}`)
}

export function getAdminReport(code: string) {
  return apiData<AdminReportDetailDto>(`/admin/reports/${encodeURIComponent(code)}`)
}

export function exportAdminReports(params: { status?: Status | ''; category?: string } = {}) {
  return apiDownload(`/admin/reports/export${queryString(params)}`, 'laporinaja-reports.csv')
}

export function addFollowUp(code: string, input: FollowUpInput) {
  const body = new FormData()
  body.append('note', input.note)
  body.append('isResolutionNote', String(input.isResolutionNote))
  if (input.resolutionExplanation !== undefined) body.append('resolutionExplanation', input.resolutionExplanation)
  for (const photo of input.photos ?? []) body.append('photos', photo)
  return apiData<FollowUpDto>(`/admin/reports/${encodeURIComponent(code)}/follow-ups`, {
    method: 'POST',
    body,
  })
}

export function changeReportStatus(code: string, input: StatusChangeInput) {
  return apiData<{ code: string; status: Status; historyId: string }>(
    `/admin/reports/${encodeURIComponent(code)}/status`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

/* ------------------------------------------------------------------- stats */

export function getPublicStats() {
  return apiData<PublicStatsDto>('/stats/public')
}

export function getPublicTrends() {
  return apiData<PublicTrendsDto>('/stats/trends')
}

export function getAdminStats() {
  return apiData<AdminStatsDto>('/admin/stats')
}

/* ----------------------------------------------------------- notifications */

export function getNotifications() {
  return apiData<NotificationDto[]>('/me/notifications')
}

export function markNotificationRead(id: string) {
  return apiData<NotificationDto>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
}

export type { ListPayload }
