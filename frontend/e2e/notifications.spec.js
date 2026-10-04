import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function mutate(request, url, data, method = 'post') {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  const response = await request[method](url, { headers: { 'X-CSRFToken': csrfToken }, data })
  expect(response.ok()).toBe(true)
  return response.json()
}

async function account(request, role) {
  return mutate(request, '/api/v1/auth/register/', { email: `notification.${randomUUID()}@example.invalid`,
    full_name: role === 'organizer' ? 'Nhóm tình nguyện' : 'Tình nguyện viên', role,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!' })
}

test('Thông báo nghiệp vụ giữa hai vai trò, đọc, bộ lọc, liên kết và tùy chọn email', async ({ page, browser }, info) => {
  await account(page.request, 'organizer')
  const starts = Date.now() + 7 * 86400000
  const activity = await mutate(page.request, '/api/v1/organizer/activities/', {
    title: 'Ngày hội sẻ chia', description: 'Kết nối cộng đồng', address: 'Huế', capacity: 10,
    starts_at: new Date(starts).toISOString(), ends_at: new Date(starts + 7200000).toISOString(),
  })
  await mutate(page.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' })
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    await account(context.request, 'volunteer')
    const entry = await mutate(context.request, `/api/v1/activities/${activity.id}/participation/`, {})
    await page.goto('/thong-bao')
    await expect(page.getByRole('heading', { name: 'Có đơn đăng ký mới' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Thông báo, 1 chưa đọc', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/nha-to-chuc/hoat-dong/${activity.id}/dang-ky`))
    await expect(page.getByRole('link', { name: 'Thông báo, 0 chưa đọc', exact: true })).toBeVisible()
    await mutate(page.request, `/api/v1/organizer/activities/${activity.id}/applicants/${entry.participation.id}/review/`, { status: 'approved' })
    await mutate(page.request, `/api/v1/organizer/activities/${activity.id}/`, { address: 'Đà Nẵng' }, 'patch')
    const volunteer = await context.newPage()
    await volunteer.goto('/thong-bao')
    await expect(volunteer.getByRole('heading', { name: 'Kết quả xét duyệt đăng ký' })).toBeVisible()
    await expect(volunteer.getByRole('heading', { name: 'Hoạt động thay đổi lịch hoặc địa điểm' })).toBeVisible()
    await expect(volunteer.getByRole('heading', { name: 'Có đơn đăng ký mới' })).toHaveCount(0)
    await volunteer.getByLabel('Nhận thông báo qua email').uncheck()
    await expect(volunteer.getByRole('status')).toContainText('Đã tắt email thông báo.')
    await volunteer.reload()
    await expect(volunteer.getByLabel('Nhận thông báo qua email')).not.toBeChecked()
    await volunteer.getByLabel('Nhận thông báo qua email').check()
    await expect(volunteer.getByRole('status')).toContainText('Đã bật email thông báo.')
    await volunteer.getByLabel('Hiển thị').selectOption('unread')
    await expect(volunteer.getByRole('article')).toHaveCount(2)
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await volunteer.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-notifications.png`), fullPage: true })
    for (const width of [320, 390, 768, 1280]) {
      await volunteer.setViewportSize({ width, height: 900 })
      expect(await volunteer.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    }
    await volunteer.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click()
    await expect(volunteer.getByRole('heading', { name: 'Chưa có thông báo trong danh sách này' })).toBeVisible()
    await expect(volunteer.getByRole('link', { name: 'Thông báo, 0 chưa đọc', exact: true })).toBeVisible()
    await volunteer.getByLabel('Hiển thị').selectOption('read')
    await expect(volunteer.getByRole('article')).toHaveCount(2)
    await volunteer.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().click()
    await expect(volunteer).toHaveURL(new RegExp(`/hoat-dong/${activity.id}$`))
  } finally { await context.close() }
})

test('Trang thông báo xử lý mất kết nối và Admin không có email', async ({ page }) => {
  await mutate(page.request, '/api/v1/auth/login/', { identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD })
  await page.route('**/api/v1/notifications/?*', route => route.abort())
  await page.goto('/thong-bao')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await page.unroute('**/api/v1/notifications/?*')
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByRole('heading', { name: 'Chưa có thông báo trong danh sách này' })).toBeVisible()
  await expect(page.getByText('Tài khoản chưa có email nên hiện chỉ nhận thông báo trong website.')).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toHaveCount(0)
})
