import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { getNotifications, markNotificationRead } from '../shared/api/endpoints'
import type { NotificationDto } from '../shared/api/types'

const formatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

export function NotificationBell({ mode = 'reporter' }: { mode?: 'reporter' | 'admin' }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationDto[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getNotifications()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const unread = items.filter((item) => !item.isRead).length

  function markRead(item: NotificationDto) {
    if (item.isRead) return
    markNotificationRead(item.id)
      .then((updated) => {
        setItems((previous) => previous.map((row) => (row.id === updated.id ? updated : row)))
      })
      .catch(() => undefined)
  }

  const hrefOf = (item: NotificationDto) =>
    mode === 'admin'
      ? `/admin/laporan/${item.reportCode}`
      : `/dashboard/laporan/${item.reportCode}`

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        type="button"
        className="icon-button notice-button"
        aria-label="Notifikasi"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unread > 0 && <i />}
      </button>
      {open && (
        <div className="notif-menu" role="menu" aria-label="Notifikasi">
          <div className="notif-menu-head">
            <b>Notifikasi</b>
            <span>{unread} belum dibaca</span>
          </div>
          {loading ? (
            <p className="notif-empty">Memuat notifikasi…</p>
          ) : items.length === 0 ? (
            <p className="notif-empty">Belum ada notifikasi.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className={item.isRead ? 'read' : 'unread'}>
                  <Link to={hrefOf(item)} onClick={() => markRead(item)}>
                    <span className="notif-dot" aria-hidden="true">
                      {item.isRead ? <Check size={13} /> : null}
                    </span>
                    <span>
                      <b>{item.message}</b>
                      <small>
                        {item.reportCode} · {formatter.format(new Date(item.createdAt))} WIB
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
