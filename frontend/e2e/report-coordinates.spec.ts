import { expect, test } from '@playwright/test'

const reporterSession = { data: { id: 'reporter-1', name: 'Pelapor QA', role: 'PELAPOR' } }
const categories = { data: [{ id: 1, name: 'Jalan', slug: 'jalan' }] }
const emptyReports = { data: [], meta: { page: 1, limit: 3, total: 0 }, counts: {} }
const photo = {
  name: 'qa.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=', 'base64'),
}

async function openReportForm(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: reporterSession }))
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: { data: { csrfToken: 'qa-csrf-token' } } }))
  await page.route('**/api/categories', (route) => route.fulfill({ json: categories }))
  await page.route('**/api/me/reports**', (route) => route.fulfill({ json: emptyReports }))
  await page.goto('/lapor/baru')
  await page.getByLabel('Kategori').selectOption('1')
  await page.getByLabel('Judul laporan').fill('Jalan berlubang di dekat taman')
  await page.getByLabel('Deskripsi').fill('Jalan berlubang cukup dalam dan mengganggu kendaraan yang melintas setiap hari.')
  await page.getByLabel('Kota/kabupaten').fill('Kota QA')
  await page.getByLabel('Kecamatan').fill('Kecamatan QA')
  await page.getByLabel('Kelurahan/desa').fill('Kelurahan QA')
  await page.getByLabel('Patokan lokasi').fill('Dekat taman kota')
  await page.getByLabel('Pilih foto dari perangkat').setInputFiles(photo)
}

test('pelapor dapat mengambil lokasi perangkat dan mengirim koordinat ke API', async ({ page }) => {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: -6.1752, longitude: 106.8271 })
  await openReportForm(page)
  await page.getByRole('button', { name: 'Gunakan lokasi saya' }).click()

  await expect(page.getByLabel('Latitude')).toHaveValue('-6.1752')
  await expect(page.getByLabel('Longitude')).toHaveValue('106.8271')

  let submittedBody = ''
  await page.route('**/api/reports', async (route) => {
    submittedBody = route.request().postData() ?? ''
    await route.fulfill({ json: { data: { code: 'LPR-2026-000001', status: 'SUBMITTED' }, meta: {} }, status: 201 })
  })
  await page.getByRole('button', { name: 'Kirim laporan' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  expect(submittedBody).toContain('name="latitude"\r\n\r\n-6.1752')
  expect(submittedBody).toContain('name="longitude"\r\n\r\n106.8271')
})

test('koordinat manual memerlukan latitude dan longitude berpasangan', async ({ page }) => {
  await openReportForm(page)
  await page.getByLabel('Latitude').fill('-6.1752')

  let requestCount = 0
  await page.route('**/api/reports', async (route) => {
    requestCount += 1
    await route.fulfill({ json: { data: { code: 'LPR-2026-000002', status: 'SUBMITTED' } }, status: 201 })
  })
  await page.getByRole('button', { name: 'Kirim laporan' }).click()

  await expect(page.getByRole('alert')).toContainText('Latitude dan longitude harus diisi bersama.')
  expect(requestCount).toBe(0)
})

test('koordinat manual dikirim bersama laporan', async ({ page }) => {
  await openReportForm(page)
  await page.getByLabel('Latitude').fill('-6.1752')
  await page.getByLabel('Longitude').fill('106.8271')

  let submittedBody = ''
  await page.route('**/api/reports', async (route) => {
    submittedBody = route.request().postData() ?? ''
    await route.fulfill({ json: { data: { code: 'LPR-2026-000003', status: 'SUBMITTED' } }, status: 201 })
  })
  await page.getByRole('button', { name: 'Kirim laporan' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  expect(submittedBody).toContain('name="latitude"\r\n\r\n-6.1752')
  expect(submittedBody).toContain('name="longitude"\r\n\r\n106.8271')
})

test('laporan tetap dapat dikirim tanpa koordinat', async ({ page }) => {
  await openReportForm(page)

  let submittedBody = ''
  await page.route('**/api/reports', async (route) => {
    submittedBody = route.request().postData() ?? ''
    await route.fulfill({ json: { data: { code: 'LPR-2026-000004', status: 'SUBMITTED' } }, status: 201 })
  })
  await page.getByRole('button', { name: 'Kirim laporan' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  expect(submittedBody).not.toContain('name="latitude"')
  expect(submittedBody).not.toContain('name="longitude"')
})
