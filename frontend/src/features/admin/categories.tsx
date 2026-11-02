import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, CircleAlert, CircleHelp, Pencil, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { initialCategories, type ReportCategory } from '../../shared/report-data'
import { useAdminReports } from './data'
import { AdminShell, useAdminTitle } from './shell'

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

type Draft = { name: string; slug: string; icon: string }

const emptyDraft: Draft = { name: '', slug: '', icon: '•' }

/* ------------------------------------------------------------------ dialogs */

function FormDialog({
  title,
  intro,
  submitLabel,
  draft,
  error,
  onChange,
  onSubmit,
  onClose,
}: {
  title: string
  intro: string
  submitLabel: string
  draft: Draft
  error: string
  onChange: (draft: Draft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // showModal memberi focus trap dan latar belakang inert tanpa kode tambahan.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="adm-dialog"
      aria-labelledby="adm-cat-form-title"
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
            <h2 className="adm-dialog-title" id="adm-cat-form-title">
              {title}
            </h2>
            <p className="adm-dialog-copy">{intro}</p>
          </div>
          <button type="button" className="adm-icon-btn" aria-label="Tutup dialog" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="adm-dialog-field">
            <label htmlFor="adm-cat-name">Nama kategori *</label>
            <input
              id="adm-cat-name"
              type="text"
              value={draft.name}
              autoFocus
              placeholder="Contoh: Penerangan jalan"
              onChange={(event) => onChange({ ...draft, name: event.target.value, slug: slugify(event.target.value) })}
            />
            <span className="adm-help">Nama ini yang tampil di formulir pelapor.</span>
          </div>

          <div className="adm-dialog-field">
            <label htmlFor="adm-cat-slug">Slug *</label>
            <input
              id="adm-cat-slug"
              type="text"
              value={draft.slug}
              placeholder="penerangan-jalan"
              onChange={(event) => onChange({ ...draft, slug: slugify(event.target.value) })}
            />
            <span className="adm-help">Dipakai pada tautan: /laporan?kategori={draft.slug || 'slug-kategori'}</span>
          </div>

          <div className="adm-dialog-field">
            <label htmlFor="adm-cat-icon">Ikon</label>
            <input
              id="adm-cat-icon"
              type="text"
              value={draft.icon}
              maxLength={2}
              onChange={(event) => onChange({ ...draft, icon: event.target.value })}
            />
            <span className="adm-help">Satu karakter, misalnya ⌁ atau ☼.</span>
          </div>

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
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}

function DeleteDialog({
  category,
  onCancel,
  onConfirm,
}: {
  category: ReportCategory
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="adm-dialog"
      aria-labelledby="adm-cat-delete-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onCancel()
      }}
    >
      <div className="adm-dialog-body">
        <div className="adm-dialog-head">
          <div>
            <h2 className="adm-dialog-title" id="adm-cat-delete-title">
              Hapus kategori
            </h2>
            <p className="adm-dialog-copy">
              Kategori “{category.name}” akan dihapus dari daftar. Laporan lama tetap menyimpan namanya.
            </p>
          </div>
          <button type="button" className="adm-icon-btn" aria-label="Tutup dialog" onClick={onCancel}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="adm-dialog-actions">
          <button type="button" className="adm-btn adm-btn-outline" onClick={onCancel}>
            Batal
          </button>
          <button type="button" className="adm-btn adm-btn-danger" onClick={onConfirm}>
            Hapus kategori
          </button>
        </div>
      </div>
    </dialog>
  )
}

/* --------------------------------------------------------------- kategori */

export function AdminCategories() {
  useAdminTitle('Kategori Laporan')
  const reports = useAdminReports()

  const [categories, setCategories] = useState<ReportCategory[]>(initialCategories)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editing, setEditing] = useState<ReportCategory | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<ReportCategory | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const counts = useMemo(() => {
    const total: Record<string, number> = {}
    for (const report of reports) total[report.category] = (total[report.category] ?? 0) + 1
    return total
  }, [reports])

  const activeCount = categories.filter((category) => category.active).length

  function openCreate() {
    setDraft(emptyDraft)
    setEditing(null)
    setError('')
    setFormOpen(true)
  }

  function openEdit(category: ReportCategory) {
    setDraft({ name: category.name, slug: category.slug, icon: category.icon })
    setEditing(category)
    setError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setError('')
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    const slug = draft.slug.trim() || slugify(name)

    if (!name) {
      setError('Nama kategori wajib diisi.')
      return
    }
    if (!slug) {
      setError('Slug wajib diisi.')
      return
    }
    if (categories.some((category) => category.slug === slug && category.id !== editing?.id)) {
      setError(`Slug “${slug}” sudah dipakai kategori lain.`)
      return
    }

    if (editing) {
      setCategories((previous) =>
        previous.map((category) => (category.id === editing.id ? { ...category, name, slug, icon: draft.icon } : category)),
      )
      setToast(`Kategori “${name}” diperbarui.`)
    } else {
      setCategories((previous) => [...previous, { id: `cat-${slug}`, name, slug, icon: draft.icon, active: true }])
      setToast(`Kategori “${name}” ditambahkan.`)
    }
    closeForm()
  }

  function toggleActive(id: string) {
    const target = categories.find((category) => category.id === id)
    setCategories((previous) =>
      previous.map((category) => (category.id === id ? { ...category, active: !category.active } : category)),
    )
    if (target) setToast(`Kategori “${target.name}” ${target.active ? 'dinonaktifkan' : 'diaktifkan'}.`)
  }

  function confirmDelete() {
    if (!deleting) return
    setCategories((previous) => previous.filter((category) => category.id !== deleting.id))
    setToast(`Kategori “${deleting.name}” dihapus.`)
    setDeleting(null)
  }

  return (
    <AdminShell crumb="Kategori Laporan">
      <header className="adm-head">
        <h1>Kelola kategori laporan.</h1>
        <p>{categories.length} kategori tersedia · Data demonstrasi</p>
      </header>

      <section className="adm-metrics" aria-label="Ringkasan kategori">
        <article className="adm-metric">
          <span className="adm-metric-label">Total kategori</span>
          <strong className="adm-metric-value">{categories.length}</strong>
          <span className="adm-metric-note">Data demonstrasi</span>
        </article>
        <article className="adm-metric">
          <span className="adm-metric-label">Kategori aktif</span>
          <strong className="adm-metric-value">{activeCount}</strong>
          <span className="adm-metric-note">Tampil di formulir pelapor</span>
        </article>
        <article className="adm-metric">
          <span className="adm-metric-label">Kategori nonaktif</span>
          <strong className="adm-metric-value">{categories.length - activeCount}</strong>
          <span className="adm-metric-note">Disembunyikan dari pelapor</span>
        </article>
      </section>

      <section className="adm-section" aria-labelledby="adm-cat-list">
        <div className="adm-section-head">
          <h2 className="adm-section-title" id="adm-cat-list">
            Daftar kategori
          </h2>
          <button type="button" className="adm-btn adm-btn-sm" onClick={openCreate}>
            <Plus size={18} aria-hidden="true" />
            Tambah kategori
          </button>
        </div>

        {categories.length ? (
          <div className="adm-cat-grid">
            {categories.map((category) => (
              <article className="adm-cat-card" key={category.id}>
                <div className="adm-cat-card-top">
                  <span className="adm-cat-icon" aria-hidden="true">
                    {category.icon}
                  </span>
                  <span className={category.active ? 'adm-badge tone-resolved' : 'adm-badge'}>
                    {category.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <div className="adm-cat-card-body">
                  <h3 className="adm-cat-title">{category.name}</h3>
                  <p className="adm-cat-desc">
                    {counts[category.name] ?? 0} laporan · /{category.slug}
                  </p>
                </div>

                <div className="adm-cat-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn-outline adm-btn-sm"
                    aria-label={`Kelola kategori ${category.name}`}
                    onClick={() => openEdit(category)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Kelola
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn-outline adm-btn-sm"
                    aria-pressed={category.active}
                    onClick={() => toggleActive(category.id)}
                  >
                    {category.active ? (
                      <ToggleRight size={16} aria-hidden="true" />
                    ) : (
                      <ToggleLeft size={16} aria-hidden="true" />
                    )}
                    {category.active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    className="adm-icon-btn"
                    aria-label={`Hapus kategori ${category.name}`}
                    onClick={() => setDeleting(category)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="adm-empty">
            <CircleHelp size={32} aria-hidden="true" />
            <h2>Belum ada kategori</h2>
            <p>Tambahkan kategori pertama agar pelapor dapat memilih jenis laporan.</p>
            <button type="button" className="adm-btn adm-btn-sm" onClick={openCreate}>
              <Plus size={18} aria-hidden="true" />
              Tambah kategori
            </button>
          </div>
        )}

        <p className="adm-note">
          Kategori nonaktif tidak muncul di formulir pelapor, tetapi laporan lama tetap menyimpan namanya.
        </p>
      </section>

      {formOpen ? (
        <FormDialog
          title={editing ? 'Ubah kategori' : 'Tambah kategori'}
          intro={
            editing
              ? 'Perubahan berlaku pada formulir pelapor dan filter manajemen laporan.'
              : 'Kategori baru langsung aktif setelah disimpan.'
          }
          submitLabel={editing ? 'Simpan perubahan' : 'Simpan kategori'}
          draft={draft}
          error={error}
          onChange={(next) => {
            setDraft(next)
            setError('')
          }}
          onSubmit={save}
          onClose={closeForm}
        />
      ) : null}

      {deleting ? <DeleteDialog category={deleting} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} /> : null}

      {toast ? (
        <div className="adm-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{toast}</span>
        </div>
      ) : null}
    </AdminShell>
  )
}
