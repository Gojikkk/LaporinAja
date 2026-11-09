import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react'
import { AppShell, TextField } from '../../components/ui'
import { ApiError } from '../../shared/api/client'
import { useSession } from '../../shared/session'

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window { google?: GoogleAccounts }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

let googleScript: Promise<void> | null = null

function loadGoogleScript() {
  if (googleScript) return googleScript
  googleScript = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Gagal memuat Google Sign-In'))
    document.head.appendChild(script)
  })
  return googleScript
}

function GoogleButton({ onCredential, onError }: { onCredential: (credential: string) => void; onError: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ref.current) return
    let active = true
    loadGoogleScript()
      .then(() => {
        if (!active || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) onCredential(response.credential)
            else onError('Token Google tidak tersedia.')
          },
        })
        window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 360, text: 'continue_with' })
      })
      .catch(() => onError('Login Google belum tersedia.'))
    return () => {
      active = false
    }
  }, [onCredential, onError])

  if (!GOOGLE_CLIENT_ID) return null
  return <div className="auth-google" ref={ref} />
}

export function AuthPage({ register = false, onToast }: { register?: boolean; onToast: (s: string) => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login, loginGoogle, register: registerAccount } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const redirectAfterAuth = (role: SessionRole) => {
    const state = location.state as { from?: string } | null
    if (role === 'ADMIN') navigate('/admin')
    else navigate(state?.from && state.from.startsWith('/dashboard') ? state.from : '/dashboard')
  }

  useEffect(() => {
    if (!user) return
    if (user.role === 'ADMIN') navigate('/admin', { replace: true })
    else navigate('/dashboard', { replace: true })
  }, [user, navigate])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      if (register) {
        await registerAccount({
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        })
        onToast('Akun berhasil dibuat. Silakan masuk.')
        navigate('/masuk')
      } else {
        const account = await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''))
        onToast('Berhasil masuk.')
        redirectAfterAuth(account.role)
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Terjadi kendala. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle(credential: string) {
    setBusy(true)
    setError('')
    try {
      const account = await loginGoogle(credential)
      onToast('Berhasil masuk dengan Google.')
      redirectAfterAuth(account.role)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Login Google gagal. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <AppShell footer={false}><main className="auth-page"><div className="auth-aside"><Link to="/" className="brand auth-brand"><span className="brand-mark"><MapPin size={18} fill="currentColor"/></span><span>Laporin<span>Aja</span><small>TRANSPARANSI BERSAMA</small></span></Link><div><div className="eyebrow"><span/> RUANG LAPORAN BERSAMA</div><h1>Perubahan kecil<br/>berawal dari <em>peduli.</em></h1><p>Pantau laporanmu, baca catatan perkembangan, dan tetap terhubung dengan sekitar.</p></div><small>Prototype kompetisi, bukan kanal resmi pemerintah.</small></div><div className="auth-main"><Link to="/" className="auth-back"><ArrowLeft size={16}/> Kembali ke beranda</Link><div className="auth-box"><div className="eyebrow"><span/> AKUN LAPORINAJA</div><h2>{register ? 'Buat akun pelapor' : 'Selamat datang kembali'}</h2><p>{register ? 'Mulai catat dan ikuti perkembangan laporanmu.' : 'Masuk untuk melihat laporan dan perkembangannya.'}</p>
    <form onSubmit={submit}>
      {register && <TextField label="Nama lengkap" id="name" placeholder="Nama yang ingin ditampilkan"/>}
      <TextField label="Alamat email" id="email" type="email" placeholder="nama@email.com"/>
      <TextField label="Password" id="password" type="password" placeholder="Minimal 8 karakter" hint={register ? 'Gunakan minimal 8 karakter.' : undefined}/>
      <div className="auth-error" role="alert">{error}</div>
      <button className="button primary auth-submit" type="submit" disabled={busy}>{busy ? 'Memproses…' : register ? 'Buat akun' : 'Masuk'} <ArrowRight size={16}/></button>
    </form>
    <GoogleButton onCredential={handleGoogle} onError={setError}/>
    <div className="auth-switch">{register ? 'Sudah punya akun?' : 'Belum punya akun?'} <Link to={register ? '/masuk' : '/daftar'}>{register ? 'Masuk' : 'Daftar'}</Link></div>
    <div className="auth-privacy"><LockKeyhole size={13}/> Sesi tersimpan sebagai cookie aman. <ShieldCheck size={13}/></div>
    {!register && <div className="demo-banner" style={{ marginTop: 18 }}><CheckCircle2 size={16}/><span>Akun demo: <b>budi@demo.test</b> / <b>Budi1234!</b> atau admin <b>admin@demo.test</b> / <b>Admin1234!</b></span></div>}
    {register && <p className="auth-privacy"><CircleAlert size={13}/> Identitas pelapor tidak ditampilkan di halaman publik.</p>}
  </div></div></main></AppShell>
}

type SessionRole = 'PELAPOR' | 'ADMIN'
