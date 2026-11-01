import argon2 from "argon2";
import { prisma } from "../src/db";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categories = [
  { name: "Jalan rusak", slug: "jalan-rusak" },
  { name: "Lampu jalan", slug: "lampu-jalan" },
  { name: "Sampah", slug: "sampah" },
  { name: "Saluran air", slug: "saluran-air" },
  { name: "Fasilitas umum", slug: "fasilitas-umum" },
  { name: "Lainnya", slug: "lainnya" },
];

// ---------------------------------------------------------------------------
// Demo users
// Passwords are intentionally simple for demo purposes only.
// Never use these credentials in a production environment.
// ---------------------------------------------------------------------------

const ADMIN_ID    = "00000000-0000-0000-0000-000000000001";
const PELAPOR1_ID = "00000000-0000-0000-0000-000000000002";
const PELAPOR2_ID = "00000000-0000-0000-0000-000000000003";

const demoUsers = [
  {
    id: ADMIN_ID,
    name: "Admin Demo",
    email: "admin@demo.test",
    password: "Admin1234!",
    role: "ADMIN" as const,
  },
  {
    id: PELAPOR1_ID,
    name: "Budi Santoso",
    email: "budi@demo.test",
    password: "Budi1234!",
    role: "PELAPOR" as const,
  },
  {
    id: PELAPOR2_ID,
    name: "Siti Rahayu",
    email: "siti@demo.test",
    password: "Siti1234!",
    role: "PELAPOR" as const,
  },
];

// ---------------------------------------------------------------------------
// Helper: reserve next public code from DB sequence
// ---------------------------------------------------------------------------

async function nextPublicCode(): Promise<string> {
  const [row] = await prisma.$queryRaw<{ value: bigint }[]>`
    SELECT nextval('report_public_code_seq') AS value
  `;
  return `LPR-${new Date().getFullYear()}-${row.value.toString().padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Demo reports  (18 total, beragam status, kategori, dan lokasi)
// ---------------------------------------------------------------------------

type DemoReport = {
  id: string;
  reporterId: string;
  categorySlug: string;
  title: string;
  description: string;
  city: string;
  district: string;
  village: string;
  locationDetail: string;
  status: "SUBMITTED" | "VERIFIED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED" | "DUPLICATE";
  submissionKey: string;
  isHidden: boolean;
  duplicateOfId?: string;
  /** status history transitions after SUBMITTED */
  transitions: Array<{
    fromStatus: string;
    toStatus: string;
    changedBy: string;
    reason?: string;
    daysAfterCreate: number;
  }>;
  followUp?: {
    note: string;
    isResolutionNote: boolean;
    resolutionExplanation?: string;
  };
  createdDaysAgo: number;
};

// ID references — defined before the array so DUPLICATE can reference LPR-001
const RPT_IDS = Array.from({ length: 18 }, (_, i) =>
  `a0000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`
);

const demoReports: DemoReport[] = [
  // --- RESOLVED (3) ---
  {
    id: RPT_IDS[0],
    reporterId: PELAPOR1_ID,
    categorySlug: "lampu-jalan",
    title: "Lampu jalan mati di depan SDN 01 Menteng",
    description:
      "Lampu penerangan jalan di depan SDN 01 Menteng sudah mati sejak seminggu lalu dan membahayakan pejalan kaki dan pengendara saat malam hari.",
    city: "Jakarta Pusat",
    district: "Menteng",
    village: "Menteng",
    locationDetail: "Depan gerbang utama SDN 01 Menteng",
    status: "RESOLVED",
    submissionKey: "sk-00000000-0000-0000-0001",
    isHidden: false,
    createdDaysAgo: 20,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED",    changedBy: ADMIN_ID, daysAfterCreate: 1 },
      { fromStatus: "VERIFIED",  toStatus: "IN_PROGRESS", changedBy: ADMIN_ID, daysAfterCreate: 3 },
      { fromStatus: "IN_PROGRESS", toStatus: "RESOLVED",  changedBy: ADMIN_ID, daysAfterCreate: 8 },
    ],
    followUp: {
      note: "Petugas PLN telah mengganti bohlam dan memperbaiki kabel yang putus.",
      isResolutionNote: true,
      resolutionExplanation:
        "Lampu telah diperbaiki pada tanggal 19 Oktober 2026. Penggantian bohlam LED 100W dilakukan oleh tim PLN Distribusi Jakarta Pusat.",
    },
  },
  {
    id: RPT_IDS[1],
    reporterId: PELAPOR2_ID,
    categorySlug: "jalan-rusak",
    title: "Aspal berlubang di Jl. Sudirman depan halte bus",
    description:
      "Terdapat lubang besar di tengah badan jalan dengan diameter sekitar 40 cm dan kedalaman 15 cm tepat di depan halte TransJakarta. Sudah menyebabkan dua motor hampir terjatuh.",
    city: "Jakarta Selatan",
    district: "Setiabudi",
    village: "Setiabudi",
    locationDetail: "Depan Halte TransJakarta Semanggi arah Sudirman",
    status: "RESOLVED",
    submissionKey: "sk-00000000-0000-0000-0002",
    isHidden: false,
    createdDaysAgo: 25,
    transitions: [
      { fromStatus: "SUBMITTED",   toStatus: "VERIFIED",    changedBy: ADMIN_ID, daysAfterCreate: 2 },
      { fromStatus: "VERIFIED",    toStatus: "IN_PROGRESS", changedBy: ADMIN_ID, daysAfterCreate: 5 },
      { fromStatus: "IN_PROGRESS", toStatus: "RESOLVED",    changedBy: ADMIN_ID, daysAfterCreate: 12 },
    ],
    followUp: {
      note: "Tim Dinas PUPR telah melakukan penambalan aspal permanen.",
      isResolutionNote: true,
      resolutionExplanation:
        "Pengaspalan ulang selesai dilakukan pada 6 Oktober 2026. Lapis permukaan hotmix telah dipadatkan dan permukaan jalan sudah rata kembali.",
    },
  },
  {
    id: RPT_IDS[2],
    reporterId: PELAPOR1_ID,
    categorySlug: "sampah",
    title: "Tumpukan sampah liar di kolong jembatan Kalimalang",
    description:
      "Ada tumpukan sampah rumah tangga dan konstruksi yang sangat besar di bawah kolong jembatan Kalimalang. Bau menyengat dan berpotensi menjadi sarang nyamuk serta banjir saat hujan.",
    city: "Jakarta Timur",
    district: "Duren Sawit",
    village: "Pondok Bambu",
    locationDetail: "Kolong Jembatan Kalimalang dekat SPBU Pondok Bambu",
    status: "RESOLVED",
    submissionKey: "sk-00000000-0000-0000-0003",
    isHidden: false,
    createdDaysAgo: 18,
    transitions: [
      { fromStatus: "SUBMITTED",   toStatus: "VERIFIED",    changedBy: ADMIN_ID, daysAfterCreate: 1 },
      { fromStatus: "VERIFIED",    toStatus: "IN_PROGRESS", changedBy: ADMIN_ID, daysAfterCreate: 4 },
      { fromStatus: "IN_PROGRESS", toStatus: "RESOLVED",    changedBy: ADMIN_ID, daysAfterCreate: 9 },
    ],
    followUp: {
      note: "Dinas Kebersihan DKI Jakarta telah mengirim 2 truk sampah untuk membersihkan lokasi.",
      isResolutionNote: true,
      resolutionExplanation:
        "Pembersihan selesai tanggal 22 Oktober 2026. Total 8 ton sampah berhasil diangkut. Pemasangan papan larangan membuang sampah juga sudah dilakukan.",
    },
  },

  // --- IN_PROGRESS (3) ---
  {
    id: RPT_IDS[3],
    reporterId: PELAPOR2_ID,
    categorySlug: "saluran-air",
    title: "Saluran drainase tersumbat di Jl. Kemang Raya",
    description:
      "Saluran air di sepanjang Jl. Kemang Raya tersumbat sampah dan lumpur. Setiap hujan deras selalu tergenang air setinggi 30–50 cm selama berjam-jam.",
    city: "Jakarta Selatan",
    district: "Mampang Prapatan",
    village: "Bangka",
    locationDetail: "Sepanjang Jl. Kemang Raya dari perempatan sampai depan Mall Kemang Village",
    status: "IN_PROGRESS",
    submissionKey: "sk-00000000-0000-0000-0004",
    isHidden: false,
    createdDaysAgo: 10,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED",    changedBy: ADMIN_ID, daysAfterCreate: 1 },
      { fromStatus: "VERIFIED",  toStatus: "IN_PROGRESS", changedBy: ADMIN_ID, daysAfterCreate: 3 },
    ],
    followUp: {
      note: "Tim Suku Dinas SDA Jakarta Selatan sedang melakukan pengerukan saluran drainase secara bertahap.",
      isResolutionNote: false,
    },
  },
  {
    id: RPT_IDS[4],
    reporterId: PELAPOR1_ID,
    categorySlug: "fasilitas-umum",
    title: "Bangku taman rusak di RPTRA Cempaka Putih",
    description:
      "Sebanyak 5 bangku taman di RPTRA Cempaka Putih kondisinya rusak parah, besi berkarat dan kayu lapuk. Sangat berbahaya untuk anak-anak yang bermain di sana.",
    city: "Jakarta Pusat",
    district: "Cempaka Putih",
    village: "Cempaka Putih Timur",
    locationDetail: "Area bermain RPTRA Cempaka Putih dekat pintu masuk utama",
    status: "IN_PROGRESS",
    submissionKey: "sk-00000000-0000-0000-0005",
    isHidden: false,
    createdDaysAgo: 8,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED",    changedBy: ADMIN_ID, daysAfterCreate: 2 },
      { fromStatus: "VERIFIED",  toStatus: "IN_PROGRESS", changedBy: ADMIN_ID, daysAfterCreate: 5 },
    ],
    followUp: {
      note: "Anggaran penggantian bangku taman sudah disetujui. Material sedang dalam proses pengadaan.",
      isResolutionNote: false,
    },
  },
  {
    id: RPT_IDS[5],
    reporterId: PELAPOR2_ID,
    categorySlug: "jalan-rusak",
    title: "Jalan berlubang parah di Gang Mawar RT 03/05",
    description:
      "Jalan gang dengan lebar 2 meter ini memiliki lebih dari 10 lubang dengan kedalaman 5–20 cm. Motor sering oleng dan pernah ada anak kecil yang terjatuh karena lubang ini.",
    city: "Jakarta Barat",
    district: "Tambora",
    village: "Kali Anyar",
    locationDetail: "Gang Mawar RT 03/05 dari depan warung Bu Ani sampai ujung gang",
    status: "IN_PROGRESS",
    submissionKey: "sk-00000000-0000-0000-0006",
    isHidden: false,
    createdDaysAgo: 7,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED",    changedBy: ADMIN_ID, daysAfterCreate: 1 },
      { fromStatus: "VERIFIED",  toStatus: "IN_PROGRESS", changedBy: ADMIN_ID, daysAfterCreate: 3 },
    ],
    followUp: {
      note: "Koordinasi dengan Dinas PUPR Jakarta Barat sedang berlangsung. Survei lapangan dijadwalkan pekan depan.",
      isResolutionNote: false,
    },
  },

  // --- VERIFIED (3) ---
  {
    id: RPT_IDS[6],
    reporterId: PELAPOR1_ID,
    categorySlug: "lampu-jalan",
    title: "Tiang lampu miring dan nyaris roboh di Jl. Proklamasi",
    description:
      "Ada tiang lampu jalan yang miring sekitar 30 derajat dan kondisinya sudah keropos di bagian bawah. Sangat berbahaya jika sampai roboh menimpa pengguna jalan.",
    city: "Jakarta Pusat",
    district: "Menteng",
    village: "Pegangsaan",
    locationDetail: "Di depan nomor 47 Jl. Proklamasi, dekat tiang listrik PLN",
    status: "VERIFIED",
    submissionKey: "sk-00000000-0000-0000-0007",
    isHidden: false,
    createdDaysAgo: 5,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED", changedBy: ADMIN_ID, daysAfterCreate: 1 },
    ],
  },
  {
    id: RPT_IDS[7],
    reporterId: PELAPOR2_ID,
    categorySlug: "saluran-air",
    title: "Gorong-gorong jebol di Jl. Fatmawati",
    description:
      "Gorong-gorong di bawah Jl. Fatmawati depan pasar jebol dan menciptakan jebakan di badan jalan. Sudah dilaporkan ke kelurahan tapi belum ada tindakan.",
    city: "Jakarta Selatan",
    district: "Cilandak",
    village: "Cilandak Barat",
    locationDetail: "Depan Pasar Fatmawati, dekat persimpangan Jl. RS Fatmawati",
    status: "VERIFIED",
    submissionKey: "sk-00000000-0000-0000-0008",
    isHidden: false,
    createdDaysAgo: 4,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED", changedBy: ADMIN_ID, daysAfterCreate: 2 },
    ],
  },
  {
    id: RPT_IDS[8],
    reporterId: PELAPOR1_ID,
    categorySlug: "fasilitas-umum",
    title: "Papan nama jalan hilang di kawasan Kebayoran Baru",
    description:
      "Beberapa papan nama jalan di kawasan Kebayoran Baru hilang atau rusak parah sehingga menyulitkan warga dan pengunjung menemukan alamat yang dituju.",
    city: "Jakarta Selatan",
    district: "Kebayoran Baru",
    village: "Gunung",
    locationDetail: "Persimpangan Jl. Wijaya I dan Jl. Pakubuwono VI",
    status: "VERIFIED",
    submissionKey: "sk-00000000-0000-0000-0009",
    isHidden: false,
    createdDaysAgo: 3,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED", changedBy: ADMIN_ID, daysAfterCreate: 1 },
    ],
  },

  // --- SUBMITTED (4) ---
  {
    id: RPT_IDS[9],
    reporterId: PELAPOR2_ID,
    categorySlug: "sampah",
    title: "Bak sampah rusak dan meluber di Jl. Pramuka",
    description:
      "Bak sampah komunal di Jl. Pramuka rusak sehingga sampah meluber ke trotoar dan badan jalan. Bau tidak sedap mengganggu warga sekitar dan pembeli di warung makan.",
    city: "Jakarta Timur",
    district: "Matraman",
    village: "Utan Kayu Selatan",
    locationDetail: "Depan nomor 22 Jl. Pramuka, seberang Puskesmas Matraman",
    status: "SUBMITTED",
    submissionKey: "sk-00000000-0000-0000-0010",
    isHidden: false,
    createdDaysAgo: 2,
    transitions: [],
  },
  {
    id: RPT_IDS[10],
    reporterId: PELAPOR1_ID,
    categorySlug: "jalan-rusak",
    title: "Marka jalan pudar di jembatan Semanggi",
    description:
      "Marka jalan di jembatan Semanggi sudah sangat pudar dan hampir tidak terlihat terutama di malam hari. Berbahaya karena sering terjadi salah jalur di titik ini.",
    city: "Jakarta Selatan",
    district: "Setiabudi",
    village: "Karet Semanggi",
    locationDetail: "Jembatan Semanggi arah Gatot Subroto, setelah turunan dari Semanggi",
    status: "SUBMITTED",
    submissionKey: "sk-00000000-0000-0000-0011",
    isHidden: false,
    createdDaysAgo: 1,
    transitions: [],
  },
  {
    id: RPT_IDS[11],
    reporterId: PELAPOR2_ID,
    categorySlug: "lampu-jalan",
    title: "Lampu jalan tidak menyala di sepanjang Jl. TB Simatupang",
    description:
      "Sebanyak 7 titik lampu jalan di ruas Jl. TB Simatupang antara Pasar Rebo sampai Lebak Bulus tidak menyala. Ruas ini ramai dilalui tapi sangat gelap saat malam.",
    city: "Jakarta Selatan",
    district: "Pasar Minggu",
    village: "Ragunan",
    locationDetail: "Jl. TB Simatupang antara Pasar Rebo dan pintu tol Lebak Bulus",
    status: "SUBMITTED",
    submissionKey: "sk-00000000-0000-0000-0012",
    isHidden: false,
    createdDaysAgo: 1,
    transitions: [],
  },
  {
    id: RPT_IDS[12],
    reporterId: PELAPOR1_ID,
    categorySlug: "lainnya",
    title: "Pos kamling terbengkalai di RW 07 Koja",
    description:
      "Pos kamling di RW 07 Koja kondisinya sangat memprihatinkan, atap bocor dan dinding retak. Petugas ronda tidak mau berjaga karena tidak layak. Mohon perhatian pemerintah.",
    city: "Jakarta Utara",
    district: "Koja",
    village: "Lagoa",
    locationDetail: "Pos kamling RW 07 Jl. Raya Cakung Cilincing depan lapangan voli",
    status: "SUBMITTED",
    submissionKey: "sk-00000000-0000-0000-0013",
    isHidden: false,
    createdDaysAgo: 0,
    transitions: [],
  },

  // --- REJECTED (2) ---
  {
    id: RPT_IDS[13],
    reporterId: PELAPOR2_ID,
    categorySlug: "fasilitas-umum",
    title: "Wifi gratis di taman tidak berfungsi",
    description:
      "Fasilitas WiFi gratis dari pemerintah di Taman Suropati sudah tidak berfungsi sejak 2 bulan lalu. Padahal banyak warga memanfaatkannya untuk belajar online.",
    city: "Jakarta Pusat",
    district: "Menteng",
    village: "Menteng",
    locationDetail: "Taman Suropati, dekat patung di tengah taman",
    status: "REJECTED",
    submissionKey: "sk-00000000-0000-0000-0014",
    isHidden: false,
    createdDaysAgo: 15,
    transitions: [
      {
        fromStatus: "SUBMITTED",
        toStatus: "REJECTED",
        changedBy: ADMIN_ID,
        reason:
          "Fasilitas WiFi taman berada di bawah kewenangan Dinas Komunikasi, Informatika dan Statistik. Silakan laporkan langsung ke hotline Kominfotik DKI di 1500136.",
        daysAfterCreate: 2,
      },
    ],
  },
  {
    id: RPT_IDS[14],
    reporterId: PELAPOR1_ID,
    categorySlug: "lainnya",
    title: "Parkir liar di depan kantor kelurahan",
    description:
      "Kendaraan sering parkir sembarangan di depan kantor kelurahan sehingga menghalangi akses pejalan kaki dan pengguna kursi roda. Perlu pemasangan rambu larangan.",
    city: "Jakarta Barat",
    district: "Grogol Petamburan",
    village: "Tanjung Duren Utara",
    locationDetail: "Depan kantor Kelurahan Tanjung Duren Utara, Jl. Tanjung Duren Raya",
    status: "REJECTED",
    submissionKey: "sk-00000000-0000-0000-0015",
    isHidden: false,
    createdDaysAgo: 12,
    transitions: [
      {
        fromStatus: "SUBMITTED",
        toStatus: "REJECTED",
        changedBy: ADMIN_ID,
        reason:
          "Penertiban parkir liar merupakan kewenangan Dinas Perhubungan dan Satpol PP. Laporan ini tidak termasuk dalam cakupan LaporinAja yang fokus pada infrastruktur fisik.",
        daysAfterCreate: 1,
      },
    ],
  },

  // --- DUPLICATE (1) — data demonstrasi sesuai PRD, aksi otomatis tetap Should ---
  {
    id: RPT_IDS[15],
    reporterId: PELAPOR2_ID,
    categorySlug: "lampu-jalan",
    title: "Lampu jalan depan SDN 01 Menteng masih mati",
    description:
      "Lampu di depan SDN 01 Menteng masih mati. Saya lewat tadi malam dan masih gelap. Mohon segera diperbaiki karena membahayakan.",
    city: "Jakarta Pusat",
    district: "Menteng",
    village: "Menteng",
    locationDetail: "Depan SDN 01 Menteng",
    status: "DUPLICATE",
    submissionKey: "sk-00000000-0000-0000-0016",
    isHidden: false,
    duplicateOfId: RPT_IDS[0],
    createdDaysAgo: 19,
    transitions: [
      {
        fromStatus: "SUBMITTED",
        toStatus: "DUPLICATE",
        changedBy: ADMIN_ID,
        reason: `Laporan ini merupakan duplikat dari ${RPT_IDS[0]}. Masalah yang sama sudah ditangani dan diselesaikan.`,
        daysAfterCreate: 1,
      },
    ],
  },

  // --- Hidden report (tidak muncul di publik) ---
  {
    id: RPT_IDS[16],
    reporterId: PELAPOR1_ID,
    categorySlug: "lainnya",
    title: "Laporan uji coba internal — tidak tampil publik",
    description:
      "Laporan ini disembunyikan dari tampilan publik untuk keperluan pengujian admin dashboard. Konten ini tidak seharusnya muncul di halaman publik.",
    city: "Jakarta Pusat",
    district: "Gambir",
    village: "Gambir",
    locationDetail: "Lokasi uji coba",
    status: "VERIFIED",
    submissionKey: "sk-00000000-0000-0000-0017",
    isHidden: true,
    createdDaysAgo: 6,
    transitions: [
      { fromStatus: "SUBMITTED", toStatus: "VERIFIED", changedBy: ADMIN_ID, daysAfterCreate: 1 },
    ],
  },

  // --- Laporan ke-18: pelapor 2, kategori saluran air, masih SUBMITTED ---
  {
    id: RPT_IDS[17],
    reporterId: PELAPOR2_ID,
    categorySlug: "saluran-air",
    title: "Banjir genangan di Jl. Gunawarman tiap hujan deras",
    description:
      "Setiap kali hujan deras, Jl. Gunawarman selalu tergenang air setinggi lutut selama 1–2 jam. Drainase di kiri kanan jalan sepertinya tidak berfungsi dengan baik.",
    city: "Jakarta Selatan",
    district: "Kebayoran Baru",
    village: "Selong",
    locationDetail: "Jl. Gunawarman antara Jl. Suryo dan Jl. Senopati, depan deretan kafe",
    status: "SUBMITTED",
    submissionKey: "sk-00000000-0000-0000-0018",
    isHidden: false,
    createdDaysAgo: 0,
    transitions: [],
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Categories
  for (const category of categories) {
    await prisma.reportCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }
  console.log("✓ categories seeded");

  // 2. Demo users
  for (const u of demoUsers) {
    const passwordHash = await argon2.hash(u.password);
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, email: u.email, passwordHash, role: u.role },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        accountStatus: "ACTIVE",
      },
    });
  }
  console.log("✓ demo users seeded");

  // 3. Reports
  const categoryMap = new Map(
    (await prisma.reportCategory.findMany()).map((c) => [c.slug, c.id])
  );

  const now = new Date();

  for (const rpt of demoReports) {
    const categoryId = categoryMap.get(rpt.categorySlug);
    if (!categoryId) throw new Error(`Category not found: ${rpt.categorySlug}`);

    const existing = await prisma.report.findUnique({ where: { id: rpt.id } });
    if (existing) continue; // idempotent — skip already-seeded reports

    const publicCode = await nextPublicCode();
    const createdAt = new Date(now.getTime() - rpt.createdDaysAgo * 24 * 60 * 60 * 1000);

    await prisma.report.create({
      data: {
        id: rpt.id,
        publicCode,
        reporterId: rpt.reporterId,
        categoryId,
        title: rpt.title,
        description: rpt.description,
        city: rpt.city,
        district: rpt.district,
        village: rpt.village,
        locationDetail: rpt.locationDetail,
        status: rpt.status,
        submissionKey: rpt.submissionKey,
        isHidden: rpt.isHidden,
        duplicateOfReportId: rpt.duplicateOfId ?? null,
        createdAt,
        updatedAt: createdAt,
        verifiedAt: rpt.transitions.some((t) => t.toStatus === "VERIFIED")
          ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
          : null,
        resolvedAt: rpt.status === "RESOLVED"
          ? new Date(createdAt.getTime() + rpt.createdDaysAgo * 24 * 60 * 60 * 1000 * 0.6)
          : null,
      },
    });

    // Initial SUBMITTED history
    await prisma.reportStatusHistory.create({
      data: {
        reportId: rpt.id,
        fromStatus: null,
        toStatus: "SUBMITTED",
        changedBy: rpt.reporterId,
        createdAt,
      },
    });

    // Additional transitions
    for (const t of rpt.transitions) {
      await prisma.reportStatusHistory.create({
        data: {
          reportId: rpt.id,
          fromStatus: t.fromStatus as never,
          toStatus: t.toStatus as never,
          changedBy: t.changedBy,
          reason: t.reason ?? null,
          createdAt: new Date(createdAt.getTime() + t.daysAfterCreate * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Follow-up note
    if (rpt.followUp) {
      await prisma.reportFollowUp.create({
        data: {
          reportId: rpt.id,
          createdBy: ADMIN_ID,
          note: rpt.followUp.note,
          isResolutionNote: rpt.followUp.isResolutionNote,
          resolutionExplanation: rpt.followUp.resolutionExplanation ?? null,
          createdAt: new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }
  console.log("✓ demo reports seeded (18 laporan)");
  console.log("");
  console.log("Demo accounts:");
  console.log("  admin@demo.test   / Admin1234!  (ADMIN)");
  console.log("  budi@demo.test    / Budi1234!   (PELAPOR)");
  console.log("  siti@demo.test    / Siti1234!   (PELAPOR)");
}

main()
  .catch((error: unknown) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
