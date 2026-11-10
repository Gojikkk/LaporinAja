import { expect, test } from '@playwright/test'

const runMutatingTests = process.env.PLAYWRIGHT_RUN_MUTATING === '1'
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD

test.describe('admin read-only', () => {
  test.skip(!adminEmail || !adminPassword, 'Set PLAYWRIGHT_ADMIN_EMAIL dan PLAYWRIGHT_ADMIN_PASSWORD untuk tes admin.')

  test('dashboard statistik dan ekspor antrean laporan tersedia', async ({ page }) => {
    await page.goto('/masuk')
    await page.getByLabel('Alamat email').fill(adminEmail!)
    await page.getByLabel('Password').fill(adminPassword!)
    await page.getByRole('button', { name: 'Masuk' }).click()
    await expect(page).toHaveURL(/\/admin$/)

    await page.goto('/admin/statistik')
    await expect(page.getByRole('heading', { name: 'Statistik laporan', exact: true })).toBeVisible()

    await page.goto('/admin/laporan')
    await expect(page.getByRole('heading', { name: 'Manajemen Laporan' })).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Ekspor CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/i)
  })
})

test.describe('alur mutasi staging', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!runMutatingTests, 'Aktifkan dengan PLAYWRIGHT_RUN_MUTATING=1 pada database staging khusus QA.')
  test.skip(!adminEmail || !adminPassword, 'Set PLAYWRIGHT_ADMIN_EMAIL dan PLAYWRIGHT_ADMIN_PASSWORD untuk tes admin.')

  test('pelapor membuat laporan lalu admin memverifikasi dan menutupnya', async ({ browser, page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const email = `qa-${suffix}@example.test`
    const password = `Qa-${suffix}-Password1!`
    const title = `QA jalan rusak ${suffix}`

    await page.goto('/daftar')
    await page.getByLabel('Nama lengkap').fill(`Pelapor QA ${suffix}`)
    await page.getByLabel('Alamat email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Buat akun' }).click()
    await expect(page).toHaveURL(/\/masuk$/)

    await page.getByLabel('Alamat email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Masuk' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.goto('/lapor/baru')
    await page.getByLabel('Kategori').selectOption({ index: 1 })
    await page.getByLabel('Judul laporan').fill(title)
    await page.getByLabel('Deskripsi').fill('Jalan berlubang cukup dalam dan mengganggu kendaraan yang melintas setiap hari.')
    await page.getByLabel('Kota/kabupaten').fill('Kota QA')
    await page.getByLabel('Kecamatan').fill('Kecamatan QA')
    await page.getByLabel('Kelurahan/desa').fill('Kelurahan QA')
    await page.getByLabel('Patokan lokasi').fill('Dekat taman kota')
    await page.getByLabel('Pilih foto dari perangkat').setInputFiles({
      name: 'qa.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=', 'base64'),
    })
    await page.getByRole('button', { name: 'Kirim laporan' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const reportLink = page.getByRole('link', { name: new RegExp(title) })
    await expect(reportLink).toBeVisible()
    const reportPath = await reportLink.getAttribute('href')
    const reportCode = reportPath?.split('/').at(-1)
    expect(reportCode).toBeTruthy()

    const adminContext = await browser.newContext()
    try {
      const adminPage = await adminContext.newPage()
      await adminPage.goto('/masuk')
      await adminPage.getByLabel('Alamat email').fill(adminEmail!)
      await adminPage.getByLabel('Password').fill(adminPassword!)
      await adminPage.getByRole('button', { name: 'Masuk' }).click()
      await expect(adminPage).toHaveURL(/\/admin$/)

      await adminPage.goto(`/admin/laporan/${reportCode}`)
      await expect(adminPage.getByRole('heading', { name: title })).toBeVisible()

      await adminPage.getByRole('button', { name: 'Verifikasi laporan' }).click()
      const verifyDialog = adminPage.locator('dialog[open]')
      await verifyDialog.getByRole('checkbox').check()
      await verifyDialog.getByRole('button', { name: 'Verifikasi laporan' }).click()

      await adminPage.getByRole('button', { name: 'Mulai tindak lanjut' }).click()
      const followUpDialog = adminPage.locator('dialog[open]')
      await followUpDialog.getByLabel('Rencana tindakan *').fill('Petugas akan memeriksa kondisi jalan minggu ini.')
      await followUpDialog.getByRole('button', { name: 'Mulai tindak lanjut' }).click()

      await adminPage.getByRole('button', { name: 'Catat penyelesaian' }).click()
      const resolveDialog = adminPage.locator('dialog[open]')
      await resolveDialog.getByLabel('Catatan hasil *').fill('Perbaikan jalan telah selesai dilakukan oleh petugas lapangan.')
      await resolveDialog.getByLabel('Penjelasan tanpa foto').fill('Bukti foto tindak lanjut belum tersedia pada pengujian QA ini.')
      await resolveDialog.getByRole('button', { name: 'Catat penyelesaian' }).click()

      await adminPage.goto(`/laporan/${reportCode}`)
      await expect(adminPage.getByRole('heading', { name: title })).toBeVisible()
      await expect(adminPage.getByText('Bukti penyelesaian')).toBeVisible()

      await page.goto('/dashboard')
      await page.getByRole('button', { name: 'Notifikasi' }).click()
      const notification = page.locator('.notif-menu li').first()
      await expect(notification).toBeVisible()
      await notification.getByRole('link').click()
      await expect(page).toHaveURL(new RegExp(`/dashboard/laporan/${reportCode}`))
      await expect(page.getByRole('heading', { name: title })).toBeVisible()
    } finally {
      await adminContext.close()
    }
  })

  test('admin dapat mengubah kategori dan menonaktifkannya', async ({ page }) => {
    await page.goto('/masuk')
    await page.getByLabel('Alamat email').fill(adminEmail!)
    await page.getByLabel('Password').fill(adminPassword!)
    await page.getByRole('button', { name: 'Masuk' }).click()
    await expect(page).toHaveURL(/\/admin$/)

    await page.goto('/admin/kategori')
    await expect(page.getByRole('heading', { name: 'Kelola kategori laporan.' })).toBeVisible()

    const suffix = `${Date.now()}`
    const initialName = `QA Kategori ${suffix}`
    const updatedName = `QA Ubah ${suffix}`
    await page.getByRole('button', { name: 'Tambah kategori' }).click()
    const dialog = page.locator('dialog[open]')
    await dialog.getByLabel('Nama kategori *').fill(initialName)
    await dialog.getByLabel('Slug *').fill(`qa-kategori-${suffix}`)
    await dialog.getByRole('button', { name: 'Simpan kategori' }).click()

    const categoryCard = page.locator('.adm-cat-card').filter({ has: page.getByRole('heading', { name: initialName }) })
    await expect(categoryCard).toBeVisible()
    await categoryCard.getByRole('button', { name: `Kelola kategori ${initialName}` }).click()
    const editDialog = page.locator('dialog[open]')
    await editDialog.getByLabel('Nama kategori *').fill(updatedName)
    await editDialog.getByLabel('Slug *').fill(`qa-ubah-${suffix}`)
    await editDialog.getByRole('button', { name: 'Simpan perubahan' }).click()

    const updatedCard = page.locator('.adm-cat-card').filter({ has: page.getByRole('heading', { name: updatedName }) })
    await expect(updatedCard).toBeVisible()
    await updatedCard.getByRole('button', { name: 'Nonaktifkan' }).click()
    await expect(updatedCard.getByText('Nonaktif', { exact: true })).toBeVisible()
  })
})
