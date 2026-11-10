import { expect, test, type Page } from '@playwright/test'
import { expectAccessible } from './assert-accessible'

const reporter = { id: 'pelapor-qa', name: 'Pelapor QA', role: 'PELAPOR' as const }
const admin = { id: 'admin-qa', name: 'Admin QA', role: 'ADMIN' as const }

function report(code: string, status: 'SUBMITTED' | 'VERIFIED' = 'SUBMITTED') {
  return {
    code,
    title: 'Lampu jalan padam di taman',
    category: { id: 2, name: 'Lampu jalan', slug: 'lampu-jalan' },
    district: 'Sukajadi',
    village: 'Sukamaju',
    latitude: null,
    longitude: null,
    status,
    thumbnailUrl: null,
    createdAt: '2026-11-01T08:00:00.000Z',
    description: 'Lampu di taman lingkungan padam sejak minggu lalu.',
    city: 'Bandung',
    locationDetail: 'Depan taman lingkungan',
    photos: [{ url: '/media/evidence-1', mimeType: 'image/png' }],
    timeline: [{
      fromStatus: null,
      toStatus: status,
      reason: null,
      createdAt: '2026-11-01T08:00:00.000Z',
      actorLabel: 'Pelapor',
    }],
    followUps: [],
    evidences: [],
    duplicateOf: null,
  }
}

async function stubCsrf(page: Page) {
  await page.route('**/api/auth/csrf*', (route) => route.fulfill({ json: { data: { csrfToken: 'test-token' } } }))
}

test('pelapor login lalu mengirim laporan dengan foto pendukung', async ({ page }) => {
  let created = false
  await page.route('**/api/auth/me*', (route) => route.fulfill({
    status: 401,
    json: { error: { code: 'UNAUTHENTICATED', message: 'Belum masuk.' } },
  }))
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: { data: reporter } }))
  await page.route('**/api/categories*', (route) => route.fulfill({
    json: { data: [{ id: 2, name: 'Lampu jalan', slug: 'lampu-jalan' }] },
  }))
  await page.route('**/api/me/reports*', (route) => route.fulfill({
    json: {
      data: created ? [{
        ...report('LPR-2026-000123'),
      }] : [],
      meta: { page: 1, limit: 3, total: created ? 1 : 0 },
      counts: {},
    },
  }))
  await page.route('**/api/me/reports/LPR-2026-000123', (route) => route.fulfill({
    json: { data: report('LPR-2026-000123') },
  }))
  await stubCsrf(page)
  await page.route('**/api/reports', async (route) => {
    expect(route.request().method()).toBe('POST')
    const body = route.request().postData() ?? ''
    expect(body).toContain('Lampu jalan padam di taman')
    expect(body).toContain('evidence.png')
    created = true
    await route.fulfill({ json: { data: { code: 'LPR-2026-000123', status: 'SUBMITTED' } } })
  })

  await page.goto('/masuk')
  await page.getByLabel('Alamat email').fill('pelapor@example.test')
  await page.getByLabel('Password').fill('Password123!')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText('Halo, Pelapor QA')).toBeVisible()

  await page.getByRole('main').getByRole('link', { name: 'Buat laporan' }).click()
  await expectAccessible(page)
  await page.getByLabel('Kategori').selectOption('2')
  await page.getByLabel('Judul laporan').fill('Lampu jalan padam di taman')
  await page.getByLabel('Deskripsi').fill('Lampu di taman lingkungan padam sejak minggu lalu.')
  await page.getByLabel('Kota/kabupaten').fill('Bandung')
  await page.getByLabel('Kecamatan').fill('Sukajadi')
  await page.getByLabel('Kelurahan/desa').fill('Sukamaju')
  await page.getByLabel('Patokan lokasi').fill('Depan taman lingkungan')
  await page.getByLabel('Pilih foto dari perangkat').setInputFiles({
    name: 'evidence.png',
    mimeType: 'image/png',
    buffer: Buffer.from('test image'),
  })
  await page.getByRole('button', { name: 'Kirim laporan' }).click()

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText('Laporan LPR-2026-000123 berhasil dikirim.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lampu jalan padam di taman' })).toBeVisible()
  await page.getByRole('link', { name: 'Lampu jalan padam di taman' }).click()
  await expect(page).toHaveURL('/dashboard/laporan/LPR-2026-000123')
  await expect(page.getByRole('heading', { name: 'Lampu jalan padam di taman' })).toBeVisible()
  await expectAccessible(page)
})

test('admin memverifikasi laporan dan melihat umpan balik status', async ({ page }) => {
  let status: 'SUBMITTED' | 'VERIFIED' = 'SUBMITTED'
  const detail = () => ({ ...report('LPR-2026-000456', status), reporterName: 'Pelapor QA', isHidden: false })
  await page.route('**/api/auth/me*', (route) => route.fulfill({ json: { data: admin } }))
  await page.route('**/api/admin/categories*', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/admin/reports?*', (route) => route.fulfill({
    json: { data: [detail()], meta: { page: 1, limit: 50, total: 1 } },
  }))
  await page.route('**/api/admin/reports/LPR-2026-000456', (route) => route.fulfill({ json: { data: detail() } }))
  await stubCsrf(page)
  await page.route('**/api/admin/reports/LPR-2026-000456/status', async (route) => {
    expect(route.request().method()).toBe('POST')
    const body = route.request().postDataJSON()
    expect(body).toMatchObject({ toStatus: 'VERIFIED', expectedStatus: 'SUBMITTED' })
    status = 'VERIFIED'
    await route.fulfill({ json: { data: { code: 'LPR-2026-000456', status, historyId: 'history-1' } } })
  })

  await page.goto('/admin/laporan/LPR-2026-000456')
  await expect(page.getByRole('heading', { name: 'Lampu jalan padam di taman' })).toBeVisible()
  await page.getByRole('button', { name: 'Verifikasi laporan' }).click()
  const dialog = page.getByRole('dialog')
  await expectAccessible(page)
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Verifikasi laporan' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('status')).toContainText('Laporan diverifikasi dan kini tampil di halaman publik.')
  await expect(page.locator('.adm-detail-status')).toContainText('Terverifikasi')
})
