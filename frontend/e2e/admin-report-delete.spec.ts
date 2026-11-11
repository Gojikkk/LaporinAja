import { expect, test } from '@playwright/test'

const admin = { id: 'admin-1', name: 'Admin QA', role: 'ADMIN' }

const report = {
  code: 'LPR-2026-000700',
  title: 'Lampu jalan padam di taman',
  category: { id: 2, name: 'Lampu jalan', slug: 'lampu-jalan' },
  district: 'Sukajadi',
  village: 'Sukamaju',
  city: 'Bandung',
  latitude: null,
  longitude: null,
  status: 'SUBMITTED',
  thumbnailUrl: null,
  createdAt: '2026-11-01T08:00:00.000Z',
  description: 'Lima tiang lampu padam sejak minggu lalu dan jalan menjadi gelap.',
  locationDetail: 'Depan taman lingkungan',
  photos: [],
  timeline: [],
  followUps: [],
  evidences: [],
  duplicateOf: null,
  reporterName: 'Pelapor QA',
  isHidden: false,
}

test('admin dapat menghapus laporan setelah konfirmasi', async ({ page }) => {
  await page.route('**/api/auth/me*', (route) => route.fulfill({ json: { data: admin } }))
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: { data: { csrfToken: 'test-csrf' } } }))
  await page.route('**/api/admin/categories', (route) => route.fulfill({ json: { data: [] } }))
  let deleted = false
  await page.route('**/api/admin/reports?*', (route) => route.fulfill({
    json: { data: [report], meta: { page: 1, limit: 50, total: 1 }, counts: {} },
  }))
  await page.route('**/api/admin/reports/LPR-*', (route) => {
    if (route.request().method() === 'DELETE') {
      deleted = true
      return route.fulfill({ json: { data: { code: report.code, deleted: true } } })
    }
    return route.fulfill({ json: { data: report } })
  })

  await page.goto(`/admin/laporan/${report.code}`)
  await expect(page.getByRole('heading', { name: report.title })).toBeVisible()

  await page.getByRole('button', { name: 'Hapus laporan' }).click()
  const dialog = page.locator('dialog[open]')
  await expect(dialog.getByRole('heading', { name: 'Hapus laporan?' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Ya, hapus laporan' }).click()

  await expect.poll(() => deleted).toBe(true)
  await expect(page).toHaveURL('/admin/laporan')
  await expect(page.getByRole('heading', { name: 'Manajemen Laporan' })).toBeVisible()
})
