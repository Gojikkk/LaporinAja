import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Construction,
  Copy,
  Ellipsis,
  Info,
  Lightbulb,
  MapPin,
  RotateCcw,
  SearchX,
  Send,
  Trash2,
  Waves,
  Wrench,
  X,
} from 'lucide-react'
import type { Status } from '../../shared/report-data'
import { AdminShell, useAdminTitle } from './shell'
import {
  adminCategories,
  adminStatus,
  countByStatus,
  formatSubmitted,
  prioritize,
  publicStatuses,
  transitionReport,
  useAdminReports,
  type AdminReport,
} from './data'

const PAGE_SIZE = 6
const STATUSES: Status[] = ['SUBMITTED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'DUPLICATE']

const statusIcon: Record<Status, typeof Send> = {
  SUBMITTED: Send,
  VERIFIED: CircleCheck,
  IN_PROGRESS: Wrench,
  RESOLVED: CircleCheck,
  REJECTED: CircleAlert,
  DUPLICATE: Copy,
}

const categoryIcon: Record<string, typeof Send> = {
  'Jalan rusak': Construction,
  'Lampu jalan': Lightbulb,
  Sampah: Trash2,
  'Saluran air': Waves,
  'Fasilitas umum': Building2,
  Lainnya: CircleHelp,
}

/** Ilustrasi kategori dari frame tablet; kategori tanpa aset memakai ilustrasi umum. */
const categoryIllustration: Record<string, string> = {
  'Jalan rusak': '/demo/kategori/jalan-rusak.png',
  'Lampu jalan': '/demo/kategori/lampu-jalan.png',
  Sampah: '/demo/kategori/sampah.png',
  'Saluran air': '/demo/kategori/saluran-air.png',
  'Fasilitas umum': '/demo/kategori/jalan-rusak.png',
  Lainnya: '/demo/kategori/jalan-rusak.png',
}

/** Foto demo per kategori agar kartu ponsel dan galeri konsisten dengan ilustrasinya. */
const categoryPhoto: Record<string, string> = {
  'Jalan rusak': '/demo/kategori/jalan-rusak.jpg',
  'Lampu jalan': '/demo/kategori/lampu-jalan.jpg',
  Sampah: '/demo/kategori/sampah.jpg',
  'Saluran air': '/demo/kategori/saluran-air.jpg',
  'Fasilitas umum': '/demo/kategori/jalan-rusak.jpg',
  Lainnya: '/demo/kategori/jalan-rusak.jpg',
}

function reportPhoto(report: AdminReport) {
  return categoryPhoto[report.category] ?? categoryPhoto.Lainnya
}

/* ------------------------------------------------------------------ pieces */

function StatusPill({ status }: { status: Status }) {
  const meta = adminStatus[status]
  const Icon = statusIcon[status]
  return (
    <span className={`adm-badge tone-${meta.tone}`}>
      <Icon size={16} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

function ReportTable({ rows, caption }: { rows: AdminReport[]; caption: string }) {
  return (
    <div className="adm-table" role="table" aria-label={caption}>
      <div className="adm-thead-wrap" role="rowgroup">
        <div className="adm-thead" role="row">
          <span className="adm-col-id" role="columnheader">
            ID laporan
          </span>
          <span className="adm-col-main" role="columnheader">
            Judul / lokasi
          </span>
          <span className="adm-col-cat" role="columnheader">
            Kategori
          </span>
          <span className="adm-col-date" role="columnheader">
            Tanggal
          </span>
          <span className="adm-col-status" role="columnheader">
            Status / aksi
          </span>
        </div>
      </div>

      <div className="adm-tbody" role="rowgroup">
        {rows.map((report) => {
          const CategoryIcon = categoryIcon[report.category] ?? CircleHelp
          const date = formatSubmitted(report.submittedAt)
          const meta = `${report.category} · ${report.city} · ${report.district} · ${report.village}`
          return (
            <div className="adm-row" role="row" key={report.code}>
              <div className="adm-row-art" role="presentation" aria-hidden="true">
                <img
                  src={categoryIllustration[report.category] ?? categoryIllustration.Lainnya}
                  alt=""
                  loading="lazy"
                />
              </div>
              <div className="adm-row-photo" role="presentation" aria-hidden="true">
                <img src={reportPhoto(report)} alt="" loading="lazy" />
              </div>
              <div className="adm-col-id" role="cell">
                <Link className="adm-code" to={`/admin/laporan/${report.code}`}>
                  {report.code}
                </Link>
              </div>
              <div className="adm-col-main" role="cell">
                <Link className="adm-row-title" to={`/admin/laporan/${report.code}`}>
                  {report.title}
                </Link>
                <span className="adm-row-loc">
                  {report.city} · {report.district} · {report.village}
                </span>
                <span className="adm-row-meta">
                  <MapPin size={16} aria-hidden="true" />
                  {meta}
                </span>
                <span className="adm-row-date">{date}</span>
              </div>
              <div className="adm-col-cat" role="cell">
                <CategoryIcon size={20} aria-hidden="true" />
                <span>{report.category}</span>
              </div>
              <div className="adm-col-date" role="cell">
                {date}
              </div>
              <div className="adm-col-status" role="cell">
                <StatusPill status={report.status} />
                <Link className="adm-more" to={`/admin/laporan/${report.code}`} aria-label={`Tinjau ${report.code}`}>
                  <Ellipsis size={20} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- dashboard */

export function Admin() {
  useAdminTitle('Dashboard')
  const reports = useAdminReports()
  const counts = countByStatus(reports)
  const pending = counts.SUBMITTED
  const recent = [...reports].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 4)
  const publicTotal = publicStatuses.reduce((total, status) => total + counts[status], 0)

  const metrics: Array<{ label: string; value: number }> = [
    { label: adminStatus.SUBMITTED.label, value: counts.SUBMITTED },
    { label: adminStatus.VERIFIED.label, value: counts.VERIFIED },
    { label: adminStatus.IN_PROGRESS.label, value: counts.IN_PROGRESS },
    { label: adminStatus.RESOLVED.label, value: counts.RESOLVED },
    { label: adminStatus.REJECTED.label, value: counts.REJECTED },
    { label: adminStatus.DUPLICATE.label, value: counts.DUPLICATE },
  ]

  return (
    <AdminShell crumb="Dashboard">
      <header className="adm-head">
        <h1>Utamakan laporan yang belum ditinjau.</h1>
        <p>Administrator platform · Tahap awal · Data demonstrasi</p>
      </header>

      <section className="adm-banner" aria-labelledby="adm-priority">
        <p className="adm-eyebrow">ANTREAN MENUNGGU VERIFIKASI</p>
        <h2 id="adm-priority">{pending} laporan perlu ditinjau</h2>
        <p>Mulai dari kelengkapan kategori, kondisi, lokasi, dan foto. Laporan ini belum terlihat di publik.</p>
        <Link className="adm-btn" to="/admin/laporan?status=SUBMITTED">
          Buka antrean verifikasi
        </Link>
      </section>

      <section className="adm-section" aria-labelledby="adm-recent">
        <h2 className="adm-section-title" id="adm-recent">
          Antrean terbaru
        </h2>
        <ReportTable rows={recent} caption="Empat laporan terbaru yang masuk" />
      </section>

      <section className="adm-section" aria-labelledby="adm-summary">
        <h2 className="adm-section-title" id="adm-summary">
          Seluruh laporan: {reports.length}
        </h2>
        <div className="adm-metrics">
          {metrics.map((metric) => (
            <article className="adm-metric" key={metric.label}>
              <span className="adm-metric-label">{metric.label}</span>
              <strong className="adm-metric-value">{metric.value}</strong>
              <span className="adm-metric-note">Data demonstrasi</span>
            </article>
          ))}
        </div>
        <p className="adm-note">
          Publik: {publicTotal} = {counts.VERIFIED} terverifikasi + {counts.IN_PROGRESS} ditindaklanjuti +{' '}
          {counts.RESOLVED} selesai + {counts.DUPLICATE} duplikat. Data demonstrasi.
        </p>
      </section>
    </AdminShell>
  )
}

/* ------------------------------------------------------------- report queue */

export function AdminQueue() {
  useAdminTitle('Manajemen Laporan')
  const reports = useAdminReports()
  const [params, setParams] = useSearchParams()

  const statusParam = params.get('status')
  const categoryParam = params.get('kategori')
  const statusFilter: Status | 'ALL' = STATUSES.includes(statusParam as Status)
    ? (statusParam as Status)
    : 'ALL'
  const categoryFilter = categoryParam && adminCategories.includes(categoryParam) ? categoryParam : 'ALL'
  const pageParam = Number(params.get('halaman') ?? 1)

  const [draftStatus, setDraftStatus] = useState<Status | 'ALL'>(statusFilter)
  const [draftCategory, setDraftCategory] = useState(categoryFilter)

  useEffect(() => {
    setDraftStatus(statusFilter)
    setDraftCategory(categoryFilter)
  }, [statusFilter, categoryFilter])

  const filtered = useMemo(
    () =>
      prioritize(
        reports.filter(
          (report) =>
            (statusFilter === 'ALL' || report.status === statusFilter) &&
            (categoryFilter === 'ALL' || report.category === categoryFilter),
        ),
      ),
    [reports, statusFilter, categoryFilter],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, Number.isFinite(pageParam) ? Math.trunc(pageParam) : 1), pageCount)
  const firstIndex = (currentPage - 1) * PAGE_SIZE
  const visible = filtered.slice(firstIndex, firstIndex + PAGE_SIZE)
  const showingFrom = filtered.length ? firstIndex + 1 : 0
  const showingTo = Math.min(firstIndex + PAGE_SIZE, filtered.length)

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (draftStatus !== 'ALL') next.set('status', draftStatus)
    if (draftCategory !== 'ALL') next.set('kategori', draftCategory)
    setParams(next)
  }

  function resetFilters() {
    setParams(new URLSearchParams())
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(params)
    if (page > 1) next.set('halaman', String(page))
    else next.delete('halaman')
    setParams(next)
  }

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)

  return (
    <AdminShell crumb="Manajemen Laporan">
      <header className="adm-head">
        <h1>Manajemen Laporan</h1>
        <p>
          {reports.length} laporan · Data demonstrasi · Menunggu verifikasi di urutan teratas
        </p>
      </header>

      <form className="adm-filter-card" onSubmit={applyFilters}>
        <div className="adm-field">
          <span id="adm-status-label">Status</span>
          <div className="adm-select-wrap">
            <select
              className={draftStatus === 'ALL' ? 'adm-select is-placeholder' : 'adm-select'}
              aria-labelledby="adm-status-label"
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as Status | 'ALL')}
            >
              <option value="ALL">Semua status</option>
              {STATUSES.map((status) => (
                <option value={status} key={status}>
                  {adminStatus[status].label}
                </option>
              ))}
            </select>
            <ChevronDown size={20} aria-hidden="true" />
          </div>
        </div>

        <div className="adm-field">
          <span id="adm-category-label">Kategori</span>
          <div className="adm-select-wrap">
            <select
              className={draftCategory === 'ALL' ? 'adm-select is-placeholder' : 'adm-select'}
              aria-labelledby="adm-category-label"
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value)}
            >
              <option value="ALL">Semua kategori</option>
              {adminCategories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
            <ChevronDown size={20} aria-hidden="true" />
          </div>
        </div>

        <button type="submit" className="adm-btn">
          Terapkan filter
        </button>
      </form>

      <section className="adm-section" aria-label="Daftar laporan">
        {visible.length ? (
          <>
            <ReportTable rows={visible} caption="Daftar laporan pada halaman ini" />

            <nav className="adm-pagination" aria-label="Navigasi halaman laporan">
              <p className="adm-count">
                Menampilkan {showingFrom}–{showingTo} dari {filtered.length} laporan
              </p>
              <div className="adm-page-nav">
                <button
                  type="button"
                  className="adm-page-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Halaman sebelumnya"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                {pages.map((page) => (
                  <button
                    type="button"
                    key={page}
                    className="adm-page-btn"
                    aria-current={page === currentPage ? 'page' : undefined}
                    aria-label={`Halaman ${page}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="adm-page-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === pageCount}
                  aria-label="Halaman berikutnya"
                >
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </nav>

            <p className="adm-note">
              Aksi pada tiap laporan membuka peninjauan sesuai status terakhir. Tidak ada pembuatan laporan dari
              ruang Admin.
            </p>
          </>
        ) : (
          <>
            <div className="adm-empty">
              <SearchX size={32} aria-hidden="true" />
              <h2>Tidak ada laporan menunggu</h2>
              <p>
                Tidak ada hasil untuk filter ini. Coba pilih status atau kategori lain untuk melihat lebih banyak
                laporan.
              </p>
              <button type="button" className="adm-btn adm-btn-outline" onClick={resetFilters}>
                Reset filter
              </button>
            </div>
            <Link className="adm-btn adm-btn-outline" to="/admin">
              Lihat semua laporan
            </Link>
          </>
        )}
      </section>
    </AdminShell>
  )
}

/* ------------------------------------------------------------- review detail */

type ActionKind = 'verify' | 'reject' | 'start' | 'resolve' | 'reopen'

const actionCopy: Record<
  ActionKind,
  {
    title: string
    intro: string
    submit: string
    success: string
    history: string
    next: Status
    fieldLabel?: string
    fieldHint?: string
    fieldPlaceholder?: string
    minLength?: number
    confirm?: string
  }
> = {
  verify: {
    title: 'Verifikasi laporan ini?',
    intro:
      'Setelah diverifikasi, laporan tampil di halaman publik dan dapat ditindaklanjuti. Pastikan bukti, kategori, dan lokasi sudah sesuai.',
    submit: 'Verifikasi laporan',
    success: 'Laporan diverifikasi dan kini tampil di halaman publik.',
    history: 'Laporan diverifikasi',
    next: 'VERIFIED',
    confirm: 'Saya sudah memeriksa bukti, kategori, dan lokasi laporan ini.',
  },
  reject: {
    title: 'Tolak laporan',
    intro:
      'Alasan penolakan terlihat oleh pelapor, bukan publik. Status berubah menjadi ditolak dan laporan dapat diajukan ulang.',
    submit: 'Tolak laporan',
    success: 'Laporan ditolak dan alasannya tercatat pada riwayat.',
    history: 'Laporan ditolak',
    next: 'REJECTED',
    fieldLabel: 'Alasan penolakan',
    fieldHint: 'Jelaskan bagian yang belum memenuhi syarat agar pelapor dapat memperbaiki laporannya.',
    fieldPlaceholder: 'Contoh: foto belum menunjukkan kondisi fasilitas yang dilaporkan.',
    minLength: 10,
  },
  start: {
    title: 'Mulai tindak lanjut',
    intro: 'Catat rencana tindakan pertama agar warga dapat mengikuti perkembangan penanganan.',
    submit: 'Mulai tindak lanjut',
    success: 'Tindak lanjut dimulai dan tercatat pada riwayat laporan.',
    history: 'Tindak lanjut dimulai',
    next: 'IN_PROGRESS',
    fieldLabel: 'Rencana tindakan',
    fieldHint: 'Sebutkan tindakan pertama yang akan dilakukan.',
    fieldPlaceholder: 'Contoh: pemeriksaan kondisi jalan dijadwalkan minggu ini.',
    minLength: 10,
  },
  resolve: {
    title: 'Catat penyelesaian',
    intro:
      'Penyelesaian memerlukan catatan hasil dan bukti foto. Bila bukti visual tidak memungkinkan, tulis penjelasan minimal 30 karakter.',
    submit: 'Catat penyelesaian',
    success: 'Penyelesaian dicatat. Riwayat laporan tetap utuh dan tidak dapat diubah.',
    history: 'Tindak lanjut selesai dicatat',
    next: 'RESOLVED',
    fieldLabel: 'Catatan hasil',
    fieldHint: 'Ringkas hasil penanganan yang dilakukan.',
    fieldPlaceholder: 'Contoh: lubang ditambal dan permukaan aspal dirapikan.',
    minLength: 10,
  },
  reopen: {
    title: 'Kembalikan ke antrean',
    intro:
      'Laporan yang ditolak dapat dikembalikan ke antrean verifikasi. Sertakan alasan agar perubahan ini dapat ditelusuri.',
    submit: 'Kembalikan ke antrean',
    success: 'Laporan kembali ke antrean verifikasi.',
    history: 'Laporan dikembalikan ke antrean',
    next: 'SUBMITTED',
    fieldLabel: 'Alasan pengembalian',
    fieldHint: 'Jelaskan mengapa laporan perlu ditinjau ulang.',
    fieldPlaceholder: 'Contoh: pelapor mengirim foto tambahan yang memperjelas kondisi.',
    minLength: 10,
  },
}

const actionMeta: Record<ActionKind, { label: string; icon: ReactNode }> = {
  verify: { label: 'Verifikasi laporan', icon: <CheckCircle2 size={17} aria-hidden="true" /> },
  reject: { label: 'Tolak laporan', icon: <CircleAlert size={17} aria-hidden="true" /> },
  start: { label: 'Mulai tindak lanjut', icon: <Wrench size={17} aria-hidden="true" /> },
  resolve: { label: 'Catat penyelesaian', icon: <CheckCircle2 size={17} aria-hidden="true" /> },
  reopen: { label: 'Kembalikan ke antrean', icon: <RotateCcw size={17} aria-hidden="true" /> },
}

const availableActions: Record<Status, ActionKind[]> = {
  SUBMITTED: ['verify', 'reject'],
  VERIFIED: ['start', 'reject'],
  IN_PROGRESS: ['resolve'],
  RESOLVED: [],
  REJECTED: ['reopen'],
  DUPLICATE: [],
}

const readonlyCopy: Partial<Record<Status, string>> = {
  RESOLVED: 'Penyelesaian sudah dicatat. Catatan dan bukti tetap dapat dibaca, tanpa opsi perubahan.',
  DUPLICATE: 'Laporan ini merujuk pada laporan utama. Tidak ada tindakan lanjutan yang tersedia di halaman ini.',
}

function ActionDialog({
  kind,
  report,
  onClose,
  onDone,
}: {
  kind: ActionKind
  report: AdminReport
  onClose: () => void
  onDone: (message: string) => void
}) {
  const copy = actionCopy[kind]
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState('')
  const [explanation, setExplanation] = useState('')
  const [hasProof, setHasProof] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  // showModal memberi focus trap dan latar belakang inert tanpa kode tambahan.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = note.trim()

    if (copy.confirm && !confirmed) {
      setError('Centang pernyataan pemeriksaan sebelum melanjutkan.')
      return
    }
    if (copy.minLength && value.length < copy.minLength) {
      setError(`${copy.fieldLabel} minimal ${copy.minLength} karakter.`)
      return
    }
    if (kind === 'resolve' && !hasProof && explanation.trim().length < 30) {
      setError('Sertakan foto bukti atau penjelasan minimal 30 karakter agar penyelesaian dapat ditinjau.')
      return
    }

    const summary = kind === 'resolve' && !hasProof ? `${value} Tanpa foto: ${explanation.trim()}` : value

    transitionReport(report.code, copy.next, {
      title: copy.history,
      note: summary || copy.confirm || 'Tidak ada catatan tambahan.',
      transition: `${adminStatus[report.status].label} → ${adminStatus[copy.next].label}`,
    })
    onDone(copy.success)
  }

  return (
    <dialog
      ref={dialogRef}
      className="adm-dialog"
      aria-labelledby="adm-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="adm-dialog-body">
        <div className="adm-dialog-head">
          <div>
            <h2 className="adm-dialog-title" id="adm-dialog-title">
              {copy.title}
            </h2>
            <p className="adm-dialog-copy">{copy.intro}</p>
          </div>
          <button type="button" className="adm-icon-btn" aria-label="Tutup dialog" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {copy.fieldLabel ? (
            <div className="adm-dialog-field">
              <label htmlFor="adm-note">{copy.fieldLabel} *</label>
              <textarea
                id="adm-note"
                value={note}
                autoFocus
                placeholder={copy.fieldPlaceholder}
                onChange={(event) => {
                  setNote(event.target.value)
                  setError('')
                }}
              />
              <span className="adm-help">{copy.fieldHint}</span>
              <span className="adm-help">
                {note.trim().length} karakter · minimal {copy.minLength}
              </span>
            </div>
          ) : null}

          {kind === 'resolve' ? (
            <>
              <label className="adm-check">
                <input type="checkbox" checked={hasProof} onChange={(event) => setHasProof(event.target.checked)} />
                <span>Foto bukti penyelesaian sudah dilampirkan.</span>
              </label>
              <div className="adm-dialog-field">
                <label htmlFor="adm-explanation">Penjelasan tanpa foto</label>
                <textarea
                  id="adm-explanation"
                  value={explanation}
                  disabled={hasProof}
                  placeholder="Isi hanya bila bukti visual tidak memungkinkan, misalnya area tertutup atau berbahaya untuk difoto."
                  onChange={(event) => {
                    setExplanation(event.target.value)
                    setError('')
                  }}
                />
                <span className="adm-help">
                  {hasProof
                    ? 'Tidak diperlukan karena foto bukti sudah dilampirkan.'
                    : `${explanation.trim().length} karakter · minimal 30 bila tanpa foto`}
                </span>
              </div>
            </>
          ) : null}

          {copy.confirm ? (
            <label className="adm-check">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>{copy.confirm}</span>
            </label>
          ) : null}

          {error ? (
            <p className="adm-error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : null}

          <div className="adm-dialog-actions">
            <button type="button" className="adm-btn adm-btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="adm-btn">
              {copy.submit}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}

function Gallery({ report }: { report: AdminReport }) {
  const date = formatSubmitted(report.submittedAt)
  return (
    <section className="adm-gallery" aria-label="Galeri bukti">
      <img
        className="adm-gallery-main"
        src="/demo/laporan-jalan-1.jpg"
        alt={`Foto kondisi awal laporan ${report.code}`}
      />
      {report.photos > 1 ? (
        <div className="adm-gallery-thumbs">
          <img src="/demo/laporan-jalan-2.jpg" alt="" aria-hidden="true" />
          {report.photos > 2 ? <img src="/demo/laporan-jalan-2.jpg" alt="" aria-hidden="true" /> : null}
        </div>
      ) : null}
      <p className="adm-gallery-caption">
        {report.photos} foto kondisi awal · {date}
      </p>
    </section>
  )
}

export function AdminDetail() {
  useAdminTitle('Tinjau laporan')
  const { code = '' } = useParams()
  const reports = useAdminReports()
  const report = reports.find((row) => row.code === code)
  const [dialog, setDialog] = useState<ActionKind | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(timer)
  }, [toast])

  if (!report) {
    return (
      <AdminShell crumb="Laporan tidak ditemukan">
        <div className="adm-empty">
          <SearchX size={32} aria-hidden="true" />
          <h2>Laporan tidak ditemukan</h2>
          <p>Kode laporan ini tidak ada pada antrean, atau sudah tidak tersedia untuk ditinjau.</p>
          <Link className="adm-btn adm-btn-outline" to="/admin/laporan">
            Kembali ke manajemen laporan
          </Link>
        </div>
      </AdminShell>
    )
  }

  const actions = availableActions[report.status]
  const readonly = readonlyCopy[report.status]

  return (
    <AdminShell crumb={`Review · ${report.status}`}>
      <p className="adm-eyebrow">Tahap awal · Data demonstrasi</p>
      <div className="adm-detail-status">
        <StatusPill status={report.status} />
      </div>
      <p className="adm-eyebrow">{report.code}</p>
      <h1 className="adm-title">{report.title}</h1>
      <p className="adm-detail-meta">
        {report.category} · {report.city} / {report.district} / {report.village} ·{' '}
        {formatSubmitted(report.submittedAt)}
      </p>

      <section className="adm-card" aria-labelledby="adm-actions">
        <h2 className="adm-card-title" id="adm-actions">
          Tindakan administrator
        </h2>

        {actions.length ? (
          <>
            <div className="adm-action-list">
              {actions.map((action, index) => (
                <button
                  type="button"
                  key={action}
                  className={
                    action === 'reject'
                      ? 'adm-btn adm-btn-danger'
                      : index === 0
                        ? 'adm-btn'
                        : 'adm-btn adm-btn-outline'
                  }
                  onClick={() => setDialog(action)}
                >
                  {actionMeta[action].icon}
                  {actionMeta[action].label}
                </button>
              ))}
            </div>
            <p className="adm-card-note">
              {report.status === 'IN_PROGRESS'
                ? 'Penyelesaian memerlukan catatan hasil dan bukti foto, atau penjelasan minimal 30 karakter.'
                : 'Tidak dapat langsung beralih ke Tindak lanjut selesai.'}
            </p>
          </>
        ) : (
          <p className="adm-card-note">{readonly ?? 'Tidak ada tindakan yang tersedia untuk status ini.'}</p>
        )}
      </section>

      <Gallery report={report} />

      <section className="adm-card" aria-labelledby="adm-internal">
        <p className="adm-eyebrow">INTERNAL · HANYA ADMIN</p>
        <h2 className="adm-card-title" id="adm-internal">
          Pelapor: {report.reporter}
        </h2>
        <p className="adm-card-note">
          Identitas fiktif · kontak tidak diperlukan untuk peninjauan ini.
        </p>
        <p className="adm-card-note">
          Administrator platform · identitas individu admin tidak ditampilkan kepada publik.
        </p>
      </section>

      <section className="adm-card" aria-labelledby="adm-detail-copy">
        <h2 className="adm-card-title" id="adm-detail-copy">
          Detail laporan
        </h2>
        <p className="adm-prose">{report.description}</p>
        <p className="adm-card-strong">
          {report.city} / {report.district} / {report.village}
        </p>
        <p className="adm-card-note">Patokan: {report.landmark}</p>
      </section>

      <section className="adm-card" aria-labelledby="adm-history">
        <h2 className="adm-section-title" id="adm-history">
          Riwayat yang dapat ditelusuri
        </h2>
        <p className="adm-card-caption">Urutan kronologis · catatan ditambahkan, tidak ditimpa</p>
        <ol className="adm-timeline">
          {report.history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <span className="adm-timeline-mark" aria-hidden="true">
                <span className="adm-timeline-dot">
                  {index === 0 ? <Info size={14} /> : <CheckCircle2 size={14} />}
                </span>
              </span>
              <div className="adm-timeline-body">
                <span className="adm-timeline-date">{entry.at}</span>
                <p className="adm-timeline-title">{entry.title}</p>
                {entry.transition ? <p className="adm-timeline-transition">{entry.transition}</p> : null}
                <p className="adm-timeline-note">{entry.note}</p>
                <span className="adm-timeline-actor">Pelapor</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Link className="adm-btn adm-btn-outline adm-back" to="/admin/laporan">
        Kembali ke manajemen laporan
      </Link>

      {dialog ? (
        <ActionDialog
          kind={dialog}
          report={report}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null)
            setToast(message)
          }}
        />
      ) : null}

      {toast ? (
        <div className="adm-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{toast}</span>
        </div>
      ) : null}
    </AdminShell>
  )
}
