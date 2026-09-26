import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function login(request, identifier, password = process.env.E2E_ATTENDANCE_PASSWORD) {
  expect((await post(request, '/api/v1/auth/login/', { identifier, password })).status()).toBe(200)
}
async function evidence(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Thống kê Volunteer khớp danh sách và Organizer xem kết quả đúng hoạt động', async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  await login(page.request, process.env.E2E_ATTENDANCE_VOLUNTEER)
  const overview = await (await page.request.get('/api/v1/reports/overview/')).json()
  await page.goto('/tinh-nguyen-vien')
  await page.getByRole('link', { name: 'Xem thống kê', exact: true }).click()
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Đã tham gia (hoàn thành)', exact: true }) })
  await expect(card.locator('.lead')).toHaveText(String(overview.metrics.attended_completed))
  await evidence(page, info, 'report-volunteer')
  await card.getByRole('link').click()
  await expect(page.getByText(`${overview.metrics.attended_completed} đơn đăng ký.`, { exact: true })).toBeVisible()
  expect((await page.request.get('/api/v1/reports/activities/')).status()).toBe(403)
  await post(page.request, '/api/v1/auth/logout/', {})
  await login(page.request, process.env.E2E_ATTENDANCE_ORGANIZER)
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  await page.goto(`/nha-to-chuc/hoat-dong/${activity}`)
  await page.getByRole('link', { name: 'Xem kết quả hoạt động', exact: true }).click()
  const result = await (await page.request.get(`/api/v1/reports/activities/${activity}/`)).json()
  await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: 'Tổng đơn đăng ký', exact: true }) }).locator('.lead')).toHaveText(String(result.metrics.registered))
  await evidence(page, info, 'report-activity')
  await page.getByRole('link', { name: 'Xem chi tiết: tổng đơn đăng ký', exact: true }).click()
  await expect(page.getByText(`${result.metrics.registered} đơn đăng ký.`, { exact: true })).toBeVisible()
})

test('Admin khóa, mở khóa, lưu lý do và phiên cũ không được khôi phục', async ({ page, browser }, info) => {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  const email = `lock.${randomUUID()}@example.invalid`
  const password = 'River-Community-493!'
  try {
    const account = await post(context.request, '/api/v1/auth/register/', { email, full_name: 'Tài khoản kiểm tra khóa', role: 'volunteer', password, password_confirm: password })
    expect(account.status()).toBe(201)
    await login(page.request, process.env.E2E_ADMIN_USERNAME, process.env.E2E_ADMIN_PASSWORD)
    await page.goto('/quan-tri')
    await page.getByRole('link', { name: 'Quản lý tài khoản', exact: true }).click()
    await page.getByLabel('Tìm họ tên, email hoặc username', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Lọc tài khoản', exact: true }).click()
    await expect(page.getByText('1 tài khoản.', { exact: true })).toBeVisible()
    await page.locator('article').filter({ hasText: email }).getByRole('button', { name: 'Khóa tài khoản', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Xác nhận thay đổi', exact: true })).toBeDisabled()
    const reason = `Kiểm tra trạng thái ${info.project.name}`
    await page.getByLabel('Lý do thay đổi trạng thái', { exact: true }).fill(reason)
    await page.getByRole('button', { name: 'Xác nhận thay đổi', exact: true }).click()
    await expect(page.getByText('Trạng thái: Bị khóa', { exact: true })).toBeVisible()
    await evidence(page, info, 'admin-accounts')
    await page.getByRole('button', { name: 'Mở khóa tài khoản', exact: true }).click()
    await page.getByLabel('Lý do thay đổi trạng thái', { exact: true }).fill('Đã xử lý')
    await page.getByRole('button', { name: 'Xác nhận thay đổi', exact: true }).click()
    await expect(page.getByText('Trạng thái: Hoạt động', { exact: true })).toBeVisible()
    // This client made no request while locked: its old session still must fail.
    expect((await context.request.get('/api/v1/auth/me/')).status()).toBe(401)
    await login(context.request, email, password)
    expect((await context.request.get('/api/v1/auth/me/')).status()).toBe(200)
    expect((await context.request.get('/api/v1/admin/accounts/')).status()).toBe(403)
    await page.getByRole('link', { name: 'Xem nhật ký thao tác', exact: true }).click()
    await page.getByLabel('Loại thao tác', { exact: true }).selectOption('account_locked')
    await expect(page.getByText(`Lý do: ${reason}`, { exact: true })).toBeVisible()
    await evidence(page, info, 'admin-audit')
  } finally { await context.close() }
})
