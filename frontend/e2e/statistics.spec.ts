import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './assert-accessible'

const publicStats = {
  total: 10,
  byStatus: { SUBMITTED: 0, VERIFIED: 2, IN_PROGRESS: 3, RESOLVED: 4, REJECTED: 0, DUPLICATE: 1 },
  statusDistribution: { SUBMITTED: 0, VERIFIED: 20, IN_PROGRESS: 30, RESOLVED: 40, REJECTED: 0, DUPLICATE: 10 },
  byCategory: [
    { id: 1, name: 'Jalan', slug: 'jalan', count: 6 },
    { id: 2, name: 'Lampu', slug: 'lampu', count: 4 },
  ],
  resolved: 4,
  completionRate: 44.44,
  asOf: '2026-11-10T00:00:00.000Z',
  label: 'Data demonstrasi',
}

const adminStats = {
  total: 20,
  submissions: 20,
  byStatus: { SUBMITTED: 2, VERIFIED: 5, IN_PROGRESS: 5, RESOLVED: 5, REJECTED: 2, DUPLICATE: 1 },
  byCategory: [
    { id: 10, name: 'Internal jalan', slug: 'internal-jalan', count: 15 },
    { id: 11, name: 'Internal lampu', slug: 'internal-lampu', count: 5 },
  ],
  statusDistribution: { SUBMITTED: 10, VERIFIED: 25, IN_PROGRESS: 25, RESOLVED: 25, REJECTED: 10, DUPLICATE: 5 },
  verificationRate: 75,
  followUpCoverage: 60,
  averageTimeToVerifiedMs: 7_200_000,
  resolvedWithProofRate: 80,
  asOf: '2026-11-10T00:00:00.000Z',
}

const emptyStats = {
  ...publicStats,
  total: 0,
  byStatus: { SUBMITTED: 0, VERIFIED: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, DUPLICATE: 0 },
  statusDistribution: { SUBMITTED: 0, VERIFIED: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0, DUPLICATE: 0 },
  byCategory: [],
  resolved: 0,
  completionRate: 0,
}

async function stubSession(page: Page, role?: 'PELAPOR' | 'ADMIN') {
  await page.route('**/api/auth/me*', (route) => route.fulfill(role
    ? { json: { data: { id: 'stats-qa', name: 'Stats QA', role } } }
    : { status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'Belum masuk.' } } }))
}

async function stubTrends(page: Page) {
  await page.route('**/api/stats/trends*', (route) => route.fulfill({
    json: { data: { period: '12 bulan', byCategory: [], asOf: publicStats.asOf, label: 'Data demonstrasi' } },
  }))
}

function cardValue(page: Page, label: string) {
  return page.locator('.stats-page-grid .stat-card').filter({ hasText: new RegExp(`^${label}`) }).locator('.stat-value')
}

test('statistik publik menghitung metrik, status, dan kategori dari data publik', async ({ page }) => {
  await stubSession(page)
  await page.route('**/api/stats/public*', (route) => route.fulfill({ json: { data: publicStats } }))
  await stubTrends(page)
  await page.goto('/statistik')

  await expect(cardValue(page, 'Laporan publik')).toHaveText('10')
  await expect(cardValue(page, 'Dalam tindak lanjut')).toHaveText('3')
  await expect(cardValue(page, 'Selesai dicatat')).toHaveText('4')
  await expect(cardValue(page, 'Kategori terpakai')).toHaveText('2')
  await expect(page.locator('.bar-row').filter({ hasText: 'Dalam tindak lanjut' }).locator('b')).toHaveText('30%')
  await expect(page.locator('.category-row').filter({ hasText: 'Jalan' })).toContainText('60%')
  await expect(page.locator('.category-row').filter({ hasText: 'Lampu' })).toContainText('40%')
  await expectAccessible(page)
})

test('statistik publik menampilkan loading sebelum metrik kosong', async ({ page }) => {
  await stubSession(page)
  let holdResponses = true
  const pendingResponses: Array<() => void> = []
  await page.route('**/api/stats/public*', async (route) => {
    if (holdResponses) await new Promise<void>((resolve) => pendingResponses.push(resolve))
    await route.fulfill({ json: { data: emptyStats } })
  })
  await stubTrends(page)
  await page.goto('/statistik')

  await expect.poll(() => pendingResponses.length).toBeGreaterThan(0)
  await expect(page.getByRole('status').getByText('Memuat statistik laporan…')).toBeVisible()
  holdResponses = false
  pendingResponses.splice(0).forEach((release) => release())
  await expect(cardValue(page, 'Laporan publik')).toHaveText('0')
  await expect(page.getByText('Belum ada data kategori.')).toBeVisible()
  await expectAccessible(page)
})

test('kegagalan statistik publik tampil sebagai error yang diumumkan', async ({ page }) => {
  await stubSession(page)
  await page.route('**/api/stats/public*', (route) => route.fulfill({
    status: 503,
    json: { error: { code: 'UNAVAILABLE', message: 'Statistik publik sedang tidak tersedia.' } },
  }))
  await stubTrends(page)
  await page.goto('/statistik')

  await expect(page.getByRole('alert')).toContainText('Statistik publik sedang tidak tersedia.')
  await expect(page.locator('.stats-page-grid')).toHaveCount(0)
})

test('statistik admin memakai agregat seluruh laporan dan aksesibel', async ({ page }) => {
  await stubSession(page, 'ADMIN')
  await page.route('**/api/stats/public*', (route) => route.fulfill({
    json: { data: { ...publicStats, byCategory: [{ id: 1, name: 'Publik saja', slug: 'publik-saja', count: 10 }] } },
  }))
  await page.route('**/api/admin/stats*', (route) => route.fulfill({ json: { data: adminStats } }))
  await stubTrends(page)
  await page.goto('/admin/statistik')

  await expect(cardValue(page, 'Total laporan')).toHaveText('20')
  await expect(cardValue(page, 'Rasio verifikasi')).toHaveText('75%')
  await expect(cardValue(page, 'Cakupan tindak lanjut')).toHaveText('60%')
  await expect(cardValue(page, 'Rata-rata verifikasi')).toHaveText('2 jam')
  await expect(page.locator('.category-row').filter({ hasText: 'Internal jalan' })).toContainText('75%')
  await expect(page.getByText('Publik saja')).toHaveCount(0)
  await expectAccessible(page)
})

test('statistik admin menampilkan loading sebelum angka tersedia', async ({ page }) => {
  await stubSession(page, 'ADMIN')
  await page.route('**/api/stats/public*', (route) => route.fulfill({ json: { data: publicStats } }))
  let holdResponses = true
  const pendingResponses: Array<() => void> = []
  await page.route('**/api/admin/stats*', async (route) => {
    if (holdResponses) await new Promise<void>((resolve) => pendingResponses.push(resolve))
    await route.fulfill({ json: { data: adminStats } })
  })
  await stubTrends(page)
  await page.goto('/admin/statistik')

  await expect.poll(() => pendingResponses.length).toBeGreaterThan(0)
  await expect(page.getByRole('status').getByText('Memuat statistik laporan…')).toBeVisible()
  holdResponses = false
  pendingResponses.splice(0).forEach((release) => release())
  await expect(cardValue(page, 'Total laporan')).toHaveText('20')
})

test('kegagalan statistik admin menampilkan error, bukan angka nol', async ({ page }) => {
  await stubSession(page, 'ADMIN')
  await page.route('**/api/stats/public*', (route) => route.fulfill({ json: { data: publicStats } }))
  await page.route('**/api/admin/stats*', (route) => route.fulfill({
    status: 503,
    json: { error: { code: 'UNAVAILABLE', message: 'Statistik admin sedang tidak tersedia.' } },
  }))
  await stubTrends(page)
  await page.goto('/admin/statistik')

  await expect(page.getByRole('alert')).toContainText('Statistik admin sedang tidak tersedia.')
  await expect(page.locator('.stats-page-grid')).toHaveCount(0)
})

test('dashboard admin menampilkan jumlah antrean dan metrik status', async ({ page }) => {
  await stubSession(page, 'ADMIN')
  await page.route('**/api/admin/stats*', (route) => route.fulfill({ json: { data: adminStats } }))
  await page.route('**/api/admin/reports?*', (route) => route.fulfill({
    json: { data: [], meta: { page: 1, limit: 4, total: 0 } },
  }))
  await page.goto('/admin')

  await expect(page.getByRole('heading', { name: '2 laporan perlu ditinjau' })).toBeVisible()
  await expect(page.locator('.adm-metric').filter({ hasText: 'Terverifikasi' })).toContainText('5')
  await expect(page.locator('.adm-metric').filter({ hasText: 'Sedang ditindaklanjuti' })).toContainText('5')
})
