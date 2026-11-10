import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Check, X } from 'lucide-react'
import { ApiError } from '../shared/api/client'
import { getNotifications, markNotificationRead } from '../shared/api/endpoints'
import type { NotificationDto } from '../shared/api/types'
import { useSession } from '../shared/session'

const formatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Notifikasi belum dapat dimuat. Periksa koneksi lalu coba lagi.'
}

export function NotificationBell({ mode = 'reporter' }: { mode?: 'reporter' | 'admin' }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationDto[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [readError, setReadError] = useState<unknown>(null)
  const [retryItem, setRetryItem] = useState<NotificationDto | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const hasLoaded = useRef(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh } = useSession()

  useEffect(() => {
    if (!open && hasLoaded.current) return
    let active = true
    setLoading(true)
    setLoadError(null)
    getNotifications()
      .then((notifications) => {
        if (!active) return
        setItems(notifications)
        hasLoaded.current = true
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, retryKey])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const close = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
    setReadError(null)
    setRetryItem(null)
  }, [location.pathname])

  const unread = items.filter((item) => !item.isRead).length

  const hrefOf = (item: NotificationDto) =>
    mode === 'admin'
      ? `/admin/laporan/${encodeURIComponent(item.reportCode)}`
      : `/dashboard/laporan/${encodeURIComponent(item.reportCode)}`

  async function openNotification(item: NotificationDto) {
    setReadError(null)
    setRetryItem(null)
    if (item.isRead) {
      setOpen(false)
      navigate(hrefOf(item))
      return
    }

    setMarkingId(item.id)
    try {
      const updated = await markNotificationRead(item.id)
      setItems((previous) => previous.map((row) => row.id === updated.id ? updated : row))
      setOpen(false)
      navigate(hrefOf(updated))
    } catch (error) {
      setReadError(error)
      setRetryItem(item)
    } finally {
      setMarkingId(null)
    }
  }

  async function resumeLogin() {
    const from = location.pathname
    await refresh()
    setOpen(false)
    navigate('/masuk', { state: { from } })
  }

  function closePanel() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button notice-button"
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        aria-controls="reporter-notifications-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} aria-hidden="true"/>
        {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div
          ref={panelRef}
          id="reporter-notifications-panel"
          className="notif-menu"
          role="dialog"
          aria-labelledby="reporter-notifications-title"
          tabIndex={-1}
        >
          <div className="notif-menu-head">
            <div>
              <b id="reporter-notifications-title">Notifikasi</b>
              <span>{unread} belum dibaca</span>
            </div>
            <button type="button" className="notif-close" aria-label="Tutup notifikasi" onClick={closePanel}>
              <X size={18}/>
            </button>
          </div>
          {loading ? (
            <p className="notif-empty" role="status">Memuat notifikasi…</p>
          ) : loadError ? (
            <div className="notif-feedback" role="alert">
              <p>{loadError instanceof ApiError && loadError.status === 401
                ? 'Sesi berakhir. Masuk kembali untuk melihat notifikasi.'
                : errorMessage(loadError)}</p>
              {loadError instanceof ApiError && loadError.status === 401
                ? <button type="button" onClick={() => void resumeLogin()}>Masuk kembali</button>
                : <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Coba lagi</button>}
            </div>
          ) : items.length === 0 ? (
            <p className="notif-empty">Belum ada notifikasi.</p>
          ) : (
            <>
              {readError && (
                <div className="notif-feedback" role="alert">
                  <p>{readError instanceof ApiError && readError.status === 401
                    ? 'Sesi berakhir. Masuk kembali untuk melanjutkan.'
                    : `Notifikasi belum ditandai dibaca. ${errorMessage(readError)}`}</p>
                  {retryItem && (readError instanceof ApiError && readError.status === 401
                    ? <button type="button" onClick={() => void resumeLogin()}>Masuk kembali</button>
                    : <button type="button" onClick={() => void openNotification(retryItem)}>Coba lagi</button>)}
                </div>
              )}
              <ul>
                {items.map((item) => (
                  <li key={item.id} className={item.isRead ? 'read' : 'unread'}>
                    <button
                      type="button"
                      aria-label={`${item.reportCode}: ${item.message}, ${formatter.format(new Date(item.createdAt))}, ${item.isRead ? 'sudah dibaca' : 'belum dibaca'}`}
                      aria-busy={markingId === item.id}
                      disabled={markingId !== null}
                      onClick={() => void openNotification(item)}
                    >
                      <span className="notif-dot" aria-hidden="true">
                        {item.isRead ? <Check size={13}/> : null}
                      </span>
                      <span>
                        <b>{item.message}</b>
                        <small>{item.reportCode} · {formatter.format(new Date(item.createdAt))} WIB</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
