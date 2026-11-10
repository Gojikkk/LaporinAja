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

async function openManualCoordinates(page: import('@playwright/test').Page) {
  await page.locator('.report-manual-coordinates summary').click()
}

test('pelapor dapat mengambil lokasi perangkat dan mengirim koordinat ke API', async ({ page }) => {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: -6.1752, longitude: 106.8271 })
  await openReportForm(page)
  await page.getByRole('button', { name: 'Gunakan lokasi saya' }).click()

  await openManualCoordinates(page)
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
  await openManualCoordinates(page)
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
  await openManualCoordinates(page)
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

test('pelapor mencari lokasi teks lalu memilih titik yang benar', async ({ page }) => {
  await openReportForm(page)
  let searchUrl: URL | undefined
  await page.route('**/api/location/search**', async (route) => {
    searchUrl = new URL(route.request().url())
    await route.fulfill({
      json: {
        data: [
          { latitude: -6.1752, longitude: 106.8271, displayName: 'Taman Kota, Bandung, Indonesia' },
          { latitude: -6.18, longitude: 106.83, displayName: 'Taman lain, Bandung, Indonesia' },
        ],
      },
    })
  })

  await page.getByRole('button', { name: 'Cari titik dari lokasi' }).click()
  await expect(page.getByRole('group', { name: 'Hasil pencarian lokasi' })).toBeVisible()
  expect(searchUrl?.searchParams.get('q')).toBe('Dekat taman kota, Kelurahan QA, Kecamatan QA, Kota QA, Indonesia')
  await page.getByRole('button', { name: /Taman Kota, Bandung, Indonesia/ }).click()
  await expect(page.getByText('Titik terpilih: Taman Kota, Bandung, Indonesia')).toBeVisible()

  await openManualCoordinates(page)
  await expect(page.getByLabel('Latitude')).toHaveValue('-6.1752')
  await expect(page.getByLabel('Longitude')).toHaveValue('106.8271')

  let submittedBody = ''
  await page.route('**/api/reports', async (route) => {
    submittedBody = route.request().postData() ?? ''
    await route.fulfill({ json: { data: { code: 'LPR-2026-000005', status: 'SUBMITTED' } }, status: 201 })
  })
  await page.getByRole('button', { name: 'Kirim laporan' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  expect(submittedBody).toContain('name="latitude"\r\n\r\n-6.1752')
  expect(submittedBody).toContain('name="longitude"\r\n\r\n106.8271')
})

test('mengubah patokan lokasi menghapus titik hasil pencarian yang lama', async ({ page }) => {
  await openReportForm(page)
  await page.route('**/api/location/search**', (route) => route.fulfill({
    json: { data: [{ latitude: -6.1752, longitude: 106.8271, displayName: 'Taman Kota, Bandung, Indonesia' }] },
  }))
  await page.getByRole('button', { name: 'Cari titik dari lokasi' }).click()
  await page.getByRole('button', { name: /Taman Kota, Bandung, Indonesia/ }).click()
  await page.getByLabel('Patokan lokasi').fill('Depan museum kota')

  await expect(page.getByText('Titik terpilih: Taman Kota, Bandung, Indonesia')).toHaveCount(0)
  await openManualCoordinates(page)
  await expect(page.getByLabel('Latitude')).toHaveValue('')
  await expect(page.getByLabel('Longitude')).toHaveValue('')
})

test('pencarian lokasi menampilkan hasil kosong dan error dengan opsi coba lagi', async ({ page }) => {
  await openReportForm(page)
  let requests = 0
  await page.route('**/api/location/search**', async (route) => {
    requests += 1
    if (requests === 1) {
      await route.fulfill({ json: { data: [] } })
    } else if (requests === 2) {
      await route.fulfill({ status: 502, json: { error: { code: 'LOCATION_SEARCH_UNAVAILABLE', message: 'Layanan pencarian lokasi sedang tidak tersedia.' } } })
    } else {
      await route.fulfill({ json: { data: [{ latitude: -6.1752, longitude: 106.8271, displayName: 'Taman Kota, Bandung, Indonesia' }] } })
    }
  })

  const searchButton = page.getByRole('button', { name: 'Cari titik dari lokasi' })
  await searchButton.click()
  await expect(page.getByRole('status')).toContainText('Lokasi belum ditemukan.')
  await searchButton.click()
  await expect(page.locator('.report-location-feedback[role="alert"]')).toContainText('Layanan pencarian lokasi sedang tidak tersedia.')
  await searchButton.click()
  await expect(page.getByRole('button', { name: /Taman Kota, Bandung, Indonesia/ })).toBeVisible()
  expect(requests).toBe(3)
})
