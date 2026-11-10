import type { Report, Status } from './report-data'
import type {
  AdminReportDetailDto,
  OwnerReportDetailDto,
  PublicReportDetailDto,
  PublicReportListItemDto,
} from './api/types'

/** Satu entri linimasa. Riwayat bersifat append-only, sama seperti aturan API. */
export type AdminHistoryEntry = {
  at: string
  title: string
  transition?: string
  note: string
}

export type AdminReport = {
  code: string
  title: string
  category: string
  categoryId: number
  categorySlug: string
  city: string
  district: string
  village: string
  landmark: string
  latitude: number | null
  longitude: number | null
  status: Status
  /** Tanggal ISO agar urutan antrean tidak bergantung pada teks yang ditampilkan. */
  submittedAt: string
  reporter: string
  description: string
  photos: number
  photoUrls: string[]
  thumbnailUrl: string | null
  history: AdminHistoryEntry[]
  /** Kode laporan utama bila laporan ini ditandai sebagai duplikat. */
  primaryReportCode?: string
  isHidden: boolean
}

export const adminStatus: Record<Status, { label: string; tone: string }> = {
  SUBMITTED: { label: 'Menunggu verifikasi', tone: 'submitted' },
  VERIFIED: { label: 'Terverifikasi', tone: 'verified' },
  IN_PROGRESS: { label: 'Sedang ditindaklanjuti', tone: 'progress' },
  RESOLVED: { label: 'Tindak lanjut selesai', tone: 'resolved' },
  REJECTED: { label: 'Ditolak', tone: 'rejected' },
  DUPLICATE: { label: 'Duplikat', tone: 'duplicate' },
}

/**
 * Urutan tinjauan: laporan yang belum diverifikasi selalu lebih dulu,
 * lalu yang paling baru. DUPLICATE ditutup paling akhir.
 */
export const statusRank: Record<Status, number> = {
  SUBMITTED: 0,
  VERIFIED: 1,
  IN_PROGRESS: 2,
  REJECTED: 3,
  RESOLVED: 4,
  DUPLICATE: 5,
}

/**
 * Status yang boleh dilihat publik. Dipakai untuk catatan ringkasan, sama
 * dengan filter `publicStatuses` pada layanan statistik.
 */
export const publicStatuses: Status[] = ['VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'DUPLICATE']

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

export function formatSubmitted(iso: string) {
  const hasTime = iso.includes('T')
  const date = new Date(hasTime ? iso : `${iso}T00:00:00+07:00`)
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

export function formatDateTime(iso: string) {
  return `${dateTimeFormatter.format(new Date(iso))} WIB`
}

const categoryTone: Record<string, string> = {
  'Jalan rusak': 'blue',
  'Lampu jalan': 'amber',
  Sampah: 'green',
  'Saluran air': 'teal',
  'Fasilitas umum': 'purple',
  Lainnya: 'amber',
}

const toneBySlug: Record<string, string> = {
  'jalan-rusak': 'blue',
  'lampu-jalan': 'amber',
  sampah: 'green',
  'saluran-air': 'teal',
  'fasilitas-umum': 'purple',
  lainnya: 'amber',
}

export function toneOf(report: { category: string; categorySlug: string }) {
  return categoryTone[report.category] ?? toneBySlug[report.categorySlug] ?? 'amber'
}

/** Urutan antrean: belum diverifikasi lebih dulu, lalu tanggal terbaru. */
export function prioritize(rows: AdminReport[]) {
  return [...rows].sort(
    (a, b) => statusRank[a.status] - statusRank[b.status] || b.submittedAt.localeCompare(a.submittedAt),
  )
}

export function countByStatus(rows: AdminReport[]) {
  const counts: Record<Status, number> = {
    SUBMITTED: 0,
    VERIFIED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    REJECTED: 0,
    DUPLICATE: 0,
  }
  for (const row of rows) counts[row.status] += 1
  return counts
}

/** Status yang boleh tampil di halaman publik. */
export function isPublicReport(report: AdminReport) {
  return publicStatuses.includes(report.status)
}

/** Laporan yang sudah ditinjau, diurutkan seperti antrean admin. */
export function publicReports(rows: AdminReport[]) {
  return prioritize(rows.filter(isPublicReport))
}

export function reportPageCount(total: number, limit: number) {
  return Math.max(1, Math.ceil(total / Math.max(1, limit)))
}

export function clampReportPage(page: number, pageCount: number) {
  return Math.min(Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1), pageCount)
}

/** Nomor halaman yang ditampilkan oleh pagination, dengan penanda celah. */
export function reportPageWindow(currentPage: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const pages = new Set<number>([1, pageCount, currentPage - 1, currentPage, currentPage + 1])
  const visible = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b)
  const result: Array<number | 'gap'> = []
  visible.forEach((page, index) => {
    if (index > 0 && page - visible[index - 1] > 1) result.push('gap')
    result.push(page)
  })
  return result
}

/** Bentuk ringkas yang dipakai kartu laporan dan linimasa publik. */
export function toCard(report: AdminReport): Report {
  return {
    code: report.code,
    title: report.title,
    category: report.category,
    categorySlug: report.categorySlug,
    district: report.district,
    village: report.village,
    status: report.status,
    date: formatSubmitted(report.submittedAt),
    description: report.description,
    primaryReportCode: report.primaryReportCode,
    thumbnailUrl: report.thumbnailUrl,
    photoUrls: report.photoUrls,
    tone: toneOf(report),
  }
}

/** Catatan terbaru dari administrator, dipakai kartu tindak lanjut. */
export function latestNote(report: AdminReport) {
  return report.history[report.history.length - 1]
}

/** Kandidat laporan utama: sudah publik, bukan duplikat, dan bukan dirinya sendiri. */
export function duplicateCandidates(rows: AdminReport[], code: string) {
  const self = rows.find((report) => report.code === code)
  return rows
    .filter((report) => report.code !== code && isPublicReport(report) && report.status !== 'DUPLICATE')
    .sort((a, b) => {
      const sameCategory = Number(b.category === self?.category) - Number(a.category === self?.category)
      return sameCategory || b.submittedAt.localeCompare(a.submittedAt)
    })
}

/** Laporan utama yang dirujuk sebuah duplikat, bila ada. */
export function primaryReportOf(rows: AdminReport[], report: AdminReport) {
  if (!report.primaryReportCode) return undefined
  return rows.find((row) => row.code === report.primaryReportCode)
}

/**
 * Laporan utama yang masih tampil publik dan bukan duplikat. Halaman warga
 * memakai ini agar tautan tidak berujung pada laporan yang sudah ditolak atau
 * pada rantai duplikat bertingkat.
 */
export function publicPrimaryReportOf(rows: AdminReport[], report: AdminReport) {
  const primary = primaryReportOf(rows, report)
  return primary && isPublicReport(primary) && primary.status !== 'DUPLICATE' ? primary : undefined
}

/* ------------------------------------------------------------------ mapper */

function timelineEntry(
  at: string,
  title: string,
  note: string,
  transition?: string,
): AdminHistoryEntry {
  return { at: formatDateTime(at), title, note, transition }
}

function mapHistory(detail: PublicReportDetailDto) {
  const entries: Array<{ createdAt: string; entry: AdminHistoryEntry }> = []
  for (const item of detail.timeline ?? []) {
    entries.push({
      createdAt: item.createdAt,
      entry: timelineEntry(
        item.createdAt,
        adminStatus[item.toStatus].label,
        item.reason?.trim() || `${item.actorLabel} mencatat perubahan status.`,
        `${item.fromStatus ? adminStatus[item.fromStatus].label : '—'} → ${adminStatus[item.toStatus].label}`,
      ),
    })
  }
  for (const item of detail.followUps ?? []) {
    const explanation = item.resolutionExplanation?.trim()
    entries.push({
      createdAt: item.createdAt,
      entry: timelineEntry(
        item.createdAt,
        item.isResolutionNote ? 'Catatan penyelesaian' : 'Catatan tindak lanjut',
        explanation ? `${item.note} ${explanation}` : item.note,
      ),
    })
  }
  if (!entries.length) {
    entries.push({
      createdAt: detail.createdAt,
      entry: timelineEntry(detail.createdAt, 'Laporan dikirim', 'Laporan diterima oleh sistem.'),
    })
  }
  return entries
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => item.entry)
}

export function mapListReport(dto: PublicReportListItemDto): AdminReport {
  return {
    code: dto.code,
    title: dto.title,
    category: dto.category.name,
    categoryId: dto.category.id,
    categorySlug: dto.category.slug,
    city: '',
    district: dto.district,
    village: dto.village,
    landmark: '',
    latitude: dto.latitude,
    longitude: dto.longitude,
    status: dto.status,
    submittedAt: dto.createdAt,
    reporter: '',
    description: '',
    photos: dto.thumbnailUrl ? 1 : 0,
    photoUrls: dto.thumbnailUrl ? [dto.thumbnailUrl] : [],
    thumbnailUrl: dto.thumbnailUrl,
    history: [timelineEntry(dto.createdAt, 'Laporan dikirim', 'Laporan diterima oleh sistem.')],
    isHidden: false,
  }
}

export function mapDetailReport(
  dto: PublicReportDetailDto | OwnerReportDetailDto | AdminReportDetailDto,
  options: { reporter?: string } = {},
): AdminReport {
  const detail = dto as PublicReportDetailDto
  const admin = dto as Partial<AdminReportDetailDto>
  const photos = (detail.photos ?? detail.evidences ?? []).map((item) => item.url)
  return {
    code: detail.code,
    title: detail.title,
    category: detail.category.name,
    categoryId: detail.category.id,
    categorySlug: detail.category.slug,
    city: detail.city,
    district: detail.district,
    village: detail.village,
    landmark: detail.locationDetail,
    latitude: detail.latitude,
    longitude: detail.longitude,
    status: detail.status,
    submittedAt: detail.createdAt,
    reporter: admin.reporterName ?? options.reporter ?? '',
    description: detail.description,
    photos: detail.photos?.length ?? 0,
    photoUrls: photos,
    thumbnailUrl: detail.thumbnailUrl,
    history: mapHistory(detail),
    primaryReportCode: detail.duplicateOf?.code,
    isHidden: admin.isHidden ?? false,
  }
}
