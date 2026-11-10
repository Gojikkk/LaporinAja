import { expect, test } from '@playwright/test'

test('beranda dan navigasi ke laporan publik tersedia', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Laporan warga/ })).toBeVisible()

  await page.getByRole('link', { name: 'Jelajahi laporan' }).click()
  await expect(page).toHaveURL(/\/laporan$/)
  await expect(page.getByRole('heading', { name: 'Laporan warga', exact: true })).toBeVisible()
})

test('filter kata kunci memperbarui URL dan menampilkan empty state', async ({ page }) => {
  const keyword = `qa-tidak-ada-${Date.now()}`
  await page.goto('/laporan')

  await page.getByRole('searchbox').fill(keyword)
  await page.getByRole('button', { name: 'Terapkan filter' }).click()

  await expect(page).toHaveURL(new RegExp(`[?&]q=${keyword}`))
  await expect(page.getByRole('heading', { name: 'Tidak ada laporan yang cocok' })).toBeVisible()
})

test('statistik publik menampilkan ringkasan laporan', async ({ page }) => {
  await page.goto('/statistik')

  await expect(page.getByRole('heading', { name: 'Statistik laporan', exact: true })).toBeVisible()
  await expect(page.getByText('Laporan publik', { exact: true })).toBeVisible()
  await expect(page.getByText('Kategori terpakai', { exact: true })).toBeVisible()
})

test('detail laporan yang tidak dikenal menampilkan pesan yang sesuai', async ({ page }) => {
  await page.goto('/laporan/QA-TIDAK-DITEMUKAN')

  await expect(page.getByRole('heading', { name: 'Laporan tidak ditemukan' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Kembali ke daftar laporan' })).toBeVisible()
})

test('halaman tentang dan privasi dapat dibuka', async ({ page }) => {
  await page.goto('/tentang')
  await expect(page.getByRole('main')).toBeVisible()

  await page.goto('/kebijakan-privasi')
  await expect(page.getByRole('main')).toBeVisible()
})

test('halaman akses ditolak dan 404 memiliki pesan yang jelas', async ({ page }) => {
  await page.goto('/403')
  await expect(page.getByRole('heading', { name: 'Akses tidak tersedia' })).toBeVisible()

  await page.goto('/qa-rute-tidak-dikenal')
  await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible()
})
