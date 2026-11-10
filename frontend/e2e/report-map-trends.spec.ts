import { expect, test } from '@playwright/test'

const publicReport = {
  code: 'QA-MAP-001',
  title: 'Jalan berlubang',
  category: { id: 1, name: 'Jalan', slug: 'jalan' },
  district: 'Sukasari',
  village: 'Cipedes',
  latitude: -6.1752,
  longitude: 106.8271,
  status: 'VERIFIED',
  thumbnailUrl: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  description: 'Ada lubang pada jalan.',
  city: 'Bandung',
  locationDetail: 'Dekat persimpangan',
  photos: [],
  timeline: [],
  followUps: [],
  evidences: [],
  duplicateOf: null,
}

const publicStats = {
  total: 3,
  byStatus: { SUBMITTED: 0, VERIFIED: 3, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, DUPLICATE: 0 },
  statusDistribution: { SUBMITTED: 0, VERIFIED: 3, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, DUPLICATE: 0 },
  byCategory: [{ id: 1, name: 'Jalan', slug: 'jalan', count: 3 }],
  resolved: 0,
  completionRate: 0,
  asOf: '2026-01-15T00:00:00.000Z',
  label: 'Data demonstrasi',
}

test('peta detail memakai koordinat publik 3 desimal dan lokasi tetap tersedia', async ({ page }) => {
  await page.route('**/api/reports/QA-MAP-001', (route) => route.fulfill({ json: { data: publicReport } }))
  await page.route('https://www.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }))
  await page.goto('/laporan/QA-MAP-001')

  const map = page.locator('.report-map-frame')
  await expect(map).toBeVisible()
  await expect(page.locator('.condition-meta')).toContainText('Cipedes, Sukasari')
  const mapUrl = new URL((await map.getAttribute('src'))!)
  expect(mapUrl.searchParams.get('marker')).toBe('-6.175,106.827')
  await expect(page.getByText('Perkiraan lokasi publik · -6.175, 106.827')).toBeVisible()
})

test('peta tidak ditampilkan bila koordinat tidak tersedia', async ({ page }) => {
  await page.route('**/api/reports/QA-MAP-001', (route) => route.fulfill({
    json: { data: { ...publicReport, latitude: null, longitude: null } },
  }))
  await page.goto('/laporan/QA-MAP-001')

  await expect(page.locator('.condition-meta')).toContainText('Cipedes, Sukasari')
  await expect(page.getByRole('heading', { name: 'Peta lokasi' })).toHaveCount(0)
})

test('lokasi tetap terbaca jika peta OpenStreetMap tidak dapat diakses', async ({ page }) => {
  await page.route('**/api/reports/QA-MAP-001', (route) => route.fulfill({ json: { data: publicReport } }))
  await page.route('https://www.openstreetmap.org/**', (route) => route.abort())
  await page.goto('/laporan/QA-MAP-001', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.condition-meta')).toContainText('Cipedes, Sukasari')
  await expect(page.getByRole('heading', { name: 'Peta lokasi' })).toBeVisible()
})

test('tren kategori menampilkan agregat API dan label data demonstrasi', async ({ page }) => {
  await page.route('**/api/stats/public', (route) => route.fulfill({ json: { data: publicStats } }))
  await page.route('**/api/stats/trends', (route) => route.fulfill({
    json: {
      data: {
        period: '12 bulan',
        byCategory: [{ id: 1, name: 'Jalan', slug: 'jalan', months: [{ month: '2026-01', count: 2 }, { month: '2026-02', count: 1 }] }],
        asOf: '2026-02-01T00:00:00.000Z',
        label: 'Data demonstrasi',
      },
    },
  }))
  await page.goto('/statistik')

  await expect(page.getByRole('heading', { name: 'Tren kategori dan periode' })).toBeVisible()
  await expect(page.getByText('Data demonstrasi', { exact: true })).toBeVisible()
  await expect(page.getByText('Data demonstrasi, bukan gambaran kondisi nyata di lapangan.')).toBeVisible()
  await expect(page.getByRole('row', { name: /Jalan 3 laporan/ })).toBeVisible()
})

test('tren menampilkan state loading saat agregat sedang dimuat', async ({ page }) => {
  await page.route('**/api/stats/public', (route) => route.fulfill({ json: { data: publicStats } }))
  await page.route('**/api/stats/trends', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill({
      json: { data: { period: '12 bulan', byCategory: [], asOf: '2026-02-01T00:00:00.000Z', label: 'Data demonstrasi' } },
    })
  })
  await page.goto('/statistik')

  await expect(page.getByRole('status').getByText('Memuat tren laporan…')).toBeVisible()
})

test('tren API gagal menampilkan error dan dapat dicoba lagi', async ({ page }) => {
  let requests = 0
  let allowSuccess = false
  await page.route('**/api/stats/public', (route) => route.fulfill({ json: { data: publicStats } }))
  await page.route('**/api/stats/trends', (route) => {
    requests += 1
    return allowSuccess
      ? route.fulfill({ json: { data: { period: '12 bulan', byCategory: [], asOf: '2026-02-01T00:00:00.000Z', label: 'Data demonstrasi' } } })
      : route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Tren sedang tidak tersedia.' } } })
  })
  await page.goto('/statistik')

  await expect(page.getByRole('alert').getByText('Tren sedang tidak tersedia.')).toBeVisible()
  allowSuccess = true
  await page.getByRole('button', { name: 'Coba lagi' }).click()
  await expect(page.getByText('Belum ada data tren untuk ditampilkan.')).toBeVisible()
  expect(requests).toBeGreaterThanOrEqual(2)
})

test('ekspor CSV admin mengunduh file melalui API terautentikasi', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { data: { id: 'admin-1', name: 'Admin', role: 'ADMIN' } } }))
  await page.route('**/api/admin/categories', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/admin/reports?**', (route) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 10, total: 0 } } }))
  await page.route('**/api/admin/reports/export**', (route) => route.fulfill({
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="laporinaja-reports.csv"',
    },
    body: '\uFEFFcode,title\n',
  }))
  await page.goto('/admin/laporan')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Ekspor CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('laporinaja-reports.csv')
  await expect(page.getByRole('status').getByText('Ekspor CSV berhasil diunduh.')).toBeVisible()
})

test('ekspor CSV gagal menampilkan umpan balik error, bukan sukses', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { data: { id: 'admin-1', name: 'Admin', role: 'ADMIN' } } }))
  await page.route('**/api/admin/categories', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/admin/reports?**', (route) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 10, total: 0 } } }))
  await page.route('**/api/admin/reports/export**', (route) => route.fulfill({
    status: 503,
    json: { error: { code: 'UNAVAILABLE', message: 'Ekspor belum tersedia.' } },
  }))
  await page.goto('/admin/laporan')

  await page.getByRole('button', { name: 'Ekspor CSV' }).click()
  await expect(page.getByRole('alert').getByText('Ekspor belum tersedia.')).toBeVisible()
})
