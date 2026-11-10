import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  FilePlus2,
  Info,
  MapPin,
  MoreHorizontal,
  SearchX,
  Send,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react'
import { CategoryIcon, Dropdown } from '../../components/ui'
import { ApiError, mediaSrc } from '../../shared/api/client'
import { createReport, getCategories, getMyReport, getMyReports, getPublicReport } from '../../shared/api/endpoints'
import { useSession } from '../../shared/session'
import { useAsync } from '../../shared/useAsync'
import {
  clampReportPage,
  countByStatus,
  formatDateTime,
  formatSubmitted,
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

function RowMenu({ code, isPublic }: { code: string; isPublic: boolean }) {
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
                          <RowMenu code={row.code} isPublic={publicStatuses.includes(row.status)} />
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

export function PrivateDetail() {
  const { code = '' } = useParams()
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
        </div>
      </div>
    </ReporterShell>
  )
}

/* ---------------------------------------------------------- buat laporan */

export function CreateReport({ onToast }: { onToast: (s: string) => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submissionKey] = useState(() => crypto.randomUUID())
  const loadCategories = useCallback(() => getCategories(), [])
  const { data: categories, error: categoryError, loading: categoryLoading } = useAsync(loadCategories, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
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

  return (
    <ReporterShell crumb="Buat laporan">
      <div className="rep-page rep-page-narrow">
        <Link className="rep-back" to="/dashboard">
          <ArrowLeft size={15} aria-hidden="true" /> Kembali ke dashboard
        </Link>
        <header className="rep-head">
          <h1>Ceritakan temuanmu.</h1>
          <p>Informasi yang jelas membantu laporan ditinjau dengan lebih mudah.</p>
        </header>
        <div className="rep-banner tone-info">
          <Info size={18} aria-hidden="true" />
          <div>
            <b>Laporan barumu hanya bisa dilihat olehmu</b>
            <p>Laporan baru akan tampil pada halaman publik setelah diverifikasi administrator platform.</p>
          </div>
        </div>
        <form className="content-panel report-form" onSubmit={submit}>
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h2>Jenis masalah</h2>
              <p>Pilih kategori yang paling sesuai.</p>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="categoryId">Kategori *</label>
            <select id="categoryId" name="categoryId" required defaultValue="">
              <option value="" disabled>
                {categoryLoading ? 'Memuat kategori…' : 'Pilih kategori laporan'}
              </option>
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {categoryError ? <small>Kategori tidak dapat dimuat. Coba muat ulang halaman.</small> : null}
          </div>
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h2>Detail laporan</h2>
              <p>Jelaskan apa yang kamu temukan.</p>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="title">Judul laporan *</label>
            <input id="title" name="title" type="text" required minLength={10} maxLength={100} placeholder="Contoh: Lampu jalan padam dekat taman" />
            <small>10-100 karakter</small>
          </div>
          <div className="form-field">
            <label htmlFor="description">Deskripsi *</label>
            <textarea id="description" name="description" required minLength={30} maxLength={1000} rows={5} placeholder="Ceritakan kondisi dan kapan kamu menemukannya." />
            <small>30-1.000 karakter</small>
          </div>
          <div className="form-section-title">
            <span>03</span>
            <div>
              <h2>Wilayah</h2>
              <p>Gunakan patokan umum, bukan alamat rumah.</p>
            </div>
          </div>
          <div className="form-two">
            <div className="form-field">
              <label htmlFor="city">Kota/kabupaten *</label>
              <input id="city" name="city" type="text" required placeholder="Contoh: Bandung" />
            </div>
            <div className="form-field">
              <label htmlFor="district">Kecamatan *</label>
              <input id="district" name="district" type="text" required placeholder="Nama kecamatan" />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="village">Kelurahan/desa *</label>
            <input id="village" name="village" type="text" required placeholder="Nama kelurahan atau desa" />
          </div>
          <div className="form-field">
            <label htmlFor="locationDetail">Patokan lokasi *</label>
            <input id="locationDetail" name="locationDetail" type="text" required placeholder="Contoh: depan taman lingkungan" />
            <small>Hindari alamat rumah pribadi.</small>
          </div>
          <div className="form-section-title">
            <span>04</span>
            <div>
              <h2>Foto pendukung</h2>
              <p>Unggah 1-3 foto, maksimal 5 MB per foto.</p>
            </div>
          </div>
          <label className="upload-field" htmlFor="photos">
            <FilePlus2 size={22} aria-hidden="true" />
            <b>Pilih foto dari perangkat</b>
            <span>1–3 foto JPG, PNG, atau WebP · Maksimal 5 MB per foto</span>
            <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required />
          </label>
          <div className="privacy-hint">
            <Info size={15} aria-hidden="true" /> Hindari foto wajah, plat nomor, atau informasi pribadi.
          </div>
          <div className="auth-error" role="alert">
            {error}
          </div>
          <div className="form-actions">
            <Link className="rep-btn rep-btn-outline" to="/dashboard">
              Simpan nanti
            </Link>
            <button className="rep-btn" type="submit" disabled={busy}>
              {busy ? 'Mengirim…' : 'Kirim laporan'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </ReporterShell>
  )
}
