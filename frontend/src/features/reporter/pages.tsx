import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type InputEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  FileCheck2,
  FilePlus2,
  Info,
  LocateFixed,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Search,
  SearchX,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react'
import { Button, CategoryIcon, Dropdown, Modal, PageIntro, PrimaryReportCard, StatCard, StatusBadge, TextField, Timeline } from '../../components/ui'
import { ApiError, mediaSrc } from '../../shared/api/client'
import { createReport, deleteMyReport, getCategories, getMyReport, getMyReports, getPublicReport, reverseLookupReportLocation, searchReportLocations } from '../../shared/api/endpoints'
import type { GeocodingCandidateDto } from '../../shared/api/types'
import { useSession } from '../../shared/session'
import { useAsync } from '../../shared/useAsync'
import '../../styles/reporter-location.css'
import {
  clampReportPage,
  countByStatus,
  formatDateTime,
  formatSubmitted,
  latestNote,
  mapDetailReport,
  mapListReport,
  publicStatuses,
  reportPageCount,
  reportPageWindow,
  toCard,
} from '../../shared/report-store'
import type { Report, Status } from '../../shared/report-data'
import { ReporterShell } from './shell'

const MY_REPORT_PAGE_SIZE = 8

const reporterStatus: Record<Status, { text: string; icon: typeof Send; tone: string }> = {
  SUBMITTED: { text: 'Menunggu verifikasi', icon: Send, tone: 'submitted' },
  VERIFIED: { text: 'Terverifikasi', icon: ShieldCheck, tone: 'verified' },
  IN_PROGRESS: { text: 'Dalam tindak lanjut', icon: Wrench, tone: 'progress' },
  RESOLVED: { text: 'Selesai', icon: CheckCircle2, tone: 'resolved' },
  REJECTED: { text: 'Ditolak', icon: XCircle, tone: 'rejected' },
  DUPLICATE: { text: 'Duplikat', icon: Copy, tone: 'duplicate' },
}

function ReporterBadge({ status }: { status: Status }) {
  const info = reporterStatus[status]
  const Icon = info.icon
  return (
    <span className={`rep-badge tone-${info.tone}`}>
      <Icon size={14} aria-hidden="true" />
      <span>{info.text}</span>
    </span>
  )
}

type NoticeTone = 'info' | 'danger' | 'success' | 'duplicate'

function Notice({
  tone,
  icon: Icon,
  title,
  text,
}: {
  tone: NoticeTone
  icon: typeof Info
  title: string
  text: string
}) {
  return (
    <div className={`rep-banner tone-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  )
}

function statusNotice(status: Status, rejectionReason?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return {
        tone: 'info' as const,
        icon: Info,
        title: 'Menunggu verifikasi',
        text: 'Laporan kamu sudah masuk dan sedang menunggu tinjauan administrator platform.',
      }
    case 'VERIFIED':
      return {
        tone: 'info' as const,
        icon: ShieldCheck,
        title: 'Terverifikasi',
        text: 'Laporan telah diverifikasi dan menunggu ditindaklanjuti.',
      }
    case 'IN_PROGRESS':
      return {
        tone: 'info' as const,
        icon: Wrench,
        title: 'Sedang ditindaklanjuti',
        text: 'Laporan kamu sedang ditindaklanjuti. Perkembangan terbaru selalu tercatat di linimasa.',
      }
    case 'RESOLVED':
      return {
        tone: 'success' as const,
        icon: CheckCircle2,
        title: 'Selesai ditindaklanjut',
        text: 'Laporan dinyatakan selesai. Lihat catatan dan bukti penyelesaian di bawah.',
      }
    case 'REJECTED':
      return {
        tone: 'danger' as const,
        icon: CircleAlert,
        title: 'Laporan ditolak',
        text:
          rejectionReason?.trim() ||
          'Laporan tidak dapat diverifikasi. Kamu bisa membuat laporan baru dengan detail yang lebih jelas.',
      }
    case 'DUPLICATE':
      return {
        tone: 'duplicate' as const,
        icon: Copy,
        title: 'Laporan digabungkan',
        text: 'Laporan ini ditandai sebagai duplikat. Pantau perkembangannya lewat laporan utama.',
      }
  }
}

function Loading({ crumb, label }: { crumb: string; label: string }) {
  return (
    <ReporterShell crumb={crumb}>
      <div className="rep-page">
        <div className="rep-empty">
          <Clock3 size={26} aria-hidden="true" />
          <h2>{label}</h2>
          <p>Menghubungkan ke layanan LaporinAja.</p>
        </div>
      </div>
    </ReporterShell>
  )
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rep-banner tone-danger" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <div>
        <b>Data tidak dapat dimuat</b>
        <p>{message}</p>
        <button type="button" className="rep-btn rep-btn-outline" onClick={onRetry}>
          Coba lagi
        </button>
      </div>
    </div>
  )
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/* ------------------------------------------------------------- dashboard */

function MetricCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <article className="rep-metric">
      <span className="rep-metric-label">{label}</span>
      <span className="rep-metric-value">{value}</span>
      <span className="rep-metric-note">{note}</span>
    </article>
  )
}

function ReportTile({ report }: { report: Report }) {
  return (
    <article className="rep-report-card">
      <span className="rep-report-photo">
        {report.thumbnailUrl ? (
          <img src={mediaSrc(report.thumbnailUrl)} alt="" loading="lazy" />
        ) : (
          <span className="rep-photo-fallback">
            <CategoryIcon category={report.categorySlug ?? report.category} size={24} />
          </span>
        )}
      </span>
      <div className="rep-report-body">
        <span className="rep-report-cat">{report.category}</span>
        <Link className="rep-report-title" to={`/dashboard/laporan/${report.code}`}>
          {report.title}
        </Link>
        <span className="rep-report-meta">
          <MapPin size={13} aria-hidden="true" />
          {report.village}, {report.district}
        </span>
        <span className="rep-report-meta">{report.date}</span>
        <ReporterBadge status={report.status} />
      </div>
    </article>
  )
}

export function Dashboard() {
  const { user } = useSession()
  const load = useCallback(() => getMyReports({ page: 1, limit: 4 }), [])
  const { data, error, loading, reload } = useAsync(load, [])

  if (loading) return <Loading crumb="Dashboard" label="Memuat dashboard" />

  const rows = (data?.data ?? []).map(mapListReport)
  const counts = { ...countByStatus([]), ...(data?.counts ?? {}) }
  const total = data?.meta.total ?? rows.length
  const cards = rows.map(toCard)
  const name = user?.name ?? 'Pelapor'

  const metrics = [
    { label: 'Total laporan', value: total, note: 'sepanjang waktu' },
    { label: 'Menunggu verifikasi', value: counts.SUBMITTED, note: 'belum ditinjau' },
    { label: 'Terverifikasi', value: counts.VERIFIED, note: 'siap ditindaklanjut' },
    { label: 'Dalam tindak lanjut', value: counts.IN_PROGRESS, note: 'sedang dikerjakan' },
    { label: 'Selesai', value: counts.RESOLVED, note: 'sudah tertangani' },
    { label: 'Ditolak / duplikat', value: counts.REJECTED + counts.DUPLICATE, note: 'ditutup' },
  ]

  return (
    <ReporterShell crumb="Dashboard">
      <div className="rep-page">
        {error ? (
          <ErrorNotice message={errorMessage(error, 'Terjadi kendala saat memuat laporan.')} onRetry={reload} />
        ) : total === 0 ? (
          <section className="rep-section">
            <header className="rep-head">
              <h1>Dashboard Saya</h1>
              <p>Halo, {name}. Pantau laporan dan perkembangannya di sini.</p>
            </header>
            <div className="rep-empty">
              <SearchX size={30} aria-hidden="true" />
              <h2>Belum ada laporan</h2>
              <p>Laporan yang kamu buat akan tampil di sini beserta status dan catatan perkembangannya.</p>
              <Link className="rep-btn" to="/lapor/baru">
                <FilePlus2 size={16} aria-hidden="true" />
                Buat Laporan Pertama
              </Link>
            </div>
          </section>
        ) : (
          <>
            <header className="rep-head">
              <h1>Dashboard Saya</h1>
              <p>Halo, {name}. Pantau laporan dan perkembangannya di sini.</p>
            </header>
            <section className="rep-section" aria-label="Ringkasan status laporan">
              <h2 className="rep-section-title">Ringkasan status</h2>
              <div className="rep-metrics">
                {metrics.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>
            </section>
            <section className="rep-section" aria-label="Laporan terbaru">
              <div className="rep-section-head">
                <div>
                  <h2 className="rep-section-title">Laporan Saya</h2>
                  <p className="rep-section-note">Empat laporan terbaru pada akunmu.</p>
                </div>
                <Link className="rep-btn" to="/lapor/baru">
                  <FilePlus2 size={16} aria-hidden="true" />
                  Buat Laporan
                </Link>
              </div>
              {cards.length === 0 ? (
                <p className="rep-section-note">Belum ada laporan terbaru.</p>
              ) : (
                <>
                  <div className="rep-cards">
                    {cards.map((report) => (
                      <ReportTile key={report.code} report={report} />
                    ))}
                  </div>
                  <div className="rep-cards-more">
                    <Link className="rep-btn rep-btn-outline" to="/dashboard/laporan">
                      Lihat Semua Laporan
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </ReporterShell>
  )
}

/* ---------------------------------------------------------- laporan saya */

function RowMenu({ code, isPublic, editable }: { code: string; isPublic: boolean; editable: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="rep-more-wrap" ref={ref}>
      <button
        type="button"
        className="rep-more"
        aria-label={`Aksi lain untuk laporan ${code}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="rep-more-menu" role="menu">
          <Link role="menuitem" to={`/dashboard/laporan/${code}`} onClick={() => setOpen(false)}>
            Lihat detail
          </Link>
          {editable ? (
            <Link role="menuitem" to={`/dashboard/laporan/${code}/edit`} onClick={() => setOpen(false)}>
              Ubah laporan
            </Link>
          ) : null}
          {isPublic ? (
            <Link role="menuitem" to={`/laporan/${code}`} onClick={() => setOpen(false)}>
              Buka halaman publik
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function MyReports() {
  const [status, setStatus] = useState<Status | ''>('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const load = useCallback(
    () => getMyReports({ status: status || undefined, page: 1, limit: 50 }),
    [status],
  )
  const { data, error, loading, reload } = useAsync(load, [status])

  useEffect(() => {
    setPage(1)
  }, [status, category])

  const rows = useMemo(() => (data?.data ?? []).map(mapListReport), [data])
  const categoryOptions = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.category))].sort((a, b) => a.localeCompare(b))
    return [{ value: '', label: 'Semua kategori' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [rows])
  const filtered = useMemo(
    () => (category ? rows.filter((row) => row.category === category) : rows),
    [rows, category],
  )

  const pageCount = reportPageCount(filtered.length, MY_REPORT_PAGE_SIZE)
  const current = clampReportPage(page, pageCount)
  const start = (current - 1) * MY_REPORT_PAGE_SIZE
  const pageRows = filtered.slice(start, start + MY_REPORT_PAGE_SIZE)

  return (
    <ReporterShell crumb="Laporan Saya">
      <div className="rep-page">
        <header className="rep-head">
          <h1>Laporan Saya</h1>
          <p>Semua laporan pada akunmu beserta status terkininya.</p>
        </header>

        {error ? (
          <ErrorNotice message={errorMessage(error, 'Terjadi kendala saat memuat laporan.')} onRetry={reload} />
        ) : loading ? (
          <div className="rep-empty">
            <Clock3 size={26} aria-hidden="true" />
            <h2>Memuat laporan</h2>
            <p>Menghubungkan ke layanan LaporinAja.</p>
          </div>
        ) : (
          <>
            <div className="rep-filter-card">
              <div className="rep-field">
                <span id="rep-status-label">Status</span>
                <Dropdown
                  label="Status"
                  labelledBy="rep-status-label"
                  value={status}
                  onChange={(value) => setStatus(value as Status | '')}
                  options={[
                    { value: '', label: 'Semua status' },
                    ...(Object.keys(reporterStatus) as Status[]).map((value) => ({
                      value,
                      label: reporterStatus[value].text,
                    })),
                  ]}
                />
              </div>
              <div className="rep-field">
                <span id="rep-category-label">Kategori</span>
                <Dropdown
                  label="Kategori"
                  labelledBy="rep-category-label"
                  value={category}
                  onChange={setCategory}
                  options={categoryOptions}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rep-empty">
                <SearchX size={30} aria-hidden="true" />
                <h2>Tidak ada laporan yang cocok</h2>
                <p>Coba ubah filter status atau kategori, atau buat laporan baru.</p>
                <Link className="rep-btn" to="/lapor/baru">
                  <FilePlus2 size={16} aria-hidden="true" />
                  Buat Laporan
                </Link>
              </div>
            ) : (
              <>
                <section className="rep-table" aria-label="Daftar laporan saya">
                  <div className="rep-thead">
                    <span className="rep-col-id">Kode</span>
                    <span className="rep-col-main">Laporan</span>
                    <span className="rep-col-cat">Kategori</span>
                    <span className="rep-col-date">Tanggal</span>
                    <span className="rep-col-status">Status</span>
                    <span className="rep-col-more" aria-hidden="true" />
                  </div>
                  <div className="rep-tbody">
                    {pageRows.map((row) => {
                      const detail = `/dashboard/laporan/${row.code}`
                      const date = formatSubmitted(row.submittedAt)
                      return (
                        <article className="rep-row" key={row.code}>
                          <span className="rep-row-art" aria-hidden="true">
                            {row.thumbnailUrl ? (
                              <img src={mediaSrc(row.thumbnailUrl)} alt="" loading="lazy" />
                            ) : (
                              <CategoryIcon category={row.categorySlug} size={26} />
                            )}
                          </span>
                          {row.thumbnailUrl ? (
                            <span className="rep-row-photo" aria-hidden="true">
                              <img src={mediaSrc(row.thumbnailUrl)} alt="" loading="lazy" />
                            </span>
                          ) : null}
                          <div className="rep-col-id">
                            <Link className="rep-code" to={detail}>
                              {row.code}
                            </Link>
                          </div>
                          <div className="rep-col-main">
                            <Link className="rep-row-title" to={detail}>
                              {row.title}
                            </Link>
                            <span className="rep-row-loc">
                              {row.village}, {row.district}
                            </span>
                            <span className="rep-row-meta">
                              <MapPin size={16} aria-hidden="true" />
                              {row.category} · {row.village}, {row.district}
                            </span>
                            <span className="rep-row-date">{date}</span>
                          </div>
                          <span className="rep-col-cat">
                            <CategoryIcon category={row.categorySlug} size={20} aria-hidden="true" />
                            <span>{row.category}</span>
                          </span>
                          <span className="rep-col-date">{date}</span>
                          <span className="rep-col-status">
                            <ReporterBadge status={row.status} />
                          </span>
                          <RowMenu
                            code={row.code}
                            isPublic={publicStatuses.includes(row.status)}
                            editable={row.status === 'SUBMITTED' || row.status === 'REJECTED'}
                          />
                        </article>
                      )
                    })}
                  </div>
                </section>

                <nav className="rep-pagination" aria-label="Navigasi halaman laporan">
                  <p className="rep-count">
                    Menampilkan {pageRows.length === 0 ? 0 : start + 1}–{start + pageRows.length} dari{' '}
                    {filtered.length} laporan
                  </p>
                  <div className="rep-page-nav">
                    <button
                      type="button"
                      className="rep-page-btn"
                      onClick={() => setPage(current - 1)}
                      disabled={current === 1}
                      aria-label="Halaman sebelumnya"
                    >
                      <ArrowLeft size={16} aria-hidden="true" />
                    </button>
                    {reportPageWindow(current, pageCount).map((item, index) =>
                      item === 'gap' ? (
                        <span key={`gap-${index}`} className="rep-page-gap" aria-hidden="true">
                          …
                        </span>
                      ) : (
                        <button
                          type="button"
                          key={item}
                          className="rep-page-btn"
                          onClick={() => setPage(item)}
                          aria-current={item === current ? 'page' : undefined}
                          aria-label={`Halaman ${item}`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      className="rep-page-btn"
                      onClick={() => setPage(current + 1)}
                      disabled={current === pageCount}
                      aria-label="Halaman berikutnya"
                    >
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </nav>
              </>
            )}
          </>
        )}
      </div>
    </ReporterShell>
  )
}

/* ------------------------------------------------------------ detail saya */

function Gallery({ photos, report }: { photos: string[]; report: Report }) {
  if (photos.length === 0) {
    return (
      <section className="rep-card" aria-labelledby="rep-gallery">
        <h2 className="rep-card-title" id="rep-gallery">
          Galeri laporan
        </h2>
        <div className="rep-gallery-empty">
          <CategoryIcon category={report.categorySlug ?? report.category} size={34} />
          <p>Belum ada foto yang terlampir pada laporan ini.</p>
        </div>
      </section>
    )
  }
  const [main, ...thumbs] = photos
  return (
    <section className="rep-card" aria-labelledby="rep-gallery">
      <h2 className="rep-card-title" id="rep-gallery">
        Galeri laporan
      </h2>
      <div className="rep-gallery">
        <img
          className="rep-gallery-main"
          src={mediaSrc(main)}
          alt={`Foto utama laporan ${report.code}`}
          crossOrigin="use-credentials"
        />
        {thumbs.length > 0 ? (
          <div className="rep-gallery-thumbs">
            {thumbs.map((url, index) => (
              <img
                key={`${url}-${index}`}
                src={mediaSrc(url)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                crossOrigin="use-credentials"
              />
            ))}
          </div>
        ) : null}
        <p className="rep-gallery-caption">
          {photos.length} foto kondisi yang kamu unggah saat melapor · {report.date}
        </p>
      </div>
    </section>
  )
}

function DuplicateCard({ report, primary }: { report: Report; primary: Report | null }) {
  return (
    <section className="rep-duplicate-card" aria-labelledby="rep-duplicate">
      <h2 className="rep-card-title" id="rep-duplicate">
        Referensi duplikat
      </h2>
      <p className="rep-card-note">
        Laporan <b>{report.code}</b> digabungkan ke laporan utama berikut.
      </p>
      {primary ? (
        <>
          <div className="rep-duplicate-body">
            <span className="rep-code">{primary.code}</span>
            <b className="rep-duplicate-title">{primary.title}</b>
            <span className="rep-row-loc">
              {primary.category} · {primary.village}, {primary.district}
            </span>
            <ReporterBadge status={primary.status} />
          </div>
          <div className="rep-duplicate-actions">
            <Link className="rep-btn rep-btn-outline" to={`/laporan/${primary.code}`}>
              Lihat Laporan Asal
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : (
        <p className="rep-card-caption">
          Laporan utama belum dapat ditampilkan. Hubungi administrator platform bila tautan ini perlu
          diperiksa.
        </p>
      )}
    </section>
  )
}

export function PrivateDetail({ onToast }: { onToast: (message: string) => void }) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const load = useCallback(() => getMyReport(code), [code])
  const { data, error, loading } = useAsync(load, [code])
  const primaryCode = data?.duplicateOf?.code
  const loadPrimary = useCallback(
    () => (primaryCode ? getPublicReport(primaryCode) : Promise.resolve(null)),
    [primaryCode],
  )
  const { data: primaryDetail } = useAsync(loadPrimary, [primaryCode])

  if (loading) return <Loading crumb="Detail laporan" label="Memuat laporan" />
  if (error || !data) {
    return (
      <ReporterShell crumb="Detail laporan">
        <div className="rep-page">
          <Link className="rep-back" to="/dashboard/laporan">
            <ArrowLeft size={15} aria-hidden="true" /> Kembali ke Laporan Saya
          </Link>
          <div className="rep-empty">
            <SearchX size={26} aria-hidden="true" />
            <h2>Laporan tidak ditemukan</h2>
            <p>{errorMessage(error, 'Laporan ini tidak ada pada akunmu.')}</p>
            <Link className="rep-btn rep-btn-outline" to="/dashboard">
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </ReporterShell>
    )
  }

  const found = mapDetailReport(data)
  const report = toCard(found)
  const photos = report.photoUrls ?? []
  const history = found.history
  const resolution = data.followUps.find((item) => item.isResolutionNote) ?? null
  const rejection = [...data.timeline].reverse().find((item) => item.toStatus === 'REJECTED')
  const primary = primaryDetail ? toCard(mapDetailReport(primaryDetail)) : null
  const notice = statusNotice(report.status, rejection?.reason)
  const isPublic = publicStatuses.includes(report.status)
  const editable = report.status === 'SUBMITTED' || report.status === 'REJECTED'

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteMyReport(report.code)
      onToast(`Laporan ${report.code} dihapus.`)
      navigate('/dashboard/laporan')
    } catch (reason) {
      setDeleteError(errorMessage(reason, 'Laporan belum dapat dihapus. Coba lagi.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ReporterShell crumb={report.code}>
      <div className="rep-page">
        <Link className="rep-back" to="/dashboard/laporan">
          <ArrowLeft size={15} aria-hidden="true" /> Kembali ke Laporan Saya
        </Link>

        <header className="rep-detail-head">
          <div className="rep-detail-top">
            <span className="rep-detail-code">{report.code}</span>
            <ReporterBadge status={report.status} />
          </div>
          <h1>{report.title}</h1>
          <div className="rep-detail-meta">
            <span>{report.category}</span>
            <span aria-hidden="true">·</span>
            <span>
              <MapPin size={14} aria-hidden="true" /> {report.village}, {report.district}
            </span>
            <span aria-hidden="true">·</span>
            <span>{report.date}</span>
          </div>
        </header>

        <Notice {...notice} />

        {report.status === 'DUPLICATE' ? <DuplicateCard report={report} primary={primary} /> : null}

        <Gallery photos={photos} report={report} />

        <section className="rep-card" aria-labelledby="rep-condition">
          <h2 className="rep-card-title" id="rep-condition">
            Kondisi dan patokan
          </h2>
          <p className="rep-prose">{report.description}</p>
          <div className="rep-kv">
            <div>
              <span>Kategori</span>
              <b>{report.category}</b>
            </div>
            <div>
              <span>Tanggal laporan</span>
              <b>{report.date}</b>
            </div>
            <div>
              <span>Lokasi</span>
              <b>
                {report.village}, {report.district}
              </b>
            </div>
            {found.landmark ? (
              <div>
                <span>Patokan</span>
                <b>{found.landmark}</b>
              </div>
            ) : null}
          </div>
        </section>

        {report.status === 'RESOLVED' && resolution ? (
          <section className="rep-card" aria-labelledby="rep-resolution">
            <h2 className="rep-card-title" id="rep-resolution">
              Bukti selesai
            </h2>
            {resolution.evidences?.length ? (
              <div className="rep-proof-grid">
                {resolution.evidences.map((item) => (
                  <img
                    key={item.url}
                    src={mediaSrc(item.url)}
                    alt={item.altText ?? 'Foto bukti penyelesaian'}
                    loading="lazy"
                    crossOrigin="use-credentials"
                  />
                ))}
              </div>
            ) : null}
            <Notice
              tone="success"
              icon={CheckCircle2}
              title="Laporan selesai ditindaklanjut"
              text={
                resolution.resolutionExplanation?.trim()
                  ? `${resolution.note} ${resolution.resolutionExplanation}`
                  : resolution.note
              }
            />
            <small className="rep-card-caption">Administrator platform · {formatDateTime(resolution.createdAt)}</small>
          </section>
        ) : null}

        <section className="rep-card" aria-labelledby="rep-timeline">
          <h2 className="rep-card-title" id="rep-timeline">
            Linimasa laporan
          </h2>
          <ol className="rep-timeline">
            {history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="rep-timeline-mark" aria-hidden="true">
                  <span className="rep-timeline-dot">
                    <Check size={13} aria-hidden="true" />
                  </span>
                </span>
                <div className="rep-timeline-body">
                  <span className="rep-timeline-date">{entry.at}</span>
                  <b className="rep-timeline-title">{entry.title}</b>
                  {entry.transition ? <span className="rep-timeline-actor">{entry.transition}</span> : null}
                  <p className="rep-timeline-note">{entry.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="rep-actions">
          <Link className="rep-btn rep-btn-outline" to="/dashboard">
            <ArrowLeft size={15} aria-hidden="true" />
            Kembali ke Dashboard
          </Link>
          {isPublic ? (
            <Link className="rep-btn rep-btn-outline" to={`/laporan/${report.code}`}>
              Lihat halaman publik
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : null}
          {editable ? (
            <Link className="rep-btn rep-btn-outline" to={`/dashboard/laporan/${report.code}/edit`}>
              <Pencil size={15} aria-hidden="true" />
              Ubah laporan
            </Link>
          ) : null}
          <button
            type="button"
            className="rep-btn rep-btn-danger"
            onClick={() => {
              setDeleteError('')
              setConfirmDelete(true)
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
            Hapus laporan
          </button>
        </div>

        {confirmDelete ? (
          <Modal title="Hapus laporan?" onClose={() => setConfirmDelete(false)}>
            <p className="rep-card-note">
              Laporan <b>{report.code}</b> beserta riwayat dan fotonya akan dihapus permanen. Tindakan ini
              tidak dapat dibatalkan.
            </p>
            {deleteError ? (
              <p className="rep-form-error" role="alert">{deleteError}</p>
            ) : null}
            <div className="rep-modal-actions">
              <button
                type="button"
                className="rep-btn rep-btn-outline"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="rep-btn rep-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Menghapus…' : 'Ya, hapus laporan'}
              </button>
            </div>
          </Modal>
        ) : null}
      </div>
    </ReporterShell>
  )
}

/* ---------------------------------------------------------- buat laporan */

export function CreateReport({ onToast }: { onToast: (s: string) => void }) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const autoFilledLocationFields = useRef<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [locationBusy, setLocationBusy] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [locationError, setLocationError] = useState('')
  const [locationResults, setLocationResults] = useState<GeocodingCandidateDto[]>([])
  const [selectedLocation, setSelectedLocation] = useState<GeocodingCandidateDto | null>(null)
  const [submissionKey] = useState(() => crypto.randomUUID())
  const loadCategories = useCallback(() => getCategories(), [])
  const { data: categories, error: categoryError, loading: categoryLoading } = useAsync(loadCategories, [])

  function clearAutoFilledLocationFields() {
    for (const [name, previousValue] of Object.entries(autoFilledLocationFields.current)) {
      const field = formRef.current?.elements.namedItem(name)
      if (field instanceof HTMLInputElement && field.value === previousValue) field.value = ''
    }
    autoFilledLocationFields.current = {}
  }

  async function searchLocationFromAddress() {
    const form = formRef.current
    const getField = (name: string) => {
      const field = form?.elements.namedItem(name)
      return field instanceof HTMLInputElement ? field.value.trim() : ''
    }
    const searchText = getField('locationSearchQuery')
    const locationParts = searchText
      ? [searchText]
      : [getField('locationDetail'), getField('village'), getField('district'), getField('city')].filter(Boolean)
    if (locationParts.length === 0) {
      setLocationError('Isi patokan atau wilayah lokasi terlebih dahulu.')
      return
    }
    const query = [...locationParts, 'Indonesia'].join(', ')

    setLocationBusy(true)
    setLocationError('')
    setLocationMessage('')
    setLocationResults([])
    setSelectedLocation(null)
    clearAutoFilledLocationFields()
    setLatitude('')
    setLongitude('')
    try {
      const results = await searchReportLocations(query)
      setLocationResults(results)
      if (results.length === 0) setLocationMessage('Lokasi belum ditemukan. Coba ubah patokan atau pilih lokasi perangkat.')
    } catch (reason) {
      setLocationError(reason instanceof ApiError
        ? reason.message
        : 'Pencarian lokasi gagal. Coba lagi atau gunakan lokasi perangkat.')
    } finally {
      setLocationBusy(false)
    }
  }

  function handleLocationInput(event: InputEvent<HTMLFormElement>) {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || !['city', 'district', 'village', 'locationDetail', 'locationSearchQuery'].includes(target.name)) return
    if (target.name === 'locationSearchQuery' && selectedLocation) {
      clearAutoFilledLocationFields()
    } else {
      delete autoFilledLocationFields.current[target.name]
    }
    setLocationResults([])
    setSelectedLocation(null)
    setLatitude('')
    setLongitude('')
    setLocationMessage('')
    setLocationError('')
  }

  function selectLocation(location: GeocodingCandidateDto) {
    const form = formRef.current
    const fillField = (name: string, value: string | undefined) => {
      const field = form?.elements.namedItem(name)
      if (field instanceof HTMLInputElement && value) {
        field.value = value
        autoFilledLocationFields.current[name] = value
      }
    }
    fillField('city', location.address?.city)
    fillField('district', location.address?.district)
    fillField('village', location.address?.village)
    fillField('locationDetail', location.address?.locationDetail)
    setSelectedLocation(location)
    setLatitude(String(location.latitude))
    setLongitude(String(location.longitude))
    setLocationResults([])
    setLocationError('')
    setLocationMessage('Titik lokasi dipilih. Pastikan hasilnya sesuai sebelum mengirim laporan.')
  }

  function useDeviceLocation() {
    setLocationMessage('')
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Browser ini tidak mendukung akses lokasi. Kamu tetap dapat mengisi koordinat secara manual.')
      return
    }

    setLocationBusy(true)
    setLocationResults([])
    setSelectedLocation(null)
    clearAutoFilledLocationFields()
    setLatitude('')
    setLongitude('')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: currentLatitude, longitude: currentLongitude } = position.coords
        setLatitude(String(currentLatitude))
        setLongitude(String(currentLongitude))
        try {
          const result = await reverseLookupReportLocation(currentLatitude, currentLongitude)
          const fillField = (name: string, value: string | undefined) => {
            const field = formRef.current?.elements.namedItem(name)
            if (!(field instanceof HTMLInputElement) || !value) return
            const previousAutoFill = autoFilledLocationFields.current[name]
            if (!field.value.trim() || field.value === previousAutoFill) {
              field.value = value
              autoFilledLocationFields.current[name] = value
            }
          }
          fillField('city', result.address?.city)
          fillField('district', result.address?.district)
          fillField('village', result.address?.village)
          fillField('locationDetail', result.address?.locationDetail)
          const locationFields = [
            ['city', 'kota/kabupaten'],
            ['district', 'kecamatan'],
            ['village', 'kelurahan/desa'],
            ['locationDetail', 'patokan lokasi'],
          ] as const
          const missing = locationFields
            .filter(([name]) => {
              const field = formRef.current?.elements.namedItem(name)
              return !(field instanceof HTMLInputElement) || !field.value.trim()
            })
            .map(([, label]) => label)
          setLocationMessage(missing.length
            ? `Titik GPS berhasil diambil. Lengkapi ${missing.join(', ')} jika belum terisi.`
            : 'Titik dan wilayah berhasil diambil. Pastikan lokasinya sesuai sebelum mengirim.')
        } catch (reason) {
          setLocationMessage('Titik GPS berhasil diambil, tetapi wilayah tidak berhasil ditemukan. Lengkapi wilayah secara manual.')
          setLocationError(reason instanceof ApiError
            ? reason.message
            : 'Pencarian alamat dari lokasi perangkat gagal.')
        } finally {
          setLocationBusy(false)
        }
      },
      (reason) => {
        setLocationError(reason.code === reason.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini atau isi koordinat secara manual.'
          : reason.code === reason.TIMEOUT
            ? 'Pengambilan lokasi terlalu lama. Coba lagi atau isi koordinat secara manual.'
            : 'Lokasi perangkat tidak tersedia. Coba lagi atau isi koordinat secara manual.')
        setLocationBusy(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const latitudeValue = String(form.get('latitude') ?? '').trim()
    const longitudeValue = String(form.get('longitude') ?? '').trim()
    if ((latitudeValue.length === 0) !== (longitudeValue.length === 0)) {
      setError('Latitude dan longitude harus diisi bersama.')
      setBusy(false)
      return
    }
    const parsedLatitude = latitudeValue ? Number(latitudeValue) : undefined
    const parsedLongitude = longitudeValue ? Number(longitudeValue) : undefined
    if ((parsedLatitude !== undefined && (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90))
      || (parsedLongitude !== undefined && (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180))) {
      setError('Koordinat tidak valid. Latitude harus antara -90 dan 90, longitude antara -180 dan 180.')
      setBusy(false)
      return
    }
    const requiredLocationFields = [
      ['city', 'Kota/kabupaten'],
      ['district', 'Kecamatan'],
      ['village', 'Kelurahan/desa'],
      ['locationDetail', 'Patokan lokasi'],
    ] as const
    const missingLocationFields = requiredLocationFields
      .filter(([name]) => !String(form.get(name) ?? '').trim())
      .map(([, label]) => label)
    if (missingLocationFields.length > 0) {
      setError(`Wilayah belum lengkap. Pilih hasil lokasi yang mengisi wilayah otomatis atau lengkapi: ${missingLocationFields.join(', ')}.`)
      setBusy(false)
      return
    }
    const photos = form.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0)
    if (photos.length < 1) {
      setError('Pilih minimal satu foto pendukung.')
      setBusy(false)
      return
    }
    if (photos.length > 3) {
      setError('Maksimal 3 foto pendukung.')
      setBusy(false)
      return
    }
    if (photos.some((photo) => photo.size > 5242880)) {
      setError('Ukuran tiap foto maksimal 5 MB.')
      setBusy(false)
      return
    }
    if (photos.some((photo) => !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type))) {
      setError('Gunakan foto JPG, PNG, atau WebP.')
      setBusy(false)
      return
    }
    const categoryId = Number(form.get('categoryId'))
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      setError('Pilih kategori laporan.')
      setBusy(false)
      return
    }
    try {
      const result = await createReport({
        categoryId,
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        city: String(form.get('city') ?? ''),
        district: String(form.get('district') ?? ''),
        village: String(form.get('village') ?? ''),
        locationDetail: String(form.get('locationDetail') ?? ''),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        submissionKey,
        photos,
      })
      onToast(`Laporan ${result.code} berhasil dikirim.`)
      navigate('/dashboard')
    } catch (reason) {
      if (reason instanceof ApiError) {
        const fields = reason.fields ? Object.values(reason.fields).join(' ') : ''
        setError(fields ? `${reason.message}: ${fields}` : reason.message)
      } else {
        setError('Terjadi kendala. Isianmu tetap tersimpan di halaman.')
      }
    } finally {
      setBusy(false)
    }
  }

  const options = categories ?? []

  return <ReporterShell crumb="Buat laporan"><div className="app-theme app-public"><div className="page container narrow-page"><Link to="/dashboard" className="back-link"><ArrowLeft size={16}/> Kembali ke dashboard</Link><PageIntro title="Ceritakan temuanmu." description="Informasi yang jelas membantu laporan ditinjau dengan lebih mudah."/><div className="demo-banner"><Info size={18}/><span>Laporan barumu hanya dapat dilihat olehmu sampai ditinjau administrator platform.</span></div><form ref={formRef} className="content-panel report-form" onSubmit={submit} onInput={handleLocationInput}>
    <div className="form-section-title"><span>01</span><div><h2>Jenis masalah</h2><p>Pilih kategori yang paling sesuai.</p></div></div>
    <div className="form-field"><label htmlFor="categoryId">Kategori *</label><select id="categoryId" name="categoryId" required defaultValue=""><option value="" disabled>{categoryLoading ? 'Memuat kategori…' : 'Pilih kategori laporan'}</option>{options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{categoryError ? <small>Kategori tidak dapat dimuat. Coba muat ulang halaman.</small> : null}</div>
    <div className="form-section-title"><span>02</span><div><h2>Detail laporan</h2><p>Jelaskan apa yang kamu temukan.</p></div></div>
    <TextField label="Judul laporan" id="title" placeholder="Contoh: Lampu jalan padam dekat taman" hint="10-100 karakter"/>
    <div className="form-field"><label htmlFor="description">Deskripsi *</label><textarea id="description" name="description" required minLength={30} maxLength={1000} rows={5} placeholder="Ceritakan kondisi dan kapan kamu menemukannya."/><small>30-1.000 karakter</small></div>
    <div className="form-section-title"><span>03</span><div><h2>Wilayah</h2><p>Gunakan patokan umum, bukan alamat rumah.</p></div></div>
    <TextField label="Cari tempat atau alamat umum" id="locationSearchQuery" required={false} placeholder="Contoh: Taman kota, Bandung" hint="Isi tempat/patokan, lalu cari titik untuk mengisi wilayah otomatis."/>
    <div className="form-two"><TextField label="Kota/kabupaten" id="city" required={false} placeholder="Terisi dari pilihan lokasi"/><TextField label="Kecamatan" id="district" required={false} placeholder="Terisi dari pilihan lokasi"/></div>
    <TextField label="Kelurahan/desa" id="village" required={false} placeholder="Terisi dari pilihan lokasi"/>
    <TextField label="Patokan lokasi" id="locationDetail" required={false} placeholder="Terisi dari pilihan lokasi" hint="Hindari alamat rumah pribadi."/>
    <div className="form-section-title"><span>04</span><div><h2>Titik lokasi (opsional)</h2><p>Pilih hasil pencarian untuk mengisi titik dan wilayah otomatis, atau gunakan lokasi perangkat.</p></div></div>
    <div className="report-coordinate-panel">
      <button type="button" className="button outline report-location-button" onClick={searchLocationFromAddress} disabled={locationBusy || busy}>
        <Search size={17} aria-hidden="true"/>{locationBusy ? 'Mencari lokasi…' : 'Cari titik dari lokasi'}
      </button>
      <p className="report-location-hint">Saat ditekan, patokan dan wilayah dikirim ke OpenStreetMap untuk dicari. Pilih hasil yang paling sesuai—titiknya bisa berupa perkiraan area. Jangan masukkan alamat rumah pribadi.</p>
      {locationResults.length ? <div className="report-location-results" role="group" aria-label="Hasil pencarian lokasi">
        <p className="report-location-results-label">Pilih titik lokasi yang sesuai:</p>
        {locationResults.map((location, index) => <button type="button" className="report-location-result" key={`${location.latitude},${location.longitude}`} onClick={() => selectLocation(location)}>
          <MapPin size={16} aria-hidden="true"/><span>{location.displayName}</span><small>Pilih</small>
        </button>)}
      </div> : null}
      {selectedLocation ? <div className="report-selected-location"><MapPin size={15} aria-hidden="true"/><span>Titik terpilih: {selectedLocation.displayName}</span></div> : null}
      <button type="button" className="button outline report-location-button" onClick={useDeviceLocation} disabled={locationBusy || busy}>
        <LocateFixed size={17} aria-hidden="true"/>{locationBusy ? 'Mengambil lokasi…' : 'Gunakan lokasi saya'}
      </button>
      <p className="report-location-hint">Browser meminta izin lokasi. Titik publik ditampilkan dengan pembulatan 3 desimal.</p>
      <details className="report-manual-coordinates">
        <summary>Masukkan koordinat manual</summary>
        <div className="form-two report-coordinate-fields">
          <div className="form-field"><label htmlFor="latitude">Latitude</label><input id="latitude" name="latitude" type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => { setLatitude(event.target.value); setSelectedLocation(null); setLocationMessage(''); setLocationError('') }} placeholder="Contoh: -6.1752" aria-describedby="coordinate-range-hint"/></div>
          <div className="form-field"><label htmlFor="longitude">Longitude</label><input id="longitude" name="longitude" type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => { setLongitude(event.target.value); setSelectedLocation(null); setLocationMessage(''); setLocationError('') }} placeholder="Contoh: 106.8271" aria-describedby="coordinate-range-hint"/></div>
        </div>
        <small id="coordinate-range-hint" className="report-location-hint">Isi keduanya atau biarkan kosong. Latitude: -90 sampai 90; longitude: -180 sampai 180.</small>
      </details>
      <small className="report-map-attribution">Pencarian peta © OpenStreetMap contributors</small>
      {locationMessage ? <p className="report-location-feedback" role="status">{locationMessage}</p> : null}
      {locationError ? <p className="report-location-feedback report-location-feedback-error" role="alert">{locationError}</p> : null}
    </div>
    <div className="form-section-title"><span>05</span><div><h2>Foto pendukung</h2><p>Unggah 1-3 foto, maksimal 5 MB per foto.</p></div></div>
    <label className="upload-field" htmlFor="photos"><FilePlus2 size={22}/><b>Pilih foto dari perangkat</b><span>1–3 foto JPG, PNG, atau WebP · Maksimal 5 MB per foto</span><input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required/></label>
    <div className="privacy-hint"><Info size={15}/> Hindari foto wajah, plat nomor, atau informasi pribadi.</div>
    <div className="auth-error" role="alert">{error}</div>
    <div className="form-actions"><Button to="/dashboard" variant="outline">Simpan nanti</Button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim laporan'} <ArrowRight size={16}/></button></div>
  </form></div></div></ReporterShell>
}
