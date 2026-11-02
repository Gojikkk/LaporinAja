import { Check, CheckCircle2, CircleAlert, Clock3, FileCheck2, SlidersHorizontal } from 'lucide-react'

export type Status = 'SUBMITTED' | 'VERIFIED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'DUPLICATE'

/**
 * Bentuk ringkas laporan untuk kartu dan linimasa halaman warga.
 * Data aslinya ada di `shared/report-store.ts`; `toCard()` memetakannya ke sini.
 */
export type Report = { code: string; title: string; category: string; district: string; village: string; status: Status; date: string; description: string; tone: string }

export const statusInfo: Record<Status, { text: string; icon: typeof Clock3; cls: string }> = {
  SUBMITTED:{ text:'Menunggu verifikasi', icon:Clock3, cls:'submitted' }, VERIFIED:{ text:'Terverifikasi', icon:CheckCircle2, cls:'verified' }, IN_PROGRESS:{ text:'Dalam tindak lanjut', icon:SlidersHorizontal, cls:'progress' }, RESOLVED:{ text:'Selesai dicatat', icon:Check, cls:'resolved' }, REJECTED:{ text:'Ditolak', icon:CircleAlert, cls:'rejected' }, DUPLICATE:{ text:'Laporan serupa', icon:FileCheck2, cls:'duplicate' },
}

export type ReportCategory = { id: string; name: string; slug: string; icon: string; active: boolean }

export const initialCategories: ReportCategory[] = [
  { id:'cat-jalan-rusak', name:'Jalan rusak', slug:'jalan-rusak', icon:'⌁', active:true },
  { id:'cat-lampu-jalan', name:'Lampu jalan', slug:'lampu-jalan', icon:'☼', active:true },
  { id:'cat-sampah', name:'Sampah', slug:'sampah', icon:'♧', active:true },
  { id:'cat-saluran-air', name:'Saluran air', slug:'saluran-air', icon:'≈', active:true },
  { id:'cat-fasilitas-umum', name:'Fasilitas umum', slug:'fasilitas-umum', icon:'⌂', active:true },
  { id:'cat-lainnya', name:'Lainnya', slug:'lainnya', icon:'•', active:true },
]

export const categoryNames = initialCategories.map(c => c.name)
