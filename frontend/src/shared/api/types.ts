import type { Status } from '../report-data'

export type CategoryDto = { id: number; name: string; slug: string }
export type AdminCategoryDto = CategoryDto & { isActive: boolean }

export type ReportCategoryRef = { id: number; name: string; slug: string }

export type MediaDto = { url: string; mimeType: string; altText?: string | null }

export type TimelineDto = {
  fromStatus: Status | null
  toStatus: Status
  createdAt: string
  actorLabel: string
  reason?: string | null
}

export type FollowUpDto = {
  id?: string
  note: string
  isResolutionNote: boolean
  resolutionExplanation?: string | null
  createdAt: string
  evidences?: MediaDto[]
}

export type PublicReportListItemDto = {
  code: string
  title: string
  category: ReportCategoryRef
  district: string
  village: string
  latitude: number | null
  longitude: number | null
  status: Status
  thumbnailUrl: string | null
  createdAt: string
}

export type PublicReportDetailDto = PublicReportListItemDto & {
  description: string
  city: string
  locationDetail: string
  photos: MediaDto[]
  timeline: TimelineDto[]
  followUps: FollowUpDto[]
  evidences: MediaDto[]
  duplicateOf: { code: string; url: string } | null
}

export type OwnerReportDetailDto = PublicReportDetailDto & {
  followUps: FollowUpDto[]
}

export type AdminReportDetailDto = OwnerReportDetailDto & {
  reporterName: string
  isHidden: boolean
}

export type NotificationDto = {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
  reportCode: string
  reportUrl: string
}

export type StatusCounts = Record<Status, number>

export type PublicStatsDto = {
  total: number
  byStatus: StatusCounts
  statusDistribution: Record<Status, number>
  byCategory: Array<{ id: number; name: string; slug: string; count: number }>
  resolved: number
  completionRate: number
  asOf: string
  label: string
}

export type PublicTrendsDto = {
  period: string
  byCategory: Array<{
    id: number
    name: string
    slug: string
    months: Array<{ month: string; count: number }>
  }>
  asOf: string
  label: string
}

export type GeocodingCandidateDto = {
  latitude: number
  longitude: number
  displayName: string
  address?: {
    city?: string
    district?: string
    village?: string
    locationDetail?: string
  }
}

export type GeocodedAddressDto = {
  displayName: string
  address?: GeocodingCandidateDto['address']
}

export type AdminStatsDto = {
  total: number
  submissions: number
  byStatus: StatusCounts
  byCategory: Array<{ id: number; name: string; slug: string; count: number }>
  statusDistribution: Record<Status, number>
  verificationRate: number
  followUpCoverage: number
  averageTimeToVerifiedMs: number
  resolvedWithProofRate: number
  asOf: string
}

export type SessionUser = { id: string; name: string; role: 'PELAPOR' | 'ADMIN' }

export type CreateReportInput = {
  categoryId: number
  title: string
  description: string
  city: string
  district: string
  village: string
  locationDetail: string
  latitude?: number
  longitude?: number
  submissionKey: string
  photos: File[]
}

export type StatusChangeInput = {
  toStatus: Status
  expectedStatus: Status
  reason?: string
  duplicateOfCode?: string
}

export type FollowUpInput = {
  note: string
  isResolutionNote: boolean
  resolutionExplanation?: string
  photos?: File[]
}
