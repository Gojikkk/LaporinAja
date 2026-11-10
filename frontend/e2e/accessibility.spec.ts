import { expect, test } from '@playwright/test'
import { expectAccessible } from './assert-accessible'

test('halaman login memiliki label, alur keyboard, dan tidak memiliki pelanggaran axe', async ({ page }) => {
  await page.route('**/api/auth/me*', (route) => route.fulfill({
    status: 401,
    json: { error: { code: 'UNAUTHENTICATED', message: 'Belum masuk.' } },
  }))
  await page.goto('/masuk')

  const backLink = page.getByRole('link', { name: 'Kembali ke beranda' })
  const email = page.getByLabel('Alamat email')
  const password = page.getByLabel('Password')
  await expect(email).toBeVisible()
  await expect(password).toBeVisible()
  await backLink.focus()
  await page.keyboard.press('Tab')
  await expect(email).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(password).toBeFocused()
  await expectAccessible(page)
})

test('halaman laporan publik tidak memiliki pelanggaran axe', async ({ page }) => {
  await page.route('**/api/auth/me*', (route) => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHENTICATED' } } }))
  await page.route('**/api/categories*', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/reports*', (route) => route.fulfill({
    json: { data: [], meta: { page: 1, limit: 6, total: 0 } },
  }))
  await page.goto('/laporan')

  await expect(page.getByRole('searchbox', { name: 'Cari kode atau judul' })).toBeVisible()
  await expectAccessible(page)
})

test('dashboard pelapor tidak memiliki pelanggaran axe', async ({ page }) => {
  await page.route('**/api/auth/me*', (route) => route.fulfill({ json: { data: { id: 'pelapor-qa', name: 'Pelapor QA', role: 'PELAPOR' } } }))
  await page.route('**/api/me/reports*', (route) => route.fulfill({
    json: { data: [], meta: { page: 1, limit: 3, total: 0 }, counts: {} },
  }))
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Halo, Pelapor QA' })).toBeVisible()
  await expectAccessible(page)
})

test('antrean admin tidak memiliki pelanggaran axe', async ({ page }) => {
  await page.route('**/api/auth/me*', (route) => route.fulfill({ json: { data: { id: 'admin-qa', name: 'Admin QA', role: 'ADMIN' } } }))
  await page.route('**/api/admin/categories*', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/admin/reports*', (route) => route.fulfill({
    json: { data: [], meta: { page: 1, limit: 10, total: 0 } },
  }))
  await page.goto('/admin/laporan')

  await expect(page.getByRole('heading', { name: 'Manajemen Laporan' })).toBeVisible()
  await expectAccessible(page)
})
