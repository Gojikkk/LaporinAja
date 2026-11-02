import { useSyncExternalStore } from 'react'
import type { Report, Status } from './report-data'

/** Satu entri linimasa. Riwayat bersifat append-only, sama seperti aturan API. */
export type AdminHistoryEntry = {
  at: string
  title: string
  transition?: string
  note: string
}

export type AdminReport = {
  code: string
  title: string
  category: string
  city: string
  district: string
  village: string
  landmark: string
  status: Status
  /** Tanggal ISO agar urutan antrean tidak bergantung pada teks yang ditampilkan. */
  submittedAt: string
  reporter: string
  description: string
  photos: number
  history: AdminHistoryEntry[]
}

export const adminStatus: Record<Status, { label: string; tone: string }> = {
  SUBMITTED: { label: 'Menunggu verifikasi', tone: 'submitted' },
  VERIFIED: { label: 'Terverifikasi', tone: 'verified' },
  IN_PROGRESS: { label: 'Sedang ditindaklanjuti', tone: 'progress' },
  RESOLVED: { label: 'Tindak lanjut selesai', tone: 'resolved' },
  REJECTED: { label: 'Ditolak', tone: 'rejected' },
  DUPLICATE: { label: 'Duplikat', tone: 'duplicate' },
}

/**
 * Urutan tinjauan: laporan yang belum diverifikasi selalu lebih dulu,
 * lalu yang paling baru. DUPLICATE ditutup paling akhir.
 */
export const statusRank: Record<Status, number> = {
  SUBMITTED: 0,
  VERIFIED: 1,
  IN_PROGRESS: 2,
  REJECTED: 3,
  RESOLVED: 4,
  DUPLICATE: 5,
}

export const adminCategories = [
  'Jalan rusak',
  'Lampu jalan',
  'Sampah',
  'Saluran air',
  'Fasilitas umum',
  'Lainnya',
]

/**
 * Status yang boleh dilihat publik. Dipakai untuk catatan ringkasan, sama
 * dengan filter `publicStatuses` pada layanan statistik.
 */
export const publicStatuses: Status[] = ['VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'DUPLICATE']

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

export function formatSubmitted(iso: string) {
  return dateFormatter.format(new Date(`${iso}T00:00:00+07:00`))
}

const seededReports: AdminReport[] = [
  {
    code: 'LPR-2026-000045',
    title: 'Penutup saluran retak di Jl. Cendana',
    category: 'Saluran air',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Dago',
    landmark: 'Depan nomor 14',
    status: 'SUBMITTED',
    submittedAt: '2026-10-29',
    reporter: 'Rani',
    description:
      'Penutup saluran di depan nomor 14 retak dan salah satu sisinya turun. Lubang selebar telapak tangan bisa membuat kaki pengguna trotoar terperosok.',
    photos: 2,
    history: [
      { at: '29 Okt 2026 · 08.20 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
    ],
  },
  {
    code: 'LPR-2026-000044',
    title: 'Sampah menumpuk di dekat halte',
    category: 'Sampah',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Dago',
    landmark: 'Halte di seberang kampus',
    status: 'SUBMITTED',
    submittedAt: '2026-10-28',
    reporter: 'Bagas',
    description:
      'Tumpukan sampah rumah tangga memenuhi sisi halte sejak tiga hari terakhir. Aroma menyengat dan sebagian sampah terbawa ke jalan.',
    photos: 3,
    history: [
      { at: '28 Okt 2026 · 17.45 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Tiga foto kondisi awal diterima.' },
    ],
  },
  {
    code: 'LPR-2026-000043',
    title: 'Lampu taman padam di jalur pejalan kaki',
    category: 'Lampu jalan',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Dago',
    landmark: 'Jalur pejalan kaki sisi utara',
    status: 'SUBMITTED',
    submittedAt: '2026-10-28',
    reporter: 'Sari',
    description:
      'Dua dari empat lampu taman di jalur pejalan kaki padam. Jalur menjadi gelap setelah pukul 18.00 dan sering dipakai warga untuk berjalan pulang.',
    photos: 2,
    history: [
      { at: '28 Okt 2026 · 16.10 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
    ],
  },
  {
    code: 'LPR-2026-000042',
    title: 'Lubang besar di Jl. Melati dekat gerbang kampus',
    category: 'Jalan rusak',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Dago',
    landmark: 'Depan toko fotokopi',
    status: 'SUBMITTED',
    submittedAt: '2026-10-28',
    reporter: 'Rani',
    description:
      'Terdapat lubang besar pada badan jalan dekat gerbang kampus, tepat di depan toko fotokopi. Permukaan aspal terkelupas dan menampung air setelah hujan, sehingga pengendara roda dua sering menghindar ke lajur berlawanan.',
    photos: 2,
    history: [
      {
        at: '28 Okt 2026 · 09.12 WIB',
        title: 'Laporan dikirim',
        transition: '— → Menunggu verifikasi',
        note: 'Dua foto kondisi awal diterima. Belum tampil di publik.',
      },
    ],
  },
  {
    code: 'LPR-2026-000041',
    title: 'Drainase buntu di Jl. Sukajadi',
    category: 'Saluran air',
    city: 'Bandung',
    district: 'Sukajadi',
    village: 'Pasteur',
    landmark: 'Seberang minimarket',
    status: 'VERIFIED',
    submittedAt: '2026-10-27',
    reporter: 'Dedi',
    description:
      'Air hujan tidak mengalir karena saluran tertutup endapan. Genangan setinggi mata kaki bertahan lebih dari dua jam setelah hujan berhenti.',
    photos: 2,
    history: [
      { at: '27 Okt 2026 · 10.05 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '27 Okt 2026 · 14.30 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai. Laporan dapat dilihat publik.',
      },
    ],
  },
  {
    code: 'LPR-2026-000040',
    title: 'Tiang lampu miring di Jl. Cihampelas',
    category: 'Lampu jalan',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Cipaganti',
    landmark: 'Dekat jembatan penyeberangan',
    status: 'VERIFIED',
    submittedAt: '2026-10-27',
    reporter: 'Nia',
    description:
      'Tiang lampu berdiri miring sekitar 15 derajat dan pondasinya terlihat retak. Kabel di bagian atas ikut tertarik.',
    photos: 3,
    history: [
      { at: '27 Okt 2026 · 08.40 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Tiga foto kondisi awal diterima.' },
      {
        at: '27 Okt 2026 · 11.12 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Kondisi tiang sesuai laporan. Menunggu penjadwalan tindak lanjut.',
      },
    ],
  },
  {
    code: 'LPR-2026-000039',
    title: 'Trotoar amblas di depan pasar',
    category: 'Fasilitas umum',
    city: 'Bandung',
    district: 'Cicendo',
    village: 'Arjuna',
    landmark: 'Pintu masuk pasar sisi timur',
    status: 'REJECTED',
    submittedAt: '2026-10-27',
    reporter: 'Yusuf',
    description:
      'Sebagian trotoar amblas dan menyisakan lubang dangkal. Pengunjung pasar sering melangkah ke badan jalan untuk menghindarinya.',
    photos: 2,
    history: [
      { at: '27 Okt 2026 · 07.25 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '27 Okt 2026 · 10.40 WIB',
        title: 'Laporan ditolak',
        transition: 'Menunggu verifikasi → Ditolak',
        note: 'Lokasi pada foto tidak cocok dengan patokan yang ditulis. Pelapor dapat mengirim ulang dengan foto yang lebih jelas.',
      },
    ],
  },
  {
    code: 'LPR-2026-000038',
    title: 'Jalan berlubang dekat persimpangan',
    category: 'Jalan rusak',
    city: 'Bandung',
    district: 'Sukajadi',
    village: 'Pasteur',
    landmark: 'Simpang tiga Pasteur',
    status: 'IN_PROGRESS',
    submittedAt: '2026-10-26',
    reporter: 'Ayu',
    description:
      'Ada lubang cukup besar di sisi jalan dekat persimpangan. Pengendara perlu berhati-hati, terutama saat malam karena tidak ada penanda.',
    photos: 2,
    history: [
      { at: '26 Okt 2026 · 15.40 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '26 Okt 2026 · 16.18 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai.',
      },
      {
        at: '27 Okt 2026 · 09.30 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Pemeriksaan kondisi jalan dijadwalkan pada minggu ini.',
      },
    ],
  },
  {
    code: 'LPR-2026-000037',
    title: 'Bangku taman perlu diperbaiki',
    category: 'Fasilitas umum',
    city: 'Bandung',
    district: 'Bandung Wetan',
    village: 'Citarum',
    landmark: 'Taman sisi utara',
    status: 'DUPLICATE',
    submittedAt: '2026-10-26',
    reporter: 'Bagas',
    description:
      'Salah satu bangku taman terlihat rusak pada bagian sandaran. Ada laporan serupa yang telah dicatat sebelumnya.',
    photos: 1,
    history: [
      { at: '26 Okt 2026 · 13.02 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Satu foto kondisi awal diterima.' },
      {
        at: '26 Okt 2026 · 13.48 WIB',
        title: 'Ditandai sebagai duplikat',
        transition: '— → Duplikat',
        note: 'Merujuk pada laporan utama LPR-2026-000021 dengan lokasi dan objek yang sama.',
      },
    ],
  },
  {
    code: 'LPR-2026-000036',
    title: 'Lampu penerangan gang padam',
    category: 'Lampu jalan',
    city: 'Bandung',
    district: 'Cibeunying Kaler',
    village: 'Cigadung',
    landmark: 'Gang depan musala',
    status: 'RESOLVED',
    submittedAt: '2026-10-25',
    reporter: 'Sari',
    description:
      'Lampu penerangan di mulut gang padam sejak sepekan. Gang menjadi gelap dan sulit dilewati setelah magrib.',
    photos: 1,
    history: [
      { at: '25 Okt 2026 · 19.10 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Satu foto kondisi awal diterima.' },
      {
        at: '25 Okt 2026 · 20.02 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai.',
      },
      {
        at: '26 Okt 2026 · 08.15 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Pemeriksaan jaringan lampu dilakukan.',
      },
      {
        at: '27 Okt 2026 · 15.40 WIB',
        title: 'Tindak lanjut selesai dicatat',
        transition: 'Sedang ditindaklanjuti → Tindak lanjut selesai',
        note: 'Lampu diganti dan sudah menyala. Bukti penyelesaian dilampirkan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000035',
    title: 'Sampah menumpuk di tepi saluran',
    category: 'Sampah',
    city: 'Bandung',
    district: 'Lengkong',
    village: 'Burangrang',
    landmark: 'Tepi saluran Jl. Burangrang',
    status: 'IN_PROGRESS',
    submittedAt: '2026-10-25',
    reporter: 'Dedi',
    description:
      'Sampah menumpuk di tepi saluran dan mulai menghambat aliran air. Sebagian sampah sudah masuk ke dalam saluran.',
    photos: 2,
    history: [
      { at: '25 Okt 2026 · 11.20 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '25 Okt 2026 · 13.05 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai.',
      },
      {
        at: '26 Okt 2026 · 09.00 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Pengangkutan sampah dijadwalkan bersama petugas kebersihan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000034',
    title: 'Saluran air tersumbat setelah hujan',
    category: 'Saluran air',
    city: 'Bandung',
    district: 'Cicendo',
    village: 'Arjuna',
    landmark: 'Depan sekolah dasar',
    status: 'IN_PROGRESS',
    submittedAt: '2026-10-24',
    reporter: 'Yusuf',
    description:
      'Aliran air tersumbat daun dan sampah setelah hujan deras. Air sempat naik ke halaman rumah warga di sisi jalan.',
    photos: 2,
    history: [
      { at: '24 Okt 2026 · 18.35 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '25 Okt 2026 · 09.12 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai.',
      },
      {
        at: '26 Okt 2026 · 10.40 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Pembersihan saluran dijadwalkan pada akhir pekan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000033',
    title: 'Lampu jalan padam di Jl. Siliwangi',
    category: 'Lampu jalan',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Dago',
    landmark: 'Depan gedung serbaguna',
    status: 'VERIFIED',
    submittedAt: '2026-10-26',
    reporter: 'Ayu',
    description:
      'Tiga lampu jalan padam berurutan sehingga ruas jalan gelap sepanjang kurang lebih 100 meter.',
    photos: 2,
    history: [
      { at: '26 Okt 2026 · 20.15 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '27 Okt 2026 · 08.05 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Titik lampu sudah dicatat untuk pemeriksaan jaringan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000032',
    title: 'Aspal mengelupas di Jl. Melati dekat gerbang kampus',
    category: 'Jalan rusak',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Dago',
    landmark: 'Depan gerbang kampus',
    status: 'VERIFIED',
    submittedAt: '2026-10-26',
    reporter: 'Nia',
    description:
      'Lapisan aspal mengelupas di badan jalan dan membentuk pecahan tajam. Pengendara sepeda melaporkan ban tergores di lokasi ini.',
    photos: 2,
    history: [
      { at: '26 Okt 2026 · 07.50 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '26 Okt 2026 · 11.30 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai. Laporan dapat dilihat publik.',
      },
    ],
  },
  {
    code: 'LPR-2026-000031',
    title: 'Kerusakan bangku fasilitas umum',
    category: 'Fasilitas umum',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Dago',
    landmark: 'Area taman umum',
    status: 'REJECTED',
    submittedAt: '2026-10-26',
    reporter: 'Rani',
    description:
      'Bangku pada fasilitas umum terlihat rusak. Foto yang dilampirkan belum cukup jelas menunjukkan kondisi objek yang dilaporkan.',
    photos: 2,
    history: [
      { at: '26 Okt 2026 · 09.12 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '26 Okt 2026 · 10.30 WIB',
        title: 'Laporan ditolak',
        transition: 'Menunggu verifikasi → Ditolak',
        note: 'Foto belum menunjukkan kerusakan fasilitas publik yang dilaporkan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000030',
    title: 'Lampu hias taman mati sejak sepekan',
    category: 'Lampu jalan',
    city: 'Bandung',
    district: 'Cibeunying Kidul',
    village: 'Cikutra',
    landmark: 'Taman sisi timur',
    status: 'IN_PROGRESS',
    submittedAt: '2026-10-23',
    reporter: 'Bagas',
    description:
      'Empat lampu hias di taman sisi timur tidak menyala sejak sepekan terakhir. Bagian tengah taman menjadi gelap dan bangku di sekitarnya tidak lagi dipakai warga.',
    photos: 2,
    history: [
      { at: '23 Okt 2026 · 18.20 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '24 Okt 2026 · 08.10 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Titik lampu sesuai dengan laporan.',
      },
      {
        at: '25 Okt 2026 · 09.05 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Pemeriksaan jalur listrik taman dijadwalkan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000029',
    title: 'Genangan di depan pertokoan',
    category: 'Saluran air',
    city: 'Bandung',
    district: 'Lengkong',
    village: 'Burangrang',
    landmark: 'Depan deretan pertokoan',
    status: 'RESOLVED',
    submittedAt: '2026-10-23',
    reporter: 'Ayu',
    description:
      'Saluran di depan pertokoan tersumbat sehingga air hujan menggenang setinggi mata kaki dan masuk ke teras toko.',
    photos: 2,
    history: [
      { at: '23 Okt 2026 · 11.15 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '23 Okt 2026 · 15.40 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai.',
      },
      {
        at: '24 Okt 2026 · 08.30 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Pembersihan saluran dijadwalkan pagi ini.',
      },
      {
        at: '24 Okt 2026 · 14.20 WIB',
        title: 'Tindak lanjut selesai dicatat',
        transition: 'Sedang ditindaklanjuti → Tindak lanjut selesai',
        note: 'Saluran dibersihkan dan air kembali mengalir. Bukti penyelesaian dilampirkan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000028',
    title: 'Sampah pasar menumpuk di bahu jalan',
    category: 'Sampah',
    city: 'Bandung',
    district: 'Cicendo',
    village: 'Arjuna',
    landmark: 'Bahu jalan sisi pasar',
    status: 'RESOLVED',
    submittedAt: '2026-10-22',
    reporter: 'Sari',
    description:
      'Sampah pasar menumpuk di bahu jalan dan menutup sebagian jalur pejalan kaki. Tumpukan mulai berbau pada siang hari.',
    photos: 3,
    history: [
      { at: '22 Okt 2026 · 13.05 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Tiga foto kondisi awal diterima.' },
      {
        at: '22 Okt 2026 · 16.12 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai.',
      },
      {
        at: '23 Okt 2026 · 07.45 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Pengangkutan sampah dijadwalkan bersama petugas pasar.',
      },
      {
        at: '23 Okt 2026 · 11.30 WIB',
        title: 'Tindak lanjut selesai dicatat',
        transition: 'Sedang ditindaklanjuti → Tindak lanjut selesai',
        note: 'Sampah diangkut dan bahu jalan dibersihkan. Bukti penyelesaian dilampirkan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000027',
    title: 'Pagar taman miring ke jalur pejalan kaki',
    category: 'Fasilitas umum',
    city: 'Bandung',
    district: 'Bandung Wetan',
    village: 'Citarum',
    landmark: 'Pagar sisi selatan taman',
    status: 'RESOLVED',
    submittedAt: '2026-10-22',
    reporter: 'Nia',
    description:
      'Pagar taman miring ke arah jalur pejalan kaki setelah tertabrak. Ujung pagar berada setinggi pinggang dan membahayakan pengguna jalur.',
    photos: 2,
    history: [
      { at: '22 Okt 2026 · 08.15 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '22 Okt 2026 · 10.50 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Kondisi pagar sesuai laporan.',
      },
      {
        at: '23 Okt 2026 · 09.10 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Perbaikan pagar dijadwalkan.',
      },
      {
        at: '24 Okt 2026 · 15.05 WIB',
        title: 'Tindak lanjut selesai dicatat',
        transition: 'Sedang ditindaklanjuti → Tindak lanjut selesai',
        note: 'Pagar dikembalikan ke posisi tegak dan pondasinya diperkuat. Bukti penyelesaian dilampirkan.',
      },
    ],
  },
  {
    code: 'LPR-2026-000026',
    title: 'Jalan retak memanjang di Jl. Cihampelas',
    category: 'Jalan rusak',
    city: 'Bandung',
    district: 'Coblong',
    village: 'Cipaganti',
    landmark: 'Depan pertokoan Cihampelas',
    status: 'RESOLVED',
    submittedAt: '2026-10-21',
    reporter: 'Dedi',
    description:
      'Retakan memanjang sepanjang kurang lebih lima meter di badan jalan. Bagian tepi retakan mulai terangkat dan lepas.',
    photos: 2,
    history: [
      { at: '21 Okt 2026 · 16.40 WIB', title: 'Laporan dikirim', transition: '— → Menunggu verifikasi', note: 'Dua foto kondisi awal diterima.' },
      {
        at: '22 Okt 2026 · 08.05 WIB',
        title: 'Laporan diverifikasi',
        transition: 'Menunggu verifikasi → Terverifikasi',
        note: 'Lokasi dan kategori sesuai.',
      },
      {
        at: '22 Okt 2026 · 13.30 WIB',
        title: 'Tindak lanjut dimulai',
        transition: 'Terverifikasi → Sedang ditindaklanjuti',
        note: 'Perbaikan permukaan jalan dijadwalkan.',
      },
      {
        at: '24 Okt 2026 · 10.15 WIB',
        title: 'Tindak lanjut selesai dicatat',
        transition: 'Sedang ditindaklanjuti → Tindak lanjut selesai',
        note: 'Retakan ditambal dan permukaan diratakan. Bukti penyelesaian dilampirkan.',
      },
    ],
  },
]

/* ------------------------------------------------------------------------- */
/* Penyimpanan demo                                                          */
/* Satu sumber data untuk dashboard, antrean, dan halaman tinjau supaya      */
/* perubahan status langsung terlihat di seluruh ruang kerja.                */
/* Ketika API siap, ganti isi `transitionReport` dengan pemanggilan api().    */
/* ------------------------------------------------------------------------- */

const listeners = new Set<() => void>()
let reports: AdminReport[] = seededReports

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return reports
}

export function useReports() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Nama lama agar layar admin tidak perlu diubah. */
export const useAdminReports = useReports

/** Urutan antrean: belum diverifikasi lebih dulu, lalu tanggal terbaru. */
export function prioritize(rows: AdminReport[]) {
  return [...rows].sort(
    (a, b) => statusRank[a.status] - statusRank[b.status] || b.submittedAt.localeCompare(a.submittedAt),
  )
}

function jakartaNow() {
  const parts = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('day')} ${value('month')} ${value('year')} · ${value('hour')}.${value('minute')} WIB`
}

export function transitionReport(
  code: string,
  to: Status,
  entry: { title: string; note: string; transition?: string },
) {
  reports = reports.map((report) => {
    if (report.code !== code) return report
    return {
      ...report,
      status: to,
      history: [
        ...report.history,
        {
          at: jakartaNow(),
          title: entry.title,
          transition: entry.transition,
          note: entry.note,
        },
      ],
    }
  })
  emit()
}

export function countByStatus(rows: AdminReport[]) {
  const counts: Record<Status, number> = {
    SUBMITTED: 0,
    VERIFIED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    REJECTED: 0,
    DUPLICATE: 0,
  }
  for (const row of rows) counts[row.status] += 1
  return counts
}

/* ------------------------------------------------------------------------- */
/* Tampilan publik dan pelapor                                               */
/* Memakai sumber yang sama dengan ruang kerja admin supaya hasil moderasi    */
/* langsung terlihat di halaman warga.                                       */
/* ------------------------------------------------------------------------- */

const categoryTone: Record<string, string> = {
  'Jalan rusak': 'blue',
  'Lampu jalan': 'amber',
  Sampah: 'green',
  'Saluran air': 'teal',
  'Fasilitas umum': 'purple',
  Lainnya: 'amber',
}

/** Status yang boleh tampil di halaman publik. */
export function isPublicReport(report: AdminReport) {
  return publicStatuses.includes(report.status)
}

/** Laporan yang sudah ditinjau, diurutkan seperti antrean admin. */
export function publicReports(rows: AdminReport[]) {
  return prioritize(rows.filter(isPublicReport))
}

/** Bentuk ringkas yang dipakai kartu laporan dan linimasa publik. */
export function toCard(report: AdminReport): Report {
  const tone = categoryTone[report.category] ?? 'amber'
  return {
    code: report.code,
    title: report.title,
    category: report.category,
    district: report.district,
    village: report.village,
    status: report.status,
    date: formatSubmitted(report.submittedAt),
    description: report.description,
    tone,
  }
}

/** Catatan terbaru dari administrator, dipakai kartu tindak lanjut. */
export function latestNote(report: AdminReport) {
  return report.history[report.history.length - 1]
}

