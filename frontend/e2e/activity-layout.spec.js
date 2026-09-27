import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

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

test('Bố cục danh sách và chi tiết hoạt động giữ tìm kiếm, điều hướng và thông tin tham gia', async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  const id = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].upcoming.activity
  const response = await page.request.get(`/api/v1/activities/${id}/`)
  expect(response.status()).toBe(200)
  const activity = await response.json()
  await page.goto('/hoat-dong')
  await expect(page.locator('.activity-card').first()).toBeVisible()
  await capture(page, info, 'activity-browser-layout')
  await page.getByLabel('Tìm theo tên hoạt động', { exact: true }).fill(activity.title)
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.locator('.activity-card')).toHaveCount(1)
  await page.getByRole('link', { name: 'Xem chi tiết', exact: true }).click()
  await expect(page.getByRole('heading', { name: activity.title, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Thông tin tham gia', exact: true })).toBeVisible()
  await expect(page.getByText('bằng tài khoản Tình nguyện viên để đăng ký tham gia.', { exact: false })).toBeVisible()
  await capture(page, info, 'activity-detail-layout')
  await page.getByRole('link', { name: '← Danh sách hoạt động', exact: true }).click()
  await page.getByLabel('Tìm theo tên hoạt động', { exact: true }).fill('không có hoạt động này')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.locator('.activity-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click()
  await expect(page.locator('.activity-card').first()).toBeVisible()
})
