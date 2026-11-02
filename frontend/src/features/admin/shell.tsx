import { useEffect, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Files, LayoutDashboard, LogOut, MessageSquareText, Tags } from 'lucide-react'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/laporan', label: 'Manajemen Laporan', icon: Files, end: false },
  { to: '/admin/kategori', label: 'Kategori Laporan', icon: Tags, end: false },
]

/** Judul tab mengikuti halaman aktif, lalu dikembalikan saat admin ditinggalkan. */
export function useAdminTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} · LaporinAja Admin`
    return () => {
      document.title = previous
    }
  }, [title])
}

export function AdminShell({ crumb, children }: { crumb: string; children: ReactNode }) {
  return (
    <div className="adm">
      <a className="adm-skip" href="#adm-main">
        Lewati ke konten utama
      </a>

      <header className="adm-topbar">
        <Link className="adm-brand" to="/admin">
          <span className="adm-brand-mark" aria-hidden="true">
            <MessageSquareText size={21} />
          </span>
          <span className="adm-brand-name">LaporinAja</span>
        </Link>
        <span className="adm-account">Administrator platform</span>
      </header>

      <div className="adm-workspace">
        <aside className="adm-sidebar" aria-label="Navigasi administrator">
          <p className="adm-nav-label">ADMINISTRATOR</p>
          <nav className="adm-nav">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="adm-nav-link">
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            <Link className="adm-nav-link" to="/masuk">
              <LogOut size={20} aria-hidden="true" />
              <span>Logout</span>
            </Link>
          </nav>
          <Link className="adm-public-link" to="/">
            Kembali ke situs publik ↗
          </Link>
        </aside>

        <main className="adm-content" id="adm-main" tabIndex={-1}>
          <nav className="adm-quicknav" aria-label="Navigasi administrator">
            {navItems.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className="adm-quicknav-link">
                {label}
              </NavLink>
            ))}
            <Link className="adm-quicknav-link" to="/masuk">
              Logout
            </Link>
          </nav>

          <div className="adm-context">
            <span>Admin / {crumb}</span>
            <span>Data demonstrasi</span>
          </div>

          {children}
        </main>
      </div>
    </div>
  )
}
