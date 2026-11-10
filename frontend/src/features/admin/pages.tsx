import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  Ellipsis,
  Info,
  MapPin,
  RotateCcw,
  SearchX,
  Send,
  Wrench,
  X,
} from 'lucide-react'
import { CategoryIcon, Dropdown } from '../../components/ui'
import type { Status } from '../../shared/report-data'
import { ApiError, mediaSrc } from '../../shared/api/client'
import {
  addFollowUp,
  changeReportStatus,
  exportAdminReports,
  getAdminCategories,
  getAdminReport,
  getAdminReports,
  getAdminStats,
} from '../../shared/api/endpoints'
import type { AdminCategoryDto } from '../../shared/api/types'
import {
  adminStatus,
  countByStatus,
  duplicateCandidates,
  formatSubmitted,
  latestNote,
  mapDetailReport,
  primaryReportOf,
  publicStatuses,
  type AdminReport,
} from '../../shared/report-store'
import { useAsync } from '../../shared/useAsync'
import { AdminShell, useAdminTitle } from './shell'

const PAGE_SIZE = 6
const STATUSES: Status[] = ['SUBMITTED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'DUPLICATE']

function Loading({ crumb }: { crumb: string }) {
  return <AdminShell crumb={crumb}><div className="adm-empty"><Info size={32} aria-hidden="true"/><h2>Memuat data</h2><p>Menghubungkan ke layanan LaporinAja.</p></div></AdminShell>
}

function ErrorState({ message }: { message: string }) {
  return <div className="adm-empty"><CircleAlert size={32} aria-hidden="true"/><h2>Data tidak dapat dimuat</h2><p>{message}</p></div>
}

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    const fields = reason.fields ? Object.values(reason.fields).join(' ') : ''
    return fields ? `${reason.message}: ${fields}` : reason.message
  }
  return reason instanceof Error ? reason.message : 'Terjadi kendala. Coba lagi.'
}

/* ------------------------------------------------------------------ pieces */

function StatusPill({ status }: { status: Status }) {
  const meta = adminStatus[status]
  const Icon = status === 'REJECTED' ? CircleAlert : status === 'IN_PROGRESS' ? Wrench : status === 'SUBMITTED' ? Send : status === 'DUPLICATE' ? Copy : CircleCheck
  return <span className={`adm-badge tone-${meta.tone}`}><Icon size={16} aria-hidden="true"/>{meta.label}</span>
}

function ReportTable({ rows, caption }: { rows: AdminReport[]; caption: string }) {
  return <div className="adm-table" role="table" aria-label={caption}>
    <div className="adm-thead-wrap" role="rowgroup"><div className="adm-thead" role="row">
      <span className="adm-col-id" role="columnheader">ID laporan</span>
      <span className="adm-col-main" role="columnheader">Judul / lokasi</span>
      <span className="adm-col-cat" role="columnheader">Kategori</span>
      <span className="adm-col-date" role="columnheader">Tanggal</span>
      <span className="adm-col-status" role="columnheader">Status / aksi</span>
    </div></div>
    <div className="adm-tbody" role="rowgroup">
      {rows.map((report) => {
        const date = formatSubmitted(report.submittedAt)
        return <div className="adm-row" role="row" key={report.code}>
          <div className="adm-row-art" role="presentation" aria-hidden="true">
            {report.thumbnailUrl ? <img src={mediaSrc(report.thumbnailUrl)} alt="" loading="lazy"/> : <CategoryIcon category={report.categorySlug} size={26}/>}
          </div>
          <div className="adm-col-id" role="cell"><Link className="adm-code" to={`/admin/laporan/${report.code}`}>{report.code}</Link></div>
          <div className="adm-col-main" role="cell">
            <Link className="adm-row-title" to={`/admin/laporan/${report.code}`}>{report.title}</Link>
            <span className="adm-row-loc">{report.city} · {report.district} · {report.village}</span>
            <span className="adm-row-meta"><MapPin size={16} aria-hidden="true"/>{report.category} · {report.city} · {report.district} · {report.village}</span>
            <span className="adm-row-date">{date}</span>
          </div>
          <div className="adm-col-cat" role="cell"><CategoryIcon category={report.categorySlug} size={20}/><span>{report.category}</span></div>
          <div className="adm-col-date" role="cell">{date}</div>
          <div className="adm-col-status" role="cell"><StatusPill status={report.status}/><Link className="adm-more" to={`/admin/laporan/${report.code}`} aria-label={`Tinjau ${report.code}`}><Ellipsis size={20} aria-hidden="true"/></Link></div>
        </div>
      })}
    </div>
  </div>
}

/* --------------------------------------------------------------- dashboard */

export function Admin() {
  useAdminTitle('Dashboard')
  const loadStats = useCallback(() => getAdminStats(), [])
  const loadRecent = useCallback(() => getAdminReports({ limit: 4, page: 1 }), [])
  const { data: stats, error: statsError, loading: statsLoading } = useAsync(loadStats, [])
  const { data: recentPage, loading: recentLoading } = useAsync(loadRecent, [])

  const counts = stats?.byStatus ?? countByStatus([])
  const pending = counts.SUBMITTED
  const recent = (recentPage?.data ?? []).map((dto) => mapDetailReport(dto))
  const publicTotal = publicStatuses.reduce((total, status) => total + counts[status], 0)
  const metrics: Array<{ label: string; value: number }> = [
    { label: adminStatus.SUBMITTED.label, value: counts.SUBMITTED },
    { label: adminStatus.VERIFIED.label, value: counts.VERIFIED },
    { label: adminStatus.IN_PROGRESS.label, value: counts.IN_PROGRESS },
    { label: adminStatus.RESOLVED.label, value: counts.RESOLVED },
    { label: adminStatus.REJECTED.label, value: counts.REJECTED },
    { label: adminStatus.DUPLICATE.label, value: counts.DUPLICATE },
  ]

  if (statsLoading) return <Loading crumb="Dashboard"/>

  return <AdminShell crumb="Dashboard">
    <header className="adm-head"><h1>Utamakan laporan yang belum ditinjau.</h1><p>Administrator platform · Data langsung dari layanan LaporinAja</p></header>
    {statsError ? <ErrorState message={errorMessage(statsError)}/> : null}
    <section className="adm-banner" aria-labelledby="adm-priority">
      <p className="adm-eyebrow">ANTREAN MENUNGGU VERIFIKASI</p>
      <h2 id="adm-priority">{pending} laporan perlu ditinjau</h2>
      <p>Mulai dari kelengkapan kategori, kondisi, lokasi, dan foto. Laporan ini belum terlihat di publik.</p>
      <Link className="adm-btn" to="/admin/laporan?status=SUBMITTED">Buka antrean verifikasi</Link>
    </section>
    <section className="adm-section" aria-labelledby="adm-recent">
      <h2 className="adm-section-title" id="adm-recent">Antrean terbaru</h2>
      {recentLoading ? <p className="adm-note">Memuat laporan terbaru…</p> : recent.length ? <ReportTable rows={recent} caption="Empat laporan terbaru yang masuk"/> : <p className="adm-note">Belum ada laporan.</p>}
    </section>
    <section className="adm-section" aria-labelledby="adm-summary">
      <h2 className="adm-section-title" id="adm-summary">Seluruh laporan: {stats?.total ?? 0}</h2>
      <div className="adm-metrics">{metrics.map((metric) => <article className="adm-metric" key={metric.label}><span className="adm-metric-label">{metric.label}</span><strong className="adm-metric-value">{metric.value}</strong><span className="adm-metric-note">Data platform</span></article>)}</div>
      <p className="adm-note">Publik: {publicTotal} = {counts.VERIFIED} terverifikasi + {counts.IN_PROGRESS} ditindaklanjuti + {counts.RESOLVED} selesai + {counts.DUPLICATE} duplikat. Data platform.</p>
    </section>
  </AdminShell>
}

/* ------------------------------------------------------------- report queue */

export function AdminQueue() {
  useAdminTitle('Manajemen Laporan')
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const statusFilter: Status | 'ALL' = STATUSES.includes(statusParam as Status) ? (statusParam as Status) : 'ALL'
  const categoryFilter = params.get('kategori') ?? 'ALL'
  const requestedPage = Number.parseInt(params.get('halaman') ?? '1', 10) || 1
  const [draftStatus, setDraftStatus] = useState<Status | 'ALL'>(statusFilter)
  const [draftCategory, setDraftCategory] = useState(categoryFilter)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  const loadCategories = useCallback(() => getAdminCategories(), [])
  const { data: categories } = useAsync(loadCategories, [])
  const loadReports = useCallback(
    () => getAdminReports({ status: statusFilter === 'ALL' ? '' : statusFilter, category: categoryFilter === 'ALL' ? '' : categoryFilter, page: requestedPage, limit: PAGE_SIZE }),
    [statusFilter, categoryFilter, requestedPage],
  )
  const { data, error, loading } = useAsync(loadReports, [statusFilter, categoryFilter, requestedPage])

  useEffect(() => { setDraftStatus(statusFilter); setDraftCategory(categoryFilter) }, [statusFilter, categoryFilter])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(timer)
  }, [toast])

  const total = data?.meta.total ?? 0
  const limit = data?.meta.limit ?? PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, limit)))
  const currentPage = Math.min(Math.max(1, data?.meta.page ?? requestedPage), pageCount)
  const rows = (data?.data ?? []).map((dto) => mapDetailReport(dto))
  const firstIndex = (currentPage - 1) * limit
  const showingFrom = total ? firstIndex + 1 : 0
  const showingTo = Math.min(firstIndex + limit, total)

  useEffect(() => {
    if (!data) return
    const rawPage = params.get('halaman')
    const canonicalPage = currentPage === 1 ? null : String(currentPage)
    if (rawPage === canonicalPage) return
    const next = new URLSearchParams(params)
    if (canonicalPage === null) next.delete('halaman')
    else next.set('halaman', canonicalPage)
    setParams(next, { replace: true })
  }, [params, currentPage, setParams, data])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (draftStatus !== 'ALL') next.set('status', draftStatus)
    if (draftCategory !== 'ALL') next.set('kategori', draftCategory)
    setParams(next)
  }

  function resetFilters() { setParams(new URLSearchParams()) }

  function goToPage(page: number) {
    const next = new URLSearchParams(params)
    if (page > 1) next.set('halaman', String(page))
    else next.delete('halaman')
    setParams(next)
  }

  async function handleExport() {
    setExporting(true)
    setToast('')
    try {
      await exportAdminReports({ status: statusFilter === 'ALL' ? '' : statusFilter, category: categoryFilter === 'ALL' ? '' : categoryFilter })
      setToastError(false)
      setToast('Ekspor CSV berhasil diunduh.')
    } catch (reason) {
      setToastError(true)
      setToast(errorMessage(reason))
    } finally {
      setExporting(false)
    }
  }

  const pages: Array<number | 'gap'> = []
  if (pageCount <= 7) {
    for (let page = 1; page <= pageCount; page += 1) pages.push(page)
  } else {
    const visible = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1])
    const sorted = [...visible].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b)
    sorted.forEach((page, index) => {
      if (index > 0 && page - sorted[index - 1] > 1) pages.push('gap')
      pages.push(page)
    })
  }

  const categoryOptions: Array<{ value: string; label: string }> = [{ value: 'ALL', label: 'Semua kategori' }, ...((categories ?? []) as AdminCategoryDto[]).map((category) => ({ value: category.slug, label: category.name }))]

  return <AdminShell crumb="Manajemen Laporan">
    <header className="adm-head"><h1>Manajemen Laporan</h1><p>{total} laporan sesuai filter · Data platform</p></header>
    <form className="adm-filter-card" onSubmit={applyFilters}>
      <div className="adm-field"><span id="adm-status-label">Status</span><Dropdown label="Status" labelledBy="adm-status-label" value={draftStatus} onChange={(value) => setDraftStatus(value as Status | 'ALL')} options={[{ value: 'ALL', label: 'Semua status' }, ...STATUSES.map((status) => ({ value: status, label: adminStatus[status].label }))]}/></div>
      <div className="adm-field"><span id="adm-category-label">Kategori</span><Dropdown label="Kategori" labelledBy="adm-category-label" value={draftCategory} onChange={setDraftCategory} options={categoryOptions}/></div>
      <button type="submit" className="adm-btn">Terapkan filter</button>
      <button type="button" className="adm-btn adm-btn-outline" onClick={handleExport} disabled={exporting}><Download size={16} aria-hidden="true"/>{exporting ? 'Mengekspor…' : 'Ekspor CSV'}</button>
    </form>
    <section className="adm-section" aria-label="Daftar laporan">
      {error ? <ErrorState message={errorMessage(error)}/> : loading ? <p className="adm-note">Memuat laporan…</p> : rows.length ? <>
        <ReportTable rows={rows} caption="Daftar laporan pada halaman ini"/>
        <nav className="adm-pagination" aria-label="Navigasi halaman laporan">
          <p className="adm-count">Menampilkan {showingFrom}–{showingTo} dari {total} laporan</p>
          <div className="adm-page-nav">
            <button type="button" className="adm-page-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Halaman sebelumnya"><ArrowLeft size={16} aria-hidden="true"/></button>
            {pages.map((page, index) => page === 'gap'
              ? <span className="adm-gap" key={`gap-${index}`} aria-hidden="true">…</span>
              : <button type="button" key={page} className="adm-page-btn" aria-current={page === currentPage ? 'page' : undefined} aria-label={`Halaman ${page}`} onClick={() => goToPage(page)}>{page}</button>)}
            <button type="button" className="adm-page-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Halaman berikutnya"><ArrowRight size={16} aria-hidden="true"/></button>
          </div>
        </nav>
        <p className="adm-note">Aksi pada tiap laporan membuka peninjauan sesuai status terakhir. Tidak ada pembuatan laporan dari ruang Admin.</p>
      </> : <>
        <div className="adm-empty"><SearchX size={32} aria-hidden="true"/><h2>Tidak ada laporan</h2><p>Tidak ada hasil untuk filter ini. Coba pilih status atau kategori lain.</p><button type="button" className="adm-btn adm-btn-outline" onClick={resetFilters}>Reset filter</button></div>
        <Link className="adm-btn adm-btn-outline" to="/admin">Lihat semua laporan</Link>
      </>}
    </section>
    {toast ? <div className={`adm-toast${toastError ? ' adm-toast-error' : ''}`} role={toastError ? 'alert' : 'status'} aria-live={toastError ? 'assertive' : 'polite'}>{toastError ? <CircleAlert size={18} aria-hidden="true"/> : <CheckCircle2 size={18} aria-hidden="true"/>}<span>{toast}</span></div> : null}
  </AdminShell>
}

/* ------------------------------------------------------------- review detail */

type ActionKind = 'verify' | 'reject' | 'start' | 'resolve' | 'reopen' | 'reopenResolved' | 'duplicate'

const actionCopy: Record<ActionKind, {
  title: string
  intro: string
  submit: string
  success: string
  next: Status
  fieldLabel?: string
  fieldHint?: string
  fieldPlaceholder?: string
  minLength?: number
  confirm?: string
}> = {
  verify: {
    title: 'Verifikasi laporan ini?',
    intro: 'Setelah diverifikasi, laporan tampil di halaman publik dan dapat ditindaklanjuti. Pastikan bukti, kategori, dan lokasi sudah sesuai.',
    submit: 'Verifikasi laporan',
    success: 'Laporan diverifikasi dan kini tampil di halaman publik.',
    next: 'VERIFIED',
    confirm: 'Saya sudah memeriksa bukti, kategori, dan lokasi laporan ini.',
  },
  reject: {
    title: 'Tolak laporan',
    intro: 'Alasan penolakan terlihat oleh pelapor, bukan publik. Status berubah menjadi ditolak dan laporan dapat diajukan ulang.',
    submit: 'Tolak laporan',
    success: 'Laporan ditolak dan alasannya tercatat pada riwayat.',
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
    next: 'IN_PROGRESS',
    fieldLabel: 'Rencana tindakan',
    fieldHint: 'Sebutkan tindakan pertama yang akan dilakukan.',
    fieldPlaceholder: 'Contoh: pemeriksaan kondisi jalan dijadwalkan minggu ini.',
    minLength: 10,
  },
  resolve: {
    title: 'Catat penyelesaian',
    intro: 'Penyelesaian memerlukan catatan hasil dan bukti foto. Bila bukti visual tidak memungkinkan, tulis penjelasan minimal 30 karakter.',
    submit: 'Catat penyelesaian',
    success: 'Penyelesaian dicatat. Riwayat laporan tetap utuh dan dapat ditelusuri.',
    next: 'RESOLVED',
    fieldLabel: 'Catatan hasil',
    fieldHint: 'Ringkas hasil penanganan yang dilakukan.',
    fieldPlaceholder: 'Contoh: lubang ditambal dan permukaan aspal dirapikan.',
    minLength: 10,
  },
  reopen: {
    title: 'Kembalikan ke antrean',
    intro: 'Laporan yang ditolak dapat dikembalikan ke antrean verifikasi. Sertakan alasan agar perubahan ini dapat ditelusuri.',
    submit: 'Kembalikan ke antrean',
    success: 'Laporan kembali ke antrean verifikasi.',
    next: 'SUBMITTED',
    fieldLabel: 'Alasan pengembalian',
    fieldHint: 'Jelaskan mengapa laporan perlu ditinjau ulang.',
    fieldPlaceholder: 'Contoh: pelapor mengirim foto tambahan yang memperjelas kondisi.',
    minLength: 10,
  },
  reopenResolved: {
    title: 'Buka kembali laporan ini?',
    intro: 'Laporan yang sudah selesai dapat dibuka kembali bila masalah muncul lagi atau penyelesaian belum tuntas. Status akan kembali ke “Dalam tindak lanjut”.',
    submit: 'Buka kembali laporan',
    success: 'Laporan dibuka kembali dan statusnya kembali ke tindak lanjut.',
    next: 'IN_PROGRESS',
    fieldLabel: 'Alasan pembukaan kembali',
    fieldHint: 'Jelaskan mengapa penyelesaian perlu ditinjau ulang.',
    fieldPlaceholder: 'Contoh: warga melaporkan masalah yang sama muncul kembali setelah dua minggu.',
    minLength: 10,
  },
  duplicate: {
    title: 'Tandai sebagai duplikat',
    intro: 'Pilih laporan utama yang sudah tercatat. Laporan ini tetap dapat dibaca publik dengan tautan menuju laporan utama.',
    submit: 'Tandai duplikat',
    success: 'Laporan ditandai duplikat dan terhubung ke laporan utama.',
    next: 'DUPLICATE',
  },
}

const actionMeta: Record<ActionKind, { label: string; icon: ReactNode }> = {
  verify: { label: 'Verifikasi laporan', icon: <CheckCircle2 size={17} aria-hidden="true"/> },
  reject: { label: 'Tolak laporan', icon: <CircleAlert size={17} aria-hidden="true"/> },
  start: { label: 'Mulai tindak lanjut', icon: <Wrench size={17} aria-hidden="true"/> },
  resolve: { label: 'Catat penyelesaian', icon: <CheckCircle2 size={17} aria-hidden="true"/> },
  reopen: { label: 'Kembalikan ke antrean', icon: <RotateCcw size={17} aria-hidden="true"/> },
  reopenResolved: { label: 'Buka kembali laporan', icon: <RotateCcw size={17} aria-hidden="true"/> },
  duplicate: { label: 'Tandai sebagai duplikat', icon: <Copy size={17} aria-hidden="true"/> },
}

const availableActions: Record<Status, ActionKind[]> = {
  SUBMITTED: ['verify', 'duplicate', 'reject'],
  VERIFIED: ['start', 'duplicate', 'reject'],
  IN_PROGRESS: ['resolve'],
  RESOLVED: ['reopenResolved'],
  REJECTED: ['reopen'],
  DUPLICATE: [],
}

const readonlyCopy: Partial<Record<Status, string>> = {
  DUPLICATE: 'Laporan ini terhubung ke laporan utama. Untuk mencabut tautan duplikat, gunakan alur tindak lanjut dari laporan utama.',
}

function ActionDialog({ kind, report, candidates, onClose, onDone }: {
  kind: ActionKind
  report: AdminReport
  candidates: AdminReport[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const copy = actionCopy[kind]
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState('')
  const [primary, setPrimary] = useState('')
  const [explanation, setExplanation] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    if (kind === 'duplicate' && !primary) {
      setError('Pilih laporan utama yang menjadi acuan.')
      return
    }
    if (kind === 'resolve' && files.length === 0 && explanation.trim().length < 30) {
      setError('Sertakan foto bukti atau penjelasan minimal 30 karakter agar penyelesaian dapat ditinjau.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (kind === 'duplicate') {
        await changeReportStatus(report.code, { toStatus: 'DUPLICATE', expectedStatus: report.status, duplicateOfCode: primary, reason: value || undefined })
      } else if (kind === 'start') {
        await addFollowUp(report.code, { note: value, isResolutionNote: false })
        await changeReportStatus(report.code, { toStatus: 'IN_PROGRESS', expectedStatus: report.status, reason: value })
      } else if (kind === 'resolve') {
        await addFollowUp(report.code, { note: value, isResolutionNote: true, resolutionExplanation: explanation.trim() || undefined, photos: files })
        await changeReportStatus(report.code, { toStatus: 'RESOLVED', expectedStatus: report.status, reason: value })
      } else {
        await changeReportStatus(report.code, { toStatus: copy.next, expectedStatus: report.status, ...(copy.minLength ? { reason: value } : {}) })
      }
      onDone(copy.success)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return <dialog ref={dialogRef} className="adm-dialog" aria-labelledby="adm-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === dialogRef.current) onClose() }}>
    <div className="adm-dialog-body">
      <div className="adm-dialog-head"><div><h2 className="adm-dialog-title" id="adm-dialog-title">{copy.title}</h2><p className="adm-dialog-copy">{copy.intro}</p></div><button type="button" className="adm-icon-btn" aria-label="Tutup dialog" onClick={onClose}><X size={18} aria-hidden="true"/></button></div>
      <form onSubmit={handleSubmit} noValidate>
        {kind === 'duplicate' ? <>
          <div className="adm-dialog-field"><label htmlFor="adm-primary">Laporan utama *</label>
            <select id="adm-primary" value={primary} autoFocus onChange={(event) => { setPrimary(event.target.value); setError('') }}>
              <option value="">Pilih laporan utama</option>
              {candidates.map((candidate) => <option key={candidate.code} value={candidate.code}>{candidate.code} · {candidate.title} — {candidate.village}</option>)}
            </select>
            <span className="adm-help">Hanya laporan publik berstatus VERIFIED, IN_PROGRESS, atau RESOLVED. Kategori sama muncul lebih dulu.</span>
            {candidates.length ? null : <span className="adm-help">Belum ada laporan publik lain yang dapat dijadikan acuan.</span>}
          </div>
          <div className="adm-dialog-field"><label htmlFor="adm-note">Catatan tambahan (opsional)</label><textarea id="adm-note" value={note} placeholder="Contoh: lokasi dan objek sama dengan laporan utama, hanya berbeda pelapor." onChange={(event) => setNote(event.target.value)}/></div>
        </> : null}
        {copy.fieldLabel ? <div className="adm-dialog-field">
          <label htmlFor="adm-note">{copy.fieldLabel} *</label>
          <textarea id="adm-note" value={note} autoFocus={kind !== 'duplicate'} placeholder={copy.fieldPlaceholder} onChange={(event) => { setNote(event.target.value); setError('') }}/>
          <span className="adm-help">{copy.fieldHint}</span>
          <span className="adm-help">{valueLength(note)} karakter · minimal {copy.minLength}</span>
        </div> : null}
        {kind === 'resolve' ? <>
          <div className="adm-dialog-field"><label htmlFor="adm-proof">Foto bukti penyelesaian (maksimal 3)</label><input id="adm-proof" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 3))}/>{files.length ? <span className="adm-help">{files.length} foto dipilih.</span> : null}</div>
          <div className="adm-dialog-field"><label htmlFor="adm-explanation">Penjelasan tanpa foto</label><textarea id="adm-explanation" value={explanation} disabled={files.length > 0} placeholder="Isi hanya bila bukti visual tidak memungkinkan, misalnya area tertutup atau berbahaya untuk difoto." onChange={(event) => { setExplanation(event.target.value); setError('') }}/><span className="adm-help">{files.length ? 'Tidak diperlukan karena foto bukti sudah dilampirkan.' : `${explanation.trim().length} karakter · minimal 30 bila tanpa foto`}</span></div>
        </> : null}
        {copy.confirm ? <label className="adm-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/><span>{copy.confirm}</span></label> : null}
        {error ? <p className="adm-error" role="alert"><CircleAlert size={16} aria-hidden="true"/><span>{error}</span></p> : null}
        <div className="adm-dialog-actions"><button type="button" className="adm-btn adm-btn-outline" onClick={onClose} disabled={busy}>Batal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Memproses…' : copy.submit}</button></div>
      </form>
    </div>
  </dialog>
}

function valueLength(value: string) { return value.trim().length }

function Gallery({ report }: { report: AdminReport }) {
  const date = formatSubmitted(report.submittedAt)
  return <section className="adm-gallery" aria-label="Galeri bukti">
    {report.photoUrls?.[0] ? <img className="adm-gallery-main" src={mediaSrc(report.photoUrls[0])} alt={`Foto kondisi awal laporan ${report.code}`}/> : <div className="adm-gallery-main adm-gallery-empty"><CategoryIcon category={report.categorySlug} size={40}/></div>}
    {report.photoUrls && report.photoUrls.length > 1 ? <div className="adm-gallery-thumbs">{report.photoUrls.slice(1, 3).map((url, index) => <img key={`${url}-${index}`} src={mediaSrc(url)} alt="" aria-hidden="true"/>)}</div> : null}
    <p className="adm-gallery-caption">{report.photos} foto kondisi awal · {date}</p>
  </section>
}

export function AdminDetail() {
  useAdminTitle('Tinjau laporan')
  const { code = '' } = useParams()
  const [dialog, setDialog] = useState<ActionKind | null>(null)
  const [toast, setToast] = useState('')

  const loadDetail = useCallback(() => getAdminReport(code), [code])
  const { data, error, loading, reload } = useAsync(loadDetail, [code])
  const loadCandidates = useCallback(() => getAdminReports({ limit: 50, page: 1 }), [])
  const { data: candidatePage, reload: reloadCandidates } = useAsync(loadCandidates, [])
  const primaryCode = data?.duplicateOf?.code
  const loadPrimary = useCallback(() => primaryCode ? getAdminReport(primaryCode) : Promise.resolve(null), [primaryCode])
  const { data: primaryDto } = useAsync(loadPrimary, [primaryCode])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(timer)
  }, [toast])

  if (loading) return <Loading crumb="Tinjau laporan"/>
  if (error || !data) {
    return <AdminShell crumb="Laporan tidak ditemukan"><div className="adm-empty"><SearchX size={32} aria-hidden="true"/><h2>Laporan tidak ditemukan</h2><p>{error ? errorMessage(error) : 'Kode laporan ini tidak ada pada antrean.'}</p><Link className="adm-btn adm-btn-outline" to="/admin/laporan">Kembali ke manajemen laporan</Link></div></AdminShell>
  }

  const report = mapDetailReport(data)
  const allCandidates = (candidatePage?.data ?? []).map((dto) => mapDetailReport(dto))
  const actions = availableActions[report.status]
  const readonly = readonlyCopy[report.status]
  const primary = primaryDto ? mapDetailReport(primaryDto) : primaryReportOf([...allCandidates, report], report)
  const candidates = duplicateCandidates([...allCandidates, report], report.code)
  const last = latestNote(report)

  return <AdminShell crumb={`Review · ${report.status}`}>
    <div className="adm-detail-status"><StatusPill status={report.status}/></div>
    <p className="adm-eyebrow">{report.code}</p>
    <h1 className="adm-title">{report.title}</h1>
    <p className="adm-detail-meta">{report.category} · {report.city} / {report.district} / {report.village} · {formatSubmitted(report.submittedAt)}</p>
    {report.isHidden ? <p className="adm-note">Laporan ini disembunyikan dari publik.</p> : null}

    <section className="adm-card" aria-labelledby="adm-actions">
      <h2 className="adm-card-title" id="adm-actions">Tindakan administrator</h2>
      {actions.length ? <>
        <div className="adm-action-list">{actions.map((action, index) => <button type="button" key={action} className={action === 'reject' ? 'adm-btn adm-btn-danger' : index === 0 ? 'adm-btn' : 'adm-btn adm-btn-outline'} onClick={() => setDialog(action)}>{actionMeta[action].icon}{actionMeta[action].label}</button>)}</div>
        <p className="adm-card-note">{report.status === 'IN_PROGRESS' ? 'Penyelesaian memerlukan catatan hasil dan bukti foto, atau penjelasan minimal 30 karakter.' : report.status === 'RESOLVED' ? 'Membuka kembali laporan akan mengembalikan status ke Dalam tindak lanjut dan tercatat di riwayat.' : 'Tidak dapat langsung beralih ke Tindak lanjut selesai.'}</p>
      </> : <p className="adm-card-note">{readonly ?? 'Tidak ada tindakan yang tersedia untuk status ini.'}</p>}
    </section>

    {report.status === 'DUPLICATE' ? <section className="adm-card" aria-labelledby="adm-primary">
      <p className="adm-eyebrow">RUJUKAN DUPLIKAT</p>
      <h2 className="adm-card-title" id="adm-primary">Laporan utama</h2>
      {primary ? <><p className="adm-card-strong">{primary.code} · {primary.title}</p><p className="adm-card-note">{primary.category} · {primary.city} / {primary.district} / {primary.village} · {adminStatus[primary.status].label}</p><div className="adm-action-list"><Link className="adm-btn adm-btn-outline" to={`/admin/laporan/${primary.code}`}>Buka di ruang admin</Link><Link className="adm-btn adm-btn-outline" to={`/laporan/${primary.code}`}>Lihat halaman publik</Link></div></> : <p className="adm-card-note">Rujukan laporan utama tidak ditemukan.</p>}
    </section> : null}

    <Gallery report={report}/>

    <section className="adm-card" aria-labelledby="adm-internal"><p className="adm-eyebrow">INTERNAL · HANYA ADMIN</p><h2 className="adm-card-title" id="adm-internal">Pelapor: {report.reporter || 'Tidak tersedia'}</h2><p className="adm-card-note">Identitas pelapor tidak ditampilkan kepada publik.</p></section>

    <section className="adm-card" aria-labelledby="adm-detail-copy"><h2 className="adm-card-title" id="adm-detail-copy">Detail laporan</h2><p className="adm-prose">{report.description}</p><p className="adm-card-strong">{report.city} / {report.district} / {report.village}</p><p className="adm-card-note">Patokan: {report.landmark}</p></section>

    <section className="adm-card" aria-labelledby="adm-history"><h2 className="adm-section-title" id="adm-history">Riwayat yang dapat ditelusuri</h2><p className="adm-card-caption">Urutan kronologis · catatan ditambahkan, tidak ditimpa</p><ol className="adm-timeline">{report.history.map((entry, index) => <li key={`${entry.at}-${index}`}><span className="adm-timeline-mark" aria-hidden="true"><span className="adm-timeline-dot">{index === 0 ? <Info size={14}/> : <CheckCircle2 size={14}/>}</span></span><div className="adm-timeline-body"><span className="adm-timeline-date">{entry.at}</span><p className="adm-timeline-title">{entry.title}</p>{entry.transition ? <p className="adm-timeline-transition">{entry.transition}</p> : null}<p className="adm-timeline-note">{entry.note}</p><span className="adm-timeline-actor">Administrator platform</span></div></li>)}</ol>{last ? <p className="adm-card-note">Catatan terakhir: {last.title}.</p> : null}</section>

    <Link className="adm-btn adm-btn-outline adm-back" to="/admin/laporan">Kembali ke manajemen laporan</Link>

    {dialog ? <ActionDialog kind={dialog} report={report} candidates={candidates} onClose={() => setDialog(null)} onDone={(message) => { setDialog(null); setToast(message); reload(); reloadCandidates() }}/> : null}
    {toast ? <div className="adm-toast" role="status" aria-live="polite"><CheckCircle2 size={18} aria-hidden="true"/><span>{toast}</span></div> : null}
  </AdminShell>
}
