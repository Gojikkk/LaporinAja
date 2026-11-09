import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileCheck2, FilePlus2, Info, MapPin, MessageSquareText, Search, SlidersHorizontal } from 'lucide-react'
import { AppShell, Button, CategoryIcon, PageIntro, PrimaryReportCard, StatCard, StatusBadge, Timeline, TextField } from '../../components/ui'
import { ApiError, mediaSrc } from '../../shared/api/client'
import { createReport, getCategories, getMyReport, getMyReports, getPublicReport } from '../../shared/api/endpoints'
import { useSession } from '../../shared/session'
import { useAsync } from '../../shared/useAsync'
import { countByStatus, latestNote, mapDetailReport, mapListReport, toCard } from '../../shared/report-store'

function Loading({ label }: { label: string }) {
  return <AppShell mode="reporter"><main className="page container"><div className="empty-state"><Clock3 size={25}/><h2>{label}</h2><p>Menghubungkan ke layanan LaporinAja.</p></div></main></AppShell>
}

function ErrorState({ message }: { message: string }) {
  return <div className="empty-state"><Search size={25}/><h2>Data tidak dapat dimuat</h2><p>{message}</p></div>
}

export function Dashboard() {
  const { user } = useSession()
  const load = useCallback(() => getMyReports({ limit: 3, page: 1 }), [])
  const { data, error, loading } = useAsync(load, [])
  if (loading) return <Loading label="Memuat dashboard" />

  const rows = data?.data.map(mapListReport) ?? []
  const counts = (data?.counts as Record<string, number> | undefined) ?? countByStatus(rows)
  const total = data?.meta.total ?? rows.length
  const cards = rows.map(toCard)
  const name = user?.name ?? 'Pelapor'

  return <AppShell mode="reporter"><main className="page container">
    <PageIntro title={`Halo, ${name}`} description="Pantau laporan dan lihat catatan perkembangannya di sini." action={<Button to="/lapor/baru" icon={<FilePlus2 size={17}/>}>Buat laporan</Button>}/>
    {error ? <ErrorState message={error instanceof ApiError ? error.message : 'Terjadi kendala saat memuat laporan.'}/> : <>
    <div className="stats-grid dashboard-stats">
      <StatCard label="Semua laporan" value={String(total)} detail="tercatat di akunmu" icon={<FileCheck2 size={19}/>}/>
      <StatCard label="Menunggu tinjauan" value={String(counts.SUBMITTED ?? 0)} detail="laporan baru" icon={<Clock3 size={19}/>}/>
      <StatCard label="Dalam tindak lanjut" value={String(counts.IN_PROGRESS ?? 0)} detail="sedang dipantau" icon={<SlidersHorizontal size={19}/>}/>
      <StatCard label="Selesai dicatat" value={String(counts.RESOLVED ?? 0)} detail="catatan tersedia" icon={<CheckCircle2 size={19}/>}/>
    </div>
    <section className="panel dashboard-panel">
      <div className="panel-head"><div><h2>Laporan terbarumu</h2><p>Semua perubahan status tersimpan di riwayat.</p></div><Link to="/laporan" className="text-link">Jelajahi publik <ArrowRight size={15}/></Link></div>
      <div className="my-report-list">
        {cards.length === 0 ? <p className="my-report-copy" style={{ padding: 20 }}>Belum ada laporan. Mulai dari satu laporan singkat.</p> : cards.map((r) => <Link to={`/dashboard/laporan/${r.code}`} className="my-report-row" key={r.code}><span className={`mini-art ${r.tone}`}><CategoryIcon category={r.category} size={18}/></span><span className="my-report-copy"><b>{r.title}</b><small>{r.code} <i>·</i> {r.date}</small></span><StatusBadge status={r.status}/><ArrowRight className="row-arrow" size={17}/></Link>)}
      </div>
    </section>
    <div className="dashboard-note"><Info size={17}/><span>Nama dan email akunmu tidak tampil pada halaman laporan publik.</span><Link to="/kebijakan-privasi">Pelajari privasi</Link></div>
    </>}
  </main></AppShell>
}

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
    const photo = form.get('photo')
    if (!(photo instanceof File) || !photo.size) {
      setError('Pilih minimal satu foto pendukung.')
      setBusy(false)
      return
    }
    if (photo.size > 5242880) {
      setError('Ukuran foto maksimal 5 MB.')
      setBusy(false)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
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
        photos: [photo],
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

  return <AppShell mode="reporter"><main className="page container narrow-page"><Link to="/dashboard" className="back-link"><ArrowLeft size={16}/> Kembali ke dashboard</Link><PageIntro title="Ceritakan temuanmu." description="Informasi yang jelas membantu laporan ditinjau dengan lebih mudah."/><div className="demo-banner"><Info size={18}/><span>Laporan barumu hanya dapat dilihat olehmu sampai ditinjau administrator platform.</span></div><form className="content-panel report-form" onSubmit={submit}>
    <div className="form-section-title"><span>01</span><div><h2>Jenis masalah</h2><p>Pilih kategori yang paling sesuai.</p></div></div>
    <div className="form-field"><label htmlFor="categoryId">Kategori *</label><select id="categoryId" name="categoryId" required defaultValue=""><option value="" disabled>{categoryLoading ? 'Memuat kategori…' : 'Pilih kategori laporan'}</option>{options.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{categoryError ? <small>Kategori tidak dapat dimuat. Coba muat ulang halaman.</small> : null}</div>
    <div className="form-section-title"><span>02</span><div><h2>Detail laporan</h2><p>Jelaskan apa yang kamu temukan.</p></div></div>
    <TextField label="Judul laporan" id="title" placeholder="Contoh: Lampu jalan padam dekat taman" hint="10-100 karakter"/>
    <div className="form-field"><label htmlFor="description">Deskripsi *</label><textarea id="description" name="description" required minLength={30} maxLength={1000} rows={5} placeholder="Ceritakan kondisi dan kapan kamu menemukannya."/><small>30-1.000 karakter</small></div>
    <div className="form-section-title"><span>03</span><div><h2>Wilayah</h2><p>Gunakan patokan umum, bukan alamat rumah.</p></div></div>
    <div className="form-two"><TextField label="Kota/kabupaten" id="city" placeholder="Contoh: Bandung"/><TextField label="Kecamatan" id="district" placeholder="Nama kecamatan"/></div>
    <TextField label="Kelurahan/desa" id="village" placeholder="Nama kelurahan atau desa"/>
    <TextField label="Patokan lokasi" id="locationDetail" placeholder="Contoh: depan taman lingkungan" hint="Hindari alamat rumah pribadi."/>
    <div className="form-section-title"><span>04</span><div><h2>Foto pendukung</h2><p>Unggah 1-3 foto, maksimal 5 MB per foto.</p></div></div>
    <label className="upload-field" htmlFor="photo"><FilePlus2 size={22}/><b>Pilih foto dari perangkat</b><span>JPG, PNG, atau WebP · Maksimal 5 MB</span><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required/></label>
    <div className="privacy-hint"><Info size={15}/> Hindari foto wajah, plat nomor, atau informasi pribadi.</div>
    <div className="auth-error" role="alert">{error}</div>
    <div className="form-actions"><Button to="/dashboard" variant="outline">Simpan nanti</Button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim laporan'} <ArrowRight size={16}/></button></div>
  </form></main></AppShell>
}

export function PrivateDetail() {
  const { code = '' } = useParams()
  const load = useCallback(() => getMyReport(code), [code])
  const { data, error, loading } = useAsync(load, [code])
  const primaryCode = data?.duplicateOf?.code
  const loadPrimary = useCallback(() => primaryCode ? getPublicReport(primaryCode) : Promise.resolve(null), [primaryCode])
  const { data: primaryDetail } = useAsync(loadPrimary, [primaryCode])

  if (loading) return <Loading label="Memuat laporan" />
  if (error || !data) {
    return <AppShell mode="reporter"><main className="page container"><Link to="/dashboard" className="back-link"><ArrowLeft size={16}/> Kembali ke laporan saya</Link><div className="empty-state"><Search size={25}/><h2>Laporan tidak ditemukan</h2><p>{error instanceof ApiError ? error.message : 'Laporan ini tidak ada pada akunmu.'}</p><Button to="/dashboard" variant="outline">Kembali ke dashboard</Button></div></main></AppShell>
  }

  const found = mapDetailReport(data)
  const report = toCard(found)
  const notes = found.history
  const last = latestNote(found)
  const primary = primaryDetail ? toCard(mapDetailReport(primaryDetail)) : undefined

  return <AppShell mode="reporter"><main className="page container">
    <Link to="/dashboard" className="back-link"><ArrowLeft size={16}/> Kembali ke laporan saya</Link>
    <div className="detail-heading"><div><div className="eyebrow"><span/> {report.code} · LAPORAN PRIBADI</div><h1>{report.title}</h1><div className="detail-meta"><span>{report.category}</span><span>·</span><MapPin size={14}/><span>{report.village}, {report.district}</span></div></div><StatusBadge status={report.status}/></div>
    <div className="detail-layout">
      <div className="detail-main">
        <div className={`detail-art report-art ${report.tone}`}>{report.thumbnailUrl ? <img className="report-thumb" src={mediaSrc(report.thumbnailUrl)} alt={`Foto laporan ${report.code}`} crossOrigin="use-credentials"/> : <span className="art-symbol"><CategoryIcon category={report.category} size={52}/></span>}</div>
        {report.status === 'DUPLICATE' ? <PrimaryReportCard report={report} primary={primary}/> : null}
        <section className="detail-block"><h2>Deskripsi laporan</h2><p>{report.description}</p></section>
        <section className="detail-block"><h2>{primary ? 'Catatan penggabungan' : 'Alasan atau catatan'}</h2><div className="follow-card"><span className="follow-icon"><MessageSquareText size={17}/></span><div><b>{last.title}</b><p>{last.note}</p><small>Administrator platform · {last.at}</small></div></div></section>
      </div>
      <aside className="aside-card"><div className="aside-card-head"><h2>Riwayat status</h2><span>TERCATAT</span></div><Timeline report={report} history={notes}/>{report.status !== 'SUBMITTED' && <Button to={`/laporan/${report.code}`} variant="outline" className="full-button">Lihat halaman publik</Button>}</aside>
    </div>
  </main></AppShell>
}
