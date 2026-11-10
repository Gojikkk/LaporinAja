import { useCallback, useRef, useState, type FormEvent, type InputEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileCheck2, FilePlus2, Info, LocateFixed, MapPin, MessageSquareText, Search, SlidersHorizontal } from 'lucide-react'
import { AppShell, Button, CategoryIcon, PageIntro, PrimaryReportCard, StatCard, StatusBadge, Timeline, TextField } from '../../components/ui'
import { ApiError, mediaSrc } from '../../shared/api/client'
import { createReport, getCategories, getMyReport, getMyReports, getPublicReport, reverseLookupReportLocation, searchReportLocations } from '../../shared/api/endpoints'
import type { GeocodingCandidateDto } from '../../shared/api/types'
import { useSession } from '../../shared/session'
import { useAsync } from '../../shared/useAsync'
import { countByStatus, latestNote, mapDetailReport, mapListReport, toCard } from '../../shared/report-store'
import '../../styles/reporter-location.css'

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

  return <AppShell mode="reporter"><main className="page container narrow-page"><Link to="/dashboard" className="back-link"><ArrowLeft size={16}/> Kembali ke dashboard</Link><PageIntro title="Ceritakan temuanmu." description="Informasi yang jelas membantu laporan ditinjau dengan lebih mudah."/><div className="demo-banner"><Info size={18}/><span>Laporan barumu hanya dapat dilihat olehmu sampai ditinjau administrator platform.</span></div><form ref={formRef} className="content-panel report-form" onSubmit={submit} onInput={handleLocationInput}>
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
