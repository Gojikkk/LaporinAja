import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toast } from '../components/ui'
import { AuthPage } from '../features/auth'
import { Admin, AdminDetail, AdminQueue, AdminCategories } from '../features/admin'
import { Home, Reports, Detail, Statistics, About, Privacy } from '../features/public'
import { Dashboard, CreateReport, PrivateDetail } from '../features/reporter'
import { Forbidden, NotFound } from '../features/system'
import { useSession } from '../shared/session'

function RequireRole({ role, children }: { role: 'PELAPOR' | 'ADMIN'; children: ReactNode }) {
  const { user, loading } = useSession()
  const location = useLocation()
  if (loading) {
    return <div className="page container"><div className="empty-state"><h2>Memuat sesi…</h2><p>Menghubungkan ke layanan LaporinAja.</p></div></div>
  }
  if (!user) return <Navigate to="/masuk" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to="/403" replace />
  return <>{children}</>
}

function Routed({ onToast }: { onToast: (s: string) => void }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-fade">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/laporan" element={<Reports />} />
        <Route path="/laporan/:code" element={<Detail />} />
        <Route path="/statistik" element={<Statistics />} />
        <Route path="/tentang" element={<About />} />
        <Route path="/kebijakan-privasi" element={<Privacy />} />
        <Route path="/masuk" element={<AuthPage onToast={onToast} />} />
        <Route path="/daftar" element={<AuthPage register onToast={onToast} />} />
        <Route path="/dashboard" element={<RequireRole role="PELAPOR"><Dashboard /></RequireRole>} />
        <Route path="/lapor/baru" element={<RequireRole role="PELAPOR"><CreateReport onToast={onToast} /></RequireRole>} />
        <Route path="/dashboard/laporan/:code" element={<RequireRole role="PELAPOR"><PrivateDetail /></RequireRole>} />
        <Route path="/admin" element={<RequireRole role="ADMIN"><Admin /></RequireRole>} />
        <Route path="/admin/laporan" element={<RequireRole role="ADMIN"><AdminQueue /></RequireRole>} />
        <Route path="/admin/laporan/:code" element={<RequireRole role="ADMIN"><AdminDetail /></RequireRole>} />
        <Route path="/admin/kategori" element={<RequireRole role="ADMIN"><AdminCategories /></RequireRole>} />
        <Route path="/admin/statistik" element={<RequireRole role="ADMIN"><Statistics admin /></RequireRole>} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [toast, setToast] = useState('')
  const location = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  return <>
    <Routed onToast={setToast} />
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </>
}
