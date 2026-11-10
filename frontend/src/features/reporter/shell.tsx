import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { CirclePlus, Files, LayoutDashboard, LogOut, Menu, MessageSquareText, X } from 'lucide-react'
import { NotificationBell } from '../../components/notifications'
import { useSession } from '../../shared/session'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/laporan', label: 'Laporan Saya', icon: Files, end: false },
  { to: '/lapor/baru', label: 'Buat Laporan', icon: CirclePlus, end: false },
]

const todayFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

/**
 * Kerangka halaman pelapor: header akun di atas, sidebar gelap di desktop,
 * navigasi ringkas pada layar sedang, dan laci hamburger pada ponsel.
 */
export function ReporterShell({ crumb, children }: { crumb: string; children: ReactNode }) {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)

  async function handleLogout() {
    setNavOpen(false)
    await logout()
    navigate('/masuk')
  }

  return (
    <div className="rep">
      <a className="rep-skip" href="#rep-main">
        Lewati ke konten utama
      </a>

      <header className="rep-topbar">
        <Link className="rep-brand" to="/" aria-label="LaporinAja, beranda">
          <span className="rep-brand-mark" aria-hidden="true">
            <MessageSquareText size={20} />
          </span>
          <span className="rep-brand-name">LaporinAja</span>
        </Link>
        <div className="rep-top-actions">
          <NotificationBell mode="reporter" />
          <span className="rep-account">{user?.name ?? 'Pelapor'}</span>
          <button
            type="button"
            className="rep-menu-btn"
            aria-label={navOpen ? 'Tutup navigasi' : 'Buka navigasi'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((value) => !value)}
          >
            {navOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="rep-workspace">
        <aside className="rep-sidebar" aria-label="Navigasi pelapor">
          <p className="rep-nav-label">MENU PELAPOR</p>
          <nav className="rep-nav">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="rep-nav-link">
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            <button type="button" className="rep-nav-link" onClick={handleLogout}>
              <LogOut size={20} aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </nav>
          <p className="rep-side-note">
            Nama dan kontakmu tidak ditampilkan pada halaman publik.{' '}
            <Link to="/kebijakan-privasi">Kebijakan privasi</Link>
          </p>
        </aside>

        <main className="rep-content" id="rep-main" tabIndex={-1}>
          <nav className="rep-quicknav" aria-label="Navigasi pelapor">
            {navItems.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className="rep-quicknav-link">
                {label}
              </NavLink>
            ))}
            <button type="button" className="rep-quicknav-link" onClick={handleLogout}>
              Keluar
            </button>
          </nav>

          <div className="rep-context">
            <span>Pelapor / {crumb}</span>
            <span>{todayFormatter.format(new Date())}</span>
          </div>

          {children}
        </main>
      </div>

      {navOpen ? (
        <nav className="rep-mobile-nav open" aria-label="Navigasi pelapor">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="rep-nav-link" onClick={() => setNavOpen(false)}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          <button type="button" className="rep-nav-link" onClick={handleLogout}>
            <LogOut size={20} aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </nav>
      ) : null}
    </div>
  )
}
