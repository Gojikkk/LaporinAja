import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, FileCheck2, FilePlus2, Filter, ImagePlus, Info, LayoutDashboard, ListFilter, LockKeyhole, LogIn, MapPin, Menu, MessageSquareText, MoreHorizontal, Search, ShieldCheck, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react'
import { AppShell, Button } from '../../components/ui'
export function Forbidden(){return <AppShell><main className="empty-state page container"><LockKeyhole size={30}/><h1>Akses tidak tersedia</h1><p>Silakan masuk dengan akun yang sesuai untuk membuka halaman ini.</p><Button to="/masuk">Kembali masuk</Button></main></AppShell>}

export function NotFound(){return <AppShell><main className="empty-state page container"><Search size={30}/><h1>Halaman tidak ditemukan</h1><p>Alamat yang kamu buka belum tersedia.</p><Button to="/">Kembali ke beranda</Button></main></AppShell>}
