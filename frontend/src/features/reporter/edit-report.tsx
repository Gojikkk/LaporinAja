import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock3, FilePlus2, Info, Save, SearchX } from 'lucide-react'
import { Button, PageIntro } from '../../components/ui'
import { ApiError } from '../../shared/api/client'
import { getCategories, getMyReport, updateMyReport } from '../../shared/api/endpoints'
import { useAsync } from '../../shared/useAsync'
import { ReporterShell } from './shell'

function errorMessage(reason: unknown, fallback: string) {
  if (reason instanceof ApiError) {
    const fields = reason.fields ? Object.values(reason.fields).join(' ') : ''
    return fields ? `${reason.message}: ${fields}` : reason.message
  }
  return reason instanceof Error ? reason.message : fallback
}

export function EditReport({ onToast }: { onToast: (message: string) => void }) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(
    async () => {
      const [categories, report] = await Promise.all([getCategories(), getMyReport(code)])
      return { categories, report }
    },
    [code],
  )
  const { data, error: loadError, loading } = useAsync(load, [code])

  if (loading) {
    return (
      <ReporterShell crumb="Ubah laporan">
        <div className="rep-page">
          <div className="rep-empty">
            <Clock3 size={26} aria-hidden="true" />
            <h2>Memuat laporan</h2>
            <p>Menghubungkan ke layanan LaporinAja.</p>
          </div>
        </div>
      </ReporterShell>
    )
  }

  if (loadError || !data) {
    return (
      <ReporterShell crumb="Ubah laporan">
        <div className="rep-page">
          <div className="rep-empty">
            <SearchX size={26} aria-hidden="true" />
            <h2>Laporan tidak ditemukan</h2>
            <p>{errorMessage(loadError, 'Laporan ini tidak ada pada akunmu.')}</p>
            <Link className="rep-btn rep-btn-outline" to="/dashboard/laporan">
              Kembali ke Laporan Saya
            </Link>
          </div>
        </div>
      </ReporterShell>
    )
  }

  const { report, categories } = data
  const editable = report.status === 'SUBMITTED' || report.status === 'REJECTED'
  const detailPath = `/dashboard/laporan/${report.code}`

  if (!editable) {
    return (
      <ReporterShell crumb="Ubah laporan">
        <div className="rep-page">
          <Link className="rep-back" to={detailPath}>
            <ArrowLeft size={15} aria-hidden="true" /> Kembali ke detail laporan
          </Link>
          <div className="rep-empty">
            <Info size={28} aria-hidden="true" />
            <h2>Laporan sudah ditindaklanjuti</h2>
            <p>Laporan hanya dapat diubah selama berstatus menunggu verifikasi atau ditolak.</p>
            <Link className="rep-btn" to={detailPath}>
              Lihat detail laporan
            </Link>
          </div>
        </div>
      </ReporterShell>
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
    if (
      (parsedLatitude !== undefined && (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90)) ||
      (parsedLongitude !== undefined && (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180))
    ) {
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
      setError(`Wilayah belum lengkap. Lengkapi: ${missingLocationFields.join(', ')}.`)
      setBusy(false)
      return
    }
    const photos = form.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0)
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
      await updateMyReport(report.code, {
        categoryId,
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        city: String(form.get('city') ?? ''),
        district: String(form.get('district') ?? ''),
        village: String(form.get('village') ?? ''),
        locationDetail: String(form.get('locationDetail') ?? ''),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        photos,
      })
      onToast(`Perubahan laporan ${report.code} disimpan.`)
      navigate(detailPath)
    } catch (reason) {
      setError(errorMessage(reason, 'Perubahan belum dapat disimpan. Coba lagi.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ReporterShell crumb="Ubah laporan">
      <div className="app-theme app-public">
        <div className="page container narrow-page">
          <Link to={detailPath} className="back-link">
            <ArrowLeft size={16} /> Kembali ke detail laporan
          </Link>
          <PageIntro
            title="Perbarui laporanmu."
            description="Perbaiki informasi atau ganti foto agar laporan mudah ditindaklanjuti."
          />
          <div className="demo-banner">
            <Info size={18} />
            <span>Perubahan hanya dapat dilakukan sebelum laporan ditindaklanjuti administrator.</span>
          </div>
          <form key={report.code} className="content-panel report-form" onSubmit={submit}>
            <div className="form-section-title">
              <span>01</span>
              <div>
                <h2>Jenis masalah</h2>
                <p>Pilih kategori yang paling sesuai.</p>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="categoryId">Kategori *</label>
              <select id="categoryId" name="categoryId" required defaultValue={String(report.category.id)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
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
              <input
                id="title"
                name="title"
                required
                minLength={10}
                maxLength={100}
                defaultValue={report.title}
                placeholder="Contoh: Lampu jalan padam dekat taman"
              />
              <small>10-100 karakter</small>
            </div>
            <div className="form-field">
              <label htmlFor="description">Deskripsi *</label>
              <textarea
                id="description"
                name="description"
                required
                minLength={30}
                maxLength={1000}
                rows={5}
                defaultValue={report.description}
                placeholder="Ceritakan kondisi dan kapan kamu menemukannya."
              />
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
                <input id="city" name="city" required maxLength={100} defaultValue={report.city} placeholder="Kota/kabupaten" />
              </div>
              <div className="form-field">
                <label htmlFor="district">Kecamatan *</label>
                <input id="district" name="district" required maxLength={100} defaultValue={report.district} placeholder="Kecamatan" />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="village">Kelurahan/desa *</label>
              <input id="village" name="village" required maxLength={100} defaultValue={report.village} placeholder="Kelurahan/desa" />
            </div>
            <div className="form-field">
              <label htmlFor="locationDetail">Patokan lokasi *</label>
              <input id="locationDetail" name="locationDetail" required minLength={5} maxLength={200} defaultValue={report.locationDetail} placeholder="Patokan lokasi" />
              <small>Hindari alamat rumah pribadi.</small>
            </div>
            <div className="form-section-title">
              <span>04</span>
              <div>
                <h2>Titik lokasi (opsional)</h2>
                <p>Isi latitude dan longitude bila titik lokasi berubah.</p>
              </div>
            </div>
            <div className="form-two">
              <div className="form-field">
                <label htmlFor="latitude">Latitude</label>
                <input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  defaultValue={report.latitude ?? ''}
                  placeholder="Contoh: -6.1752"
                />
              </div>
              <div className="form-field">
                <label htmlFor="longitude">Longitude</label>
                <input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  defaultValue={report.longitude ?? ''}
                  placeholder="Contoh: 106.8271"
                />
              </div>
            </div>
            <small className="report-location-hint">Isi keduanya atau biarkan kosong. Latitude: -90 sampai 90; longitude: -180 sampai 180.</small>
            <div className="form-section-title">
              <span>05</span>
              <div>
                <h2>Foto pendukung</h2>
                <p>Unggah 1-3 foto baru untuk mengganti seluruh foto lama.</p>
              </div>
            </div>
            <label className="upload-field" htmlFor="photos">
              <FilePlus2 size={22} />
              <b>Pilih foto pengganti (opsional)</b>
              <span>Kosongkan bila foto lama masih sesuai · JPG, PNG, atau WebP · Maksimal 5 MB per foto</span>
              <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
            </label>
            <div className="privacy-hint">
              <Info size={15} /> Hindari foto wajah, plat nomor, atau informasi pribadi.
            </div>
            <div className="auth-error" role="alert">{error}</div>
            <div className="form-actions">
              <Button to={detailPath} variant="outline">Batal</Button>
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? 'Menyimpan…' : 'Simpan perubahan'} <Save size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </ReporterShell>
  )
}
