import { expect, test, type Page } from '@playwright/test'

type Status =
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED'
  | 'DUPLICATE'

const reporter = { id: 'pelapor-1', name: 'Pelapor QA', role: 'PELAPOR' }

function listItem(code: string, title: string, status: Status, category = 'Lampu jalan') {
  return {
    code,
    title,
    category: { id: 2, name: category, slug: 'lampu-jalan' },
    district: 'Sukajadi',
    village: 'Sukamaju',
    latitude: null,
    longitude: null,
    status,
    thumbnailUrl: null,
    createdAt: '2026-11-01T08:00:00.000Z',
  }
}

const counts = {
  SUBMITTED: 2,
  VERIFIED: 3,
  IN_PROGRESS: 1,
  RESOLVED: 5,
  REJECTED: 1,
  DUPLICATE: 0,
}

async function stubSession(page: Page) {
  await page.route('**/api/auth/me*', (route) => route.fulfill({ json: { data: reporter } }))
}

test('dashboard menampilkan enam metrik status dan laporan terbaru', async ({ page }) => {
  await stubSession(page)
  await page.route('**/api/me/reports?*', (route) => route.fulfill({
    json: {
      data: [listItem('LPR-2026-000101', 'Lampu jalan padam di taman', 'IN_PROGRESS')],
      meta: { page: 1, limit: 4, total: 12 },
      counts,
    },
  }))

  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard Saya' })).toBeVisible()
  await expect(page.getByText('Halo, Pelapor QA')).toBeVisible()
  await expect(page.locator('.rep-metric')).toHaveCount(6)
  await expect(page.locator('.rep-metric', { hasText: 'Total laporan' }).locator('.rep-metric-value')).toHaveText('12')
  await expect(page.locator('.rep-metric', { hasText: 'Ditolak / duplikat' }).locator('.rep-metric-value')).toHaveText('1')
  await expect(page.getByRole('link', { name: 'Lampu jalan padam di taman' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lihat Semua Laporan' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('dashboard kosong menawarkan pembuatan laporan pertama', async ({ page }) => {
  await stubSession(page)
  await page.route('**/api/me/reports?*', (route) => route.fulfill({
    json: { data: [], meta: { page: 1, limit: 4, total: 0 }, counts: {} },
  }))

  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Belum ada laporan' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buat Laporan Pertama' })).toBeVisible()
})

test('kegagalan memuat dashboard dapat dicoba lagi', async ({ page }) => {
  await stubSession(page)
  let failed = true
  await page.route('**/api/me/reports?*', (route) => {
    if (!failed) {
      return route.fulfill({ json: { data: [], meta: { page: 1, limit: 4, total: 0 }, counts: {} } })
    }
    return route.fulfill({
      status: 503,
      json: { error: { code: 'UNAVAILABLE', message: 'Layanan laporan sedang tidak tersedia.' } },
    })
  })

  await page.goto('/dashboard')
  await expect(page.getByRole('alert')).toContainText('Layanan laporan sedang tidak tersedia.')
  await page.getByRole('button', { name: 'Coba lagi' }).click()
  await expect(page.getByRole('heading', { name: 'Belum ada laporan' })).toBeVisible()
})

test('daftar laporan saya memfilter status, membagi halaman, dan membuka detail', async ({ page }) => {
  await stubSession(page)
  const submitted = Array.from({ length: 10 }, (_, index) =>
    listItem(`LPR-2026-0001${String(index).padStart(2, '0')}`, `Lampu mati nomor ${index + 1}`, 'SUBMITTED'),
  )
  const rejected = [listItem('LPR-2026-000201', 'Lampu rusak di jembatan', 'REJECTED')]
  await page.route('**/api/me/reports?*', (route) => {
    const url = route.request().url()
    return route.fulfill({
      json: {
        data: url.includes('status=REJECTED') ? rejected : submitted,
        meta: {
          page: 1,
          limit: 50,
          total: url.includes('status=REJECTED') ? rejected.length : submitted.length,
        },
        counts,
      },
    })
  })
  const detail = {
    ...listItem('LPR-2026-000100', 'Lampu mati nomor 1', 'SUBMITTED'),
    description: 'Lima tiang lampu padam sejak minggu lalu.',
    city: 'Bandung',
    locationDetail: 'Depan taman lingkungan',
    photos: [{ url: '/media/evidence-1', mimeType: 'image/jpeg' }],
    timeline: [
      {
        fromStatus: null,
        toStatus: 'SUBMITTED',
        reason: null,
        createdAt: '2026-11-01T08:00:00.000Z',
        actorLabel: 'Pelapor',
      },
    ],
    followUps: [],
    evidences: [],
    duplicateOf: null,
  }
  await page.route('**/api/me/reports/*', (route) => route.fulfill({ json: { data: detail } }))

  await page.goto('/dashboard/laporan')

  await expect(page.getByRole('heading', { name: 'Laporan Saya' })).toBeVisible()
  await expect(page.locator('.rep-row')).toHaveCount(8)
  await expect(page.getByText('Menampilkan 1–8 dari 10 laporan')).toBeVisible()
  await page.getByRole('button', { name: 'Halaman 2' }).click()
  await expect(page.locator('.rep-row')).toHaveCount(2)
  await expect(page.getByText('Menampilkan 9–10 dari 10 laporan')).toBeVisible()

  await page.getByRole('button', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'Ditolak' }).click()
  await expect(page.locator('.rep-row')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'LPR-2026-000201' })).toBeVisible()

  await page.getByRole('button', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'Semua status' }).click()
  await expect(page.locator('.rep-row')).toHaveCount(8)
  await page.getByRole('button', { name: /Aksi lain untuk laporan/ }).first().click()
  await page.getByRole('menuitem', { name: 'Lihat detail' }).click()
  await expect(page).toHaveURL('/dashboard/laporan/LPR-2026-000100')
  await expect(page.getByRole('heading', { name: 'Lampu mati nomor 1' })).toBeVisible()
})

test('daftar laporan saya memfilter kategori', async ({ page }) => {
  await stubSession(page)
  const rows = [
    listItem('LPR-2026-000401', 'Lampu mati di gang', 'SUBMITTED', 'Lampu jalan'),
    listItem('LPR-2026-000402', 'Jalan berlubang di simpang', 'SUBMITTED', 'Jalan rusak'),
    listItem('LPR-2026-000403', 'Sampah menumpuk di pasar', 'SUBMITTED', 'Sampah'),
  ]
  await page.route('**/api/me/reports?*', (route) =>
    route.fulfill({
      json: { data: rows, meta: { page: 1, limit: 50, total: rows.length }, counts },
    }),
  )

  await page.goto('/dashboard/laporan')
  await expect(page.locator('.rep-row')).toHaveCount(3)

  await page.getByRole('button', { name: 'Kategori' }).click()
  await page.getByRole('option', { name: 'Jalan rusak' }).click()
  await expect(page.locator('.rep-row')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Jalan berlubang di simpang' })).toBeVisible()

  await page.getByRole('button', { name: 'Kategori' }).click()
  await page.getByRole('option', { name: 'Semua kategori' }).click()
  await expect(page.locator('.rep-row')).toHaveCount(3)
})

test('detail laporan selesai menampilkan bukti penyelesaian', async ({ page }) => {
  await stubSession(page)
  const detail = {
    ...listItem('LPR-2026-000301', 'Lampu jalan kembali menyala', 'RESOLVED'),
    description: 'Lima tiang lampu padam sejak minggu lalu.',
    city: 'Bandung',
    locationDetail: 'Depan taman lingkungan',
    photos: [{ url: '/media/evidence-1', mimeType: 'image/jpeg' }],
    timeline: [
      {
        fromStatus: 'IN_PROGRESS',
        toStatus: 'RESOLVED',
        reason: 'Perbaikan selesai',
        createdAt: '2026-11-05T02:00:00.000Z',
        actorLabel: 'Administrator platform',
      },
    ],
    followUps: [
      {
        id: 'follow-up-1',
        note: 'Semua lampu sudah menyala kembali.',
        isResolutionNote: true,
        resolutionExplanation: 'Diperiksa langsung oleh petugas lapangan.',
        createdAt: '2026-11-05T02:00:00.000Z',
        evidences: [{ url: '/media/proof-1', mimeType: 'image/jpeg' }],
      },
    ],
    evidences: [],
    duplicateOf: null,
  }
  await page.route('**/api/me/reports/*', (route) => route.fulfill({ json: { data: detail } }))

  await page.goto('/dashboard/laporan/LPR-2026-000301')

  await expect(page.getByRole('heading', { name: 'Lampu jalan kembali menyala' })).toBeVisible()
  await expect(page.locator('.rep-badge', { hasText: 'Selesai' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Selesai ditindaklanjut' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bukti selesai' })).toBeVisible()
  await expect(page.getByText('Semua lampu sudah menyala kembali.')).toBeVisible()
  await expect(page.locator('.rep-proof-grid img')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Kondisi dan patokan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Linimasa laporan' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Kembali ke Dashboard' })).toBeVisible()
})

test('detail laporan duplikat menautkan ke laporan utama', async ({ page }) => {
  await stubSession(page)
  const primary = {
    ...listItem('LPR-2026-000400', 'Lampu jalan padam di taman', 'VERIFIED'),
    description: 'Laporan utama dengan kondisi yang sama.',
    city: 'Bandung',
    locationDetail: 'Depan taman lingkungan',
    photos: [],
    timeline: [],
    followUps: [],
    evidences: [],
    duplicateOf: null,
  }
  await page.route('**/api/me/reports/*', (route) => route.fulfill({
    json: {
      data: {
        ...primary,
        code: 'LPR-2026-000401',
        title: 'Lampu jalan padam di taman (salinan)',
        status: 'DUPLICATE' as Status,
        duplicateOf: { code: 'LPR-2026-000400', url: '/laporan/LPR-2026-000400' },
      },
    },
  }))
  await page.route('**/api/reports/LPR-2026-000400*', (route) => route.fulfill({ json: { data: primary } }))

  await page.goto('/dashboard/laporan/LPR-2026-000401')

  await expect(page.getByRole('heading', { name: 'Lampu jalan padam di taman (salinan)' })).toBeVisible()
  await expect(page.locator('.rep-banner', { hasText: 'Laporan digabungkan' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Referensi duplikat' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lihat Laporan Asal' })).toHaveAttribute(
    'href',
    '/laporan/LPR-2026-000400',
  )
})
