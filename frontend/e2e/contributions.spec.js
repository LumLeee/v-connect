import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function login(request, identifier) {
  expect((await post(request, '/api/v1/auth/login/', { identifier, password: process.env.E2E_ATTENDANCE_PASSWORD })).status()).toBe(200)
}
async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${name} ${width}px`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Xác nhận và điều chỉnh đóng góp, tổng cá nhân, lịch sử và chống sửa đè', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  await login(page.request, process.env.E2E_ATTENDANCE_ORGANIZER)
  await page.goto(`/nha-to-chuc/hoat-dong/${activity}`)
  await page.getByRole('link', { name: 'Xác nhận giờ đóng góp', exact: true }).click()
  await expect(page.getByText('Chờ Nhà tổ chức xác nhận số phút.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xác nhận đóng góp', exact: true }).click()
  await page.getByLabel('Số phút đóng góp', { exact: true }).fill('45')
  await page.getByRole('button', { name: 'Lưu đóng góp', exact: true }).click()
  await expect(page.getByText('Đã lưu số phút đóng góp và lịch sử xác nhận.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Điều chỉnh đóng góp', exact: true }).click()
  await page.getByLabel('Số phút đóng góp', { exact: true }).fill('30')
  await expect(page.getByRole('button', { name: 'Lưu đóng góp', exact: true })).toBeDisabled()
  await page.getByLabel('Lý do điều chỉnh (bắt buộc)', { exact: true }).fill('Đối chiếu lại thời gian tham gia thực tế.')
  await capture(page, info, 'contribution-editor')
  await page.getByRole('button', { name: 'Lưu đóng góp', exact: true }).click()
  await expect(page.getByText('Được công nhận:', { exact: false })).toContainText('0 giờ 30 phút')
  const list = await (await page.request.get(`/api/v1/organizer/activities/${activity}/contributions/`)).json()
  expect((await post(page.request, `/api/v1/organizer/activities/${activity}/contributions/${list.results[0].id}/`, { minutes: 20, revision: 1, reason: 'Phiên cũ' })).status()).toBe(400)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    await login(context.request, process.env.E2E_ATTENDANCE_VOLUNTEER)
    const volunteer = await context.newPage()
    await volunteer.goto('/tinh-nguyen-vien/dong-gop')
    const summary = await (await context.request.get('/api/v1/contributions/')).json()
    await expect(volunteer.locator('.contribution-summary strong').first()).toHaveText(`${Math.floor(summary.summary.minutes / 60)} giờ ${summary.summary.minutes % 60} phút`)
    await volunteer.locator('article').filter({ has: volunteer.getByRole('heading', { name: `Hoạt động điểm danh feedback ${info.project.name}`, exact: true }) }).getByRole('button', { name: 'Xem lịch sử điều chỉnh' }).click()
    await expect(volunteer.getByText('Lý do: Đối chiếu lại thời gian tham gia thực tế.', { exact: true })).toBeVisible()
    await capture(volunteer, info, 'contribution-history')
    expect((await post(context.request, `/api/v1/organizer/activities/${activity}/contributions/${list.results[0].id}/`, { minutes: 20, revision: 2, reason: 'Sai vai trò' })).status()).toBe(403)
  } finally { await context.close() }
})

test('Đóng góp: chặn khách và thử lại khi lỗi mạng', async ({ page }) => {
  await page.goto('/tinh-nguyen-vien/dong-gop')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await login(page.request, process.env.E2E_ATTENDANCE_VOLUNTEER)
  await page.route('**/api/v1/contributions/?*', route => route.abort())
  await page.goto('/tinh-nguyen-vien/dong-gop')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await page.unroute('**/api/v1/contributions/?*')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.contribution-summary')).toBeVisible()
})
