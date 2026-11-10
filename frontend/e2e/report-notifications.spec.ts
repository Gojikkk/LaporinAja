import { expect, test, type Page } from '@playwright/test'

const notification = {
  id: '36a7f6fc-1661-4f4f-9f35-9bc5a4ea4060',
  type: 'REPORT_STATUS_CHANGED',
  message: 'Laporan Anda sedang ditindaklanjuti.',
  isRead: false,
  createdAt: '2026-11-10T03:00:00.000Z',
  reportCode: 'LPR-2026-000123',
  reportUrl: '/laporan/LPR-2026-000123',
}

async function openReporterDashboard(page: Page) {
  await page.route('**/api/auth/me*', (route) => route.fulfill({
    json: { data: { id: 'pelapor-1', name: 'Pelapor QA', role: 'PELAPOR' } },
  }))
  await page.route('**/api/me/reports?*', (route) => route.fulfill({
    json: { data: [], meta: { page: 1, limit: 3, total: 0 }, counts: {} },
  }))
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Halo, Pelapor QA' })).toBeVisible()
  const mobileMenu = page.getByRole('button', { name: 'Buka navigasi' })
  if (await mobileMenu.isVisible()) await mobileMenu.click()
}

test('panel memuat notifikasi terbaru dan menampilkan empty state', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  let requestCount = 0
  await page.route('**/api/me/notifications*', async (route) => {
    requestCount += 1
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({ json: { data: [] } })
  })
  await openReporterDashboard(page)

  await page.getByRole('button', { name: 'Notifikasi' }).click()
  await expect(page.getByText('Memuat notifikasi…')).toBeVisible()
  await expect(page.getByText('Belum ada notifikasi.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('error pengambilan notifikasi dapat dicoba lagi', async ({ page }) => {
  let allowSuccess = false
  await page.route('**/api/me/notifications*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    if (!allowSuccess) {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Layanan notifikasi sedang tidak tersedia.' } },
      })
      return
    }
    await route.fulfill({ json: { data: [notification] } })
  })
  await openReporterDashboard(page)
  await page.getByRole('button', { name: 'Notifikasi' }).click()

  await expect(page.getByRole('alert')).toContainText('Layanan notifikasi sedang tidak tersedia.')
  allowSuccess = true
  await page.getByRole('button', { name: 'Coba lagi' }).click()
  await expect(page.getByRole('button', { name: /Notifikasi, 1 belum dibaca/ })).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(notification.reportCode) })).toBeVisible()
})

test('menandai dibaca, membuka tracking milik pelapor, dan mempertahankan status setelah refresh', async ({ page }) => {
  let isRead = false
  await page.route('**/api/me/notifications**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { data: [{ ...notification, isRead }] } })
      return
    }
    isRead = true
    await route.fulfill({ json: { data: { ...notification, isRead } } })
  })
  await page.route('**/api/me/reports/*', (route) => route.fulfill({
    status: 404,
    json: { error: { code: 'NOT_FOUND', message: 'Laporan tidak ditemukan' } },
  }))
  await page.route('**/api/auth/csrf*', (route) => route.fulfill({ status: 401 }))
  await openReporterDashboard(page)

  await expect(page.getByRole('button', { name: /Notifikasi, 1 belum dibaca/ })).toBeVisible()
  await page.getByRole('button', { name: 'Notifikasi, 1 belum dibaca' }).click()
  await page.getByRole('button', { name: new RegExp(notification.reportCode) }).click()
  await expect(page).toHaveURL(`/dashboard/laporan/${notification.reportCode}`)
  await expect(page.getByRole('heading', { name: 'Laporan tidak ditemukan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifikasi', exact: true })).toBeVisible()

  await page.reload()
  const mobileMenu = page.getByRole('button', { name: 'Buka navigasi' })
  if (await mobileMenu.isVisible()) await mobileMenu.click()
  await page.getByRole('button', { name: 'Notifikasi' }).click()
  await expect(page.locator('.notif-menu li.read')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifikasi', exact: true })).toBeVisible()
})

test('kegagalan PATCH tidak menandai dibaca atau navigasi dan dapat dicoba lagi', async ({ page }) => {
  let patchCount = 0
  let isRead = false
  await page.route('**/api/me/notifications**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { data: [{ ...notification, isRead }] } })
      return
    }
    patchCount += 1
    if (patchCount === 1) {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Status baca belum tersimpan.' } },
      })
      return
    }
    isRead = true
    await route.fulfill({ json: { data: { ...notification, isRead } } })
  })
  await page.route('**/api/me/reports/*', (route) => route.fulfill({
    status: 404,
    json: { error: { code: 'NOT_FOUND', message: 'Laporan tidak ditemukan' } },
  }))
  await page.route('**/api/auth/csrf*', (route) => route.fulfill({ status: 401 }))
  await openReporterDashboard(page)
  await page.getByRole('button', { name: 'Notifikasi, 1 belum dibaca' }).click()
  await page.getByRole('button', { name: new RegExp(notification.reportCode) }).click()

  await expect(page.getByRole('alert')).toContainText('Status baca belum tersimpan.')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('.notif-menu li.unread')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible()
  await page.getByRole('button', { name: 'Coba lagi' }).click()

  await expect(page).toHaveURL(`/dashboard/laporan/${notification.reportCode}`)
  expect(isRead).toBe(true)
  expect(patchCount).toBe(2)
})

test('sesi kedaluwarsa ditampilkan sebagai error dengan tautan untuk masuk kembali', async ({ page }) => {
  let sessionCheckCount = 0
  await page.route('**/api/me/notifications*', (route) => route.fulfill({
    status: 401,
    json: { error: { code: 'UNAUTHENTICATED', message: 'Sesi tidak valid.' } },
  }))
  await page.route('**/api/auth/me*', (route) => {
    sessionCheckCount += 1
    return sessionCheckCount > 2
      ? route.fulfill({ status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'Sesi tidak valid.' } } })
      : route.fulfill({ json: { data: { id: 'pelapor-1', name: 'Pelapor QA', role: 'PELAPOR' } } })
  })
  await page.route('**/api/me/reports?*', (route) => route.fulfill({
    json: { data: [], meta: { page: 1, limit: 3, total: 0 }, counts: {} },
  }))
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Notifikasi' }).click()

  await expect(page.getByRole('alert')).toContainText('Sesi berakhir.')
  await page.getByRole('button', { name: 'Masuk kembali' }).click()
  await expect(page).toHaveURL('/masuk')
})
