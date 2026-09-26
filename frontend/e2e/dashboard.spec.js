import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

test('Dashboard tình nguyện viên dùng dữ liệu thật và bố cục không tràn màn hình', async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  const { csrfToken } = await (await page.request.get('/api/v1/auth/csrf/')).json()
  const login = await page.request.post('/api/v1/auth/login/', { headers: { 'X-CSRFToken': csrfToken }, data: {
    identifier: process.env.E2E_ATTENDANCE_VOLUNTEER, password: process.env.E2E_ATTENDANCE_PASSWORD,
  } })
  expect(login.status()).toBe(200)
  const response = await page.request.get('/api/v1/reports/volunteer-dashboard/')
  expect(response.status()).toBe(200)
  const data = await response.json()
  await page.goto('/tinh-nguyen-vien')
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible()
  await expect(page.locator('.vd-stat strong')).toHaveText([
    String(data.metrics.registered), String(data.upcoming_count), String(data.metrics.attended_completed),
  ])
  await expect(page.locator('#vd-upcoming .vd-activity-row')).toHaveCount(data.upcoming.length)
  await expect(page.getByText('Sắp ra mắt', { exact: true })).toHaveCount(0)
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-volunteer-dashboard.png`), fullPage: true })
  await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ', exact: true }).click()
  await expect(page).toHaveURL(/\/ho-so$/)
  await page.goto('/tinh-nguyen-vien')
  await page.getByRole('link', { name: 'Đăng ký của tôi', exact: true }).click()
  await expect(page).toHaveURL(/\/tinh-nguyen-vien\/dang-ky$/)
})
