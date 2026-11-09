import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react'
import { CategoryIcon } from '../../components/ui'
import { ApiError } from '../../shared/api/client'
import {
  createCategory,
  getAdminCategories,
  getPublicStats,
  updateCategory,
} from '../../shared/api/endpoints'
import type { AdminCategoryDto } from '../../shared/api/types'
import { useAsync } from '../../shared/useAsync'
import { AdminShell, useAdminTitle } from './shell'

const slugify = (value: string) => value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

type Draft = { name: string; slug: string }
const emptyDraft: Draft = { name: '', slug: '' }

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    const fields = reason.fields ? Object.values(reason.fields).join(' ') : ''
    return fields ? `${reason.message}: ${fields}` : reason.message
  }
  return reason instanceof Error ? reason.message : 'Terjadi kendala. Coba lagi.'
}

function FormDialog({ title, intro, submitLabel, draft, error, busy, onChange, onSubmit, onClose }: {
  title: string
  intro: string
  submitLabel: string
  draft: Draft
  error: string
  busy: boolean
  onChange: (draft: Draft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return <dialog ref={dialogRef} className="adm-dialog" aria-labelledby="adm-cat-form-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === dialogRef.current) onClose() }}>
    <div className="adm-dialog-body">
      <div className="adm-dialog-head"><div><h2 className="adm-dialog-title" id="adm-cat-form-title">{title}</h2><p className="adm-dialog-copy">{intro}</p></div><button type="button" className="adm-icon-btn" aria-label="Tutup dialog" onClick={onClose}><X size={18} aria-hidden="true"/></button></div>
      <form onSubmit={onSubmit} noValidate>
        <div className="adm-dialog-field"><label htmlFor="adm-cat-name">Nama kategori *</label><input id="adm-cat-name" type="text" value={draft.name} autoFocus placeholder="Contoh: Penerangan jalan" onChange={(event) => onChange({ ...draft, name: event.target.value, slug: slugify(event.target.value) })}/><span className="adm-help">Nama ini yang tampil di formulir pelapor.</span></div>
        <div className="adm-dialog-field"><label htmlFor="adm-cat-slug">Slug *</label><input id="adm-cat-slug" type="text" value={draft.slug} placeholder="penerangan-jalan" onChange={(event) => onChange({ ...draft, slug: slugify(event.target.value) })}/><span className="adm-help">Dipakai pada tautan: /laporan?kategori={draft.slug || 'slug-kategori'}</span></div>
        {error ? <p className="adm-error" role="alert"><CircleAlert size={16} aria-hidden="true"/><span>{error}</span></p> : null}
        <div className="adm-dialog-actions"><button type="button" className="adm-btn adm-btn-outline" onClick={onClose} disabled={busy}>Batal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Menyimpan…' : submitLabel}</button></div>
      </form>
    </div>
  </dialog>
}

export function AdminCategories() {
  useAdminTitle('Kategori Laporan')
  const loadCategories = useCallback(() => getAdminCategories(), [])
  const loadStats = useCallback(() => getPublicStats(), [])
  const { data, error, loading, reload } = useAsync(loadCategories, [])
  const { data: stats } = useAsync(loadStats, [])
  const categories = data ?? []

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editing, setEditing] = useState<AdminCategoryDto | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const counts = new Map((stats?.byCategory ?? []).map((row) => [row.id, row.count]))
  const activeCount = categories.filter((category) => category.isActive).length

  function openCreate() {
    setDraft(emptyDraft)
    setEditing(null)
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(category: AdminCategoryDto) {
    setDraft({ name: category.name, slug: category.slug })
    setEditing(category)
    setFormError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setFormError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    const slug = draft.slug.trim() || slugify(name)
    if (name.length < 3) {
      setFormError('Nama kategori minimal 3 karakter.')
      return
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setFormError('Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await updateCategory(editing.id, { name, slug })
        setToast(`Kategori “${name}” diperbarui.`)
      } else {
        await createCategory({ name, slug, isActive: true })
        setToast(`Kategori “${name}” ditambahkan.`)
      }
      closeForm()
      reload()
    } catch (reason) {
      setFormError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(category: AdminCategoryDto) {
    setPendingId(category.id)
    try {
      await updateCategory(category.id, { isActive: !category.isActive })
      setToast(`Kategori “${category.name}” ${category.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`)
      reload()
    } catch (reason) {
      setToast(errorMessage(reason))
    } finally {
      setPendingId(null)
    }
  }

  return <AdminShell crumb="Kategori Laporan">
    <header className="adm-head"><h1>Kelola kategori laporan.</h1><p>{categories.length} kategori terdaftar · Data platform</p></header>
    <section className="adm-metrics" aria-label="Ringkasan kategori">
      <article className="adm-metric"><span className="adm-metric-label">Total kategori</span><strong className="adm-metric-value">{categories.length}</strong><span className="adm-metric-note">Data platform</span></article>
      <article className="adm-metric"><span className="adm-metric-label">Kategori aktif</span><strong className="adm-metric-value">{activeCount}</strong><span className="adm-metric-note">Tampil di formulir pelapor</span></article>
      <article className="adm-metric"><span className="adm-metric-label">Kategori nonaktif</span><strong className="adm-metric-value">{categories.length - activeCount}</strong><span className="adm-metric-note">Disembunyikan dari pelapor</span></article>
    </section>
    <section className="adm-section" aria-labelledby="adm-cat-list">
      <div className="adm-section-head"><h2 className="adm-section-title" id="adm-cat-list">Daftar kategori</h2><button type="button" className="adm-btn adm-btn-sm" onClick={openCreate}><Plus size={18} aria-hidden="true"/>Tambah kategori</button></div>
      {loading ? <p className="adm-note">Memuat kategori…</p> : error ? <div className="adm-empty"><CircleAlert size={32} aria-hidden="true"/><h2>Kategori tidak dapat dimuat</h2><p>{errorMessage(error)}</p><button type="button" className="adm-btn adm-btn-outline" onClick={reload}>Muat ulang</button></div> : categories.length ? <div className="adm-cat-grid">
        {categories.map((category) => <article className="adm-cat-card" key={category.id}>
          <div className="adm-cat-card-top"><span className="adm-cat-icon" aria-hidden="true"><CategoryIcon category={category.slug}/></span><span className={category.isActive ? 'adm-badge tone-resolved' : 'adm-badge'}>{category.isActive ? 'Aktif' : 'Nonaktif'}</span></div>
          <div className="adm-cat-card-body"><h3 className="adm-cat-title">{category.name}</h3><p className="adm-cat-desc">{counts.get(category.id) ?? 0} laporan · /{category.slug}</p></div>
          <div className="adm-cat-actions">
            <button type="button" className="adm-btn adm-btn-outline adm-btn-sm" aria-label={`Kelola kategori ${category.name}`} onClick={() => openEdit(category)}><Pencil size={16} aria-hidden="true"/>Kelola</button>
            <button type="button" className="adm-btn adm-btn-outline adm-btn-sm" aria-pressed={category.isActive} disabled={pendingId === category.id} onClick={() => toggleActive(category)}>{category.isActive ? <ToggleRight size={16} aria-hidden="true"/> : <ToggleLeft size={16} aria-hidden="true"/>}{pendingId === category.id ? 'Menyimpan…' : category.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </div>
        </article>)}
      </div> : <div className="adm-empty"><CircleHelp size={32} aria-hidden="true"/><h2>Belum ada kategori</h2><p>Tambahkan kategori pertama agar pelapor dapat memilih jenis laporan.</p><button type="button" className="adm-btn adm-btn-sm" onClick={openCreate}><Plus size={18} aria-hidden="true"/>Tambah kategori</button></div>}
      <p className="adm-note">Kategori nonaktif tidak muncul di formulir pelapor, tetapi laporan lama tetap menyimpan namanya.</p>
    </section>
    {formOpen ? <FormDialog title={editing ? 'Ubah kategori' : 'Tambah kategori'} intro={editing ? 'Perubahan berlaku pada formulir pelapor dan filter manajemen laporan.' : 'Kategori baru langsung aktif setelah disimpan.'} submitLabel={editing ? 'Simpan perubahan' : 'Simpan kategori'} draft={draft} error={formError} busy={saving} onChange={(next) => { setDraft(next); setFormError('') }} onSubmit={save} onClose={closeForm}/> : null}
    {toast ? <div className="adm-toast" role="status" aria-live="polite"><CheckCircle2 size={18} aria-hidden="true"/><span>{toast}</span></div> : null}
  </AdminShell>
}
