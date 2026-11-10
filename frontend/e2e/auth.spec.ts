import { expect, test } from '@playwright/test'

test('form login dan registrasi tersedia', async ({ page }) => {
  await page.goto('/masuk')
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible()
  await expect(page.getByLabel('Alamat email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()

  await page.getByRole('link', { name: 'Daftar' }).click()
  await expect(page).toHaveURL(/\/daftar$/)
  await expect(page.getByRole('heading', { name: 'Buat akun pelapor' })).toBeVisible()
  await expect(page.getByLabel('Nama lengkap')).toBeVisible()
})

test('pelapor yang belum login diarahkan ke form login', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/masuk$/)
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible()

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/masuk$/)
})
