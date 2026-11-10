import { expect, test } from '@playwright/test'

test('pencarian trim mereset halaman, menjaga filter, dan bisa dikosongkan', async ({ page }) => {
  const keyword = `qa-tidak-ada-${Date.now()}`
  let searchRequest: URL | undefined
  let clearRequest: URL | undefined
  await page.setViewportSize({ width: 360, height: 800 })
  await page.route('**/api/categories*', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/reports*', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.has('q')) searchRequest = url
    else if (searchRequest) clearRequest = url
    const requestedPage = Number(url.searchParams.get('page') ?? '1')
    await route.fulfill({
      json: { data: [], meta: { page: requestedPage, limit: 6, total: url.searchParams.has('q') ? 0 : 12 } },
    })
  })
  await page.goto('/laporan?kategori=lampu-jalan&status=VERIFIED&halaman=2')

  const searchbox = page.getByRole('searchbox', { name: 'Cari kode atau judul' })
  await expect(searchbox).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await searchbox.fill(`  ${keyword}  `)

  await expect(page).toHaveURL(new RegExp(`[?&]q=${keyword}`))
  await expect(page.getByRole('heading', { name: 'Tidak ada laporan yang cocok.' })).toBeVisible()
  expect(searchRequest?.searchParams.get('q')).toBe(keyword)
  expect(searchRequest?.searchParams.get('category')).toBe('lampu-jalan')
  expect(searchRequest?.searchParams.get('status')).toBe('VERIFIED')
  expect(searchRequest?.searchParams.get('page')).toBe('1')
  await expect(page).not.toHaveURL(/[?&]halaman=/)

  await searchbox.fill('   ')
  await expect(page.getByText('Menampilkan 1–6 dari 12 laporan')).toBeVisible()
  await expect(page).not.toHaveURL(/[?&]q=/)
  expect(clearRequest?.searchParams.get('category')).toBe('lampu-jalan')
  expect(clearRequest?.searchParams.get('status')).toBe('VERIFIED')
  expect(clearRequest?.searchParams.get('page')).toBe('1')
})

test('respons pencarian lama tidak menggantikan hasil kata kunci terbaru', async ({ page }) => {
  let staleCalls = 0
  let staleResponses = 0
  let releaseStaleResponses: () => void = () => {}
  const staleResponsesFinished = new Promise<void>((resolve) => { releaseStaleResponses = resolve })
  await page.route('**/api/categories*', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/reports*', async (route) => {
    const url = new URL(route.request().url())
    const requestedPage = Number(url.searchParams.get('page') ?? '1')
    if (url.searchParams.get('q') === 'lama') {
      staleCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 800))
      staleResponses += 1
      if (staleResponses === staleCalls) releaseStaleResponses()
      await route.fulfill({ json: { data: [], meta: { page: requestedPage, limit: 6, total: 12 } } })
      return
    }

    await route.fulfill({ json: { data: [], meta: { page: requestedPage, limit: 6, total: 0 } } })
  })
  await page.goto('/laporan?q=lama')

  await expect.poll(() => staleCalls).toBeGreaterThan(0)
  await page.getByRole('searchbox', { name: 'Cari kode atau judul' }).fill('terbaru')
  await expect(page.getByRole('heading', { name: 'Tidak ada laporan yang cocok.' })).toBeVisible()
  await staleResponsesFinished
  await expect(page.getByRole('heading', { name: 'Tidak ada laporan yang cocok.' })).toBeVisible()
  await expect(page.getByText(/Menampilkan \d/)).toHaveCount(0)
})

test('coba lagi mengulang pencarian dan paginasi mempertahankan query serta filter', async ({ page }) => {
  const reportRequests: URL[] = []
  let shouldFail = true
  await page.route('**/api/categories*', (route) => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/reports*', async (route) => {
    const url = new URL(route.request().url())
    reportRequests.push(url)
    if (shouldFail) {
      await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Layanan sedang tidak tersedia.' } } })
      return
    }

    const requestedPage = Number(url.searchParams.get('page') ?? '1')
    await route.fulfill({ json: { data: [], meta: { page: requestedPage, limit: 6, total: 12 } } })
  })
  await page.goto('/laporan?q=jalan&kategori=lampu-jalan&status=VERIFIED&halaman=2')

  await expect(page.getByRole('heading', { name: 'Daftar laporan tidak dapat dimuat' })).toBeVisible()
  const initialRequestCount = reportRequests.length
  const initialSearch = reportRequests[initialRequestCount - 1].search
  shouldFail = false
  await page.getByRole('button', { name: 'Coba lagi' }).click()
  await expect.poll(() => reportRequests.length).toBeGreaterThan(initialRequestCount)
  await expect(page.getByRole('button', { name: 'Halaman 2' })).toBeVisible()
  expect(reportRequests[reportRequests.length - 1].search).toBe(initialSearch)

  await page.getByRole('button', { name: 'Halaman 1' }).click()
  await expect(page).not.toHaveURL(/[?&]halaman=/)
  await expect.poll(() => reportRequests.some((url) => url.searchParams.get('page') === '1')).toBe(true)
  const paginationRequest = reportRequests.filter((url) => url.searchParams.get('page') === '1').pop()
  expect(paginationRequest?.searchParams.get('q')).toBe('jalan')
  expect(paginationRequest?.searchParams.get('category')).toBe('lampu-jalan')
  expect(paginationRequest?.searchParams.get('status')).toBe('VERIFIED')
})
