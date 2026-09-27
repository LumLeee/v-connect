import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

test('Hồ sơ mở rộng: lưu, giữ bản nháp, kiểm tra lịch chồng lấn và xóa thông tin', async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  const { csrfToken } = await (await page.request.get('/api/v1/auth/csrf/')).json()
  const register = await page.request.post('/api/v1/auth/register/', { headers: { 'X-CSRFToken': csrfToken }, data: {
    full_name: 'Tình nguyện viên mở rộng', email: `extended.${randomUUID()}@example.invalid`, role: 'volunteer',
    password: 'River-Community-493!', password_confirm: 'River-Community-493!',
  } })
  expect(register.status()).toBe(201)
  let profileWrites = 0
  page.on('request', request => { if (request.method() === 'PATCH' && request.url().includes('/auth/profile/')) profileWrites++ })
  await page.route('**/api/v1/skills/?**', route => route.abort())
  await page.goto('/ho-so')
  await expect(page.getByText('Không kết nối được máy chủ. Vui lòng thử lại.', { exact: true })).toBeVisible()
  await page.unroute('**/api/v1/skills/?**')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  const skills = page.locator('.profile-skill-options input')
  await expect(skills.first()).toBeVisible()
  expect(profileWrites).toBe(0)
  await skills.nth(0).check()
  await skills.nth(1).check()
  await page.getByLabel('Sở thích', { exact: true }).fill('Bảo vệ môi trường\nGiáo dục cộng đồng')
  await page.getByRole('button', { name: 'Thêm khung giờ', exact: true }).click()
  await page.getByLabel('Ngày trong tuần 1', { exact: true }).selectOption('5')
  await page.getByLabel('Giờ bắt đầu 1', { exact: true }).fill('08:30')
  await page.getByLabel('Giờ kết thúc 1', { exact: true }).fill('11:30')
  const refreshed = page.waitForResponse(response => response.url().includes('/auth/me/') && response.status() === 200)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await refreshed
  await expect(page.getByLabel('Sở thích', { exact: true })).toHaveValue('Bảo vệ môi trường\nGiáo dục cộng đồng')
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.profile-skill-options input:checked')).toHaveCount(2)
  await expect(page.getByLabel('Giờ bắt đầu 1', { exact: true })).toHaveValue('08:30')
  await expect(page.getByLabel('Ngày trong tuần 1', { exact: true })).toHaveValue('5')
  await expect(page.getByLabel('Sở thích', { exact: true })).toHaveValue('Bảo vệ môi trường\nGiáo dục cộng đồng')
  await page.getByRole('button', { name: 'Thêm khung giờ', exact: true }).click()
  await page.getByLabel('Ngày trong tuần 2', { exact: true }).selectOption('5')
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Các khung giờ trong cùng ngày không được trùng hoặc chồng lấn.', { exact: true })).toBeVisible()
  const before = await (await page.request.get('/api/v1/auth/profile/')).json()
  expect(before.profile.volunteer.availability).toHaveLength(1)
  await page.getByLabel('Ngày trong tuần 2', { exact: true }).selectOption('6')
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-extended-profile.png`), fullPage: true })
  await page.getByRole('button', { name: 'Bỏ chọn tất cả kỹ năng', exact: true }).click()
  await page.getByLabel('Sở thích', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Xóa khung giờ 2', exact: true }).click()
  await page.getByRole('button', { name: 'Xóa khung giờ 1', exact: true }).click()
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Sở thích', { exact: true })).toHaveValue('')
  await expect(page.locator('.profile-skill-options input:checked')).toHaveCount(0)
  await expect(page.locator('.availability-slot')).toHaveCount(0)
})
