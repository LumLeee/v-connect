import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}

async function register(request, name, role = 'organizer') {
  const response = await post(request, '/api/v1/auth/register/', { email: `report.${randomUUID()}@example.invalid`,
    full_name: name, role, password: 'River-Community-493!', password_confirm: 'River-Community-493!' })
  expect(response.status()).toBe(201)
  return (await (await request.get('/api/v1/auth/me/')).json()).user
}

async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Organizer lọc báo cáo, xuất Excel và in đủ các trang hoạt động', async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  await register(page.request, `Nhóm báo cáo ${info.project.name}`)
  const prefix = `Báo cáo xanh ${randomUUID()}`
  const day = `${new Date().getFullYear() + 1}-02-10`
  const { csrfToken } = await (await page.request.get('/api/v1/auth/csrf/')).json()
  for (let index = 0; index < 21; index++) {
    const response = await page.request.post('/api/v1/organizer/activities/', { headers: { 'X-CSRFToken': csrfToken }, data: {
      title: `${prefix} ${index + 1}`, description: 'Hoạt động kiểm tra báo cáo', address: 'Huế', capacity: 10,
      starts_at: `${day}T08:00:00+07:00`, ends_at: `${day}T12:00:00+07:00`,
    } })
    expect(response.status()).toBe(201)
  }
  await page.goto('/bao-cao')
  await expect(page.getByRole('heading', { name: 'Báo cáo', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Theo hoạt động', exact: true }).click()
  await expect(page.getByRole('heading', { name: '21 hoạt động', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Nhà tổ chức', exact: true })).toHaveCount(0)
  await page.getByLabel('Tên hoạt động', { exact: true }).fill(prefix)
  await page.getByLabel('Ngày bắt đầu từ', { exact: true }).fill(day)
  await page.getByLabel('Ngày bắt đầu đến', { exact: true }).fill(day)
  await page.getByRole('combobox', { name: 'Trạng thái hoạt động', exact: true }).selectOption('draft')
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect(page.getByRole('heading', { name: '21 hoạt động', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(prefix)
  await expect(page.getByRole('button', { name: 'Theo hoạt động', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.organizer-report-row:visible')).toHaveCount(12)
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.organizer-report-row:visible')).toHaveCount(9)
  await page.getByRole('button', { name: 'Biểu đồ', exact: true }).click()
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(prefix)
  await expect(page.locator('.organizer-report-row:visible')).toHaveCount(0)
  const exportRequestPromise = page.waitForRequest(request => request.url().includes('/reports/analytics/export/'))
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click()
  const download = await downloadPromise
  const exportParams = new URL((await exportRequestPromise).url()).searchParams
  expect(exportParams.get('search')).toBe(prefix)
  expect(exportParams.get('status')).toBe('draft')
  expect(exportParams.get('date_from')).toBe(day)
  expect(exportParams.get('date_to')).toBe(day)
  expect(exportParams.has('tab')).toBe(false)
  expect(exportParams.has('report_page')).toBe(false)
  expect(download.suggestedFilename()).toBe('v-connect-bao-cao.xlsx')
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await download.saveAs(path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-report.xlsx`))
  await page.evaluate(() => { window.__reportPrintCalled = false; window.print = () => { window.__reportPrintCalled = true } })
  await page.getByRole('button', { name: 'In / Lưu PDF', exact: true }).click()
  expect(await page.evaluate(() => window.__reportPrintCalled)).toBe(true)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.organizer-report-row:visible')).toHaveCount(21)
  await expect(page.getByRole('heading', { name: 'Trạng thái đăng ký', exact: true })).toBeVisible()
  await expect(page.locator('.analytics-filters')).not.toBeVisible()
  await expect(page.locator('.site-header')).not.toBeVisible()
  await page.pdf({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-report.pdf`), preferCSSPageSize: true, printBackground: true })
  await page.emulateMedia({ media: 'screen' })
  await capture(page, info, 'report-extended-organizer')
  await page.getByLabel('Ngày bắt đầu đến', { exact: true }).fill(`${new Date().getFullYear()}-01-01`)
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Ngày đến phải bằng hoặc sau ngày từ.')
  await expect(page.getByRole('button', { name: 'Xuất Excel', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Xuất Excel', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Biểu đồ', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Không có kết quả này')
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect(page.getByText('Chưa có dữ liệu phù hợp với bộ lọc.', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Theo hoạt động', exact: true }).click()
  await expect(page.getByRole('heading', { name: '21 hoạt động', exact: true })).toBeVisible()
})

test('Admin lọc Nhà tổ chức; Volunteer và Guest không được xuất báo cáo quản lý', async ({ page, browser }, info) => {
  const other = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await register(other.request, 'Người xem', 'volunteer')
    for (const endpoint of ['analytics/', 'analytics/export/', 'organizers/']) {
      expect((await other.request.get(`/api/v1/reports/${endpoint}`)).status()).toBe(403)
      expect((await page.request.get(`/api/v1/reports/${endpoint}`)).status()).toBe(401)
    }
    const response = await post(page.request, '/api/v1/auth/login/', { identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD })
    expect(response.status()).toBe(200)
    const fixture = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
    const options = (await (await page.request.get('/api/v1/reports/organizers/?page_size=100')).json()).results
    let owner
    for (const option of options) {
      const result = await (await page.request.get(`/api/v1/reports/analytics/?organizer=${option.id}`)).json()
      if (result.rows.some(row => row.id === fixture.activity)) { owner = option; break }
    }
    expect(owner).toBeTruthy()
    await page.goto('/bao-cao/mo-rong')
    await page.getByRole('combobox', { name: 'Nhà tổ chức', exact: true }).selectOption(owner.id)
    await page.getByRole('combobox', { name: 'Trạng thái hoạt động', exact: true }).selectOption('completed')
    await page.getByRole('button', { name: 'Áp dụng', exact: true }).click()
    const result = await (await page.request.get(`/api/v1/reports/analytics/?organizer=${owner.id}&status=completed`)).json()
    const total = page.locator('.ad-report-summary article').filter({ has: page.getByRole('heading', { name: 'Đơn đăng ký', exact: true }) })
    await expect(total.locator('strong')).toHaveText(String(result.metrics.registered))
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Nhà tổ chức', exact: true })).toHaveValue(owner.id)
    await expect(page.locator('.ad-report-context')).toContainText(owner.name)
    await capture(page, info, 'report-extended-admin')
  } finally { await other.close() }
})
