import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  const response = await request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
  expect(response.ok()).toBe(true)
  return response.json()
}

async function register(request, role) {
  return post(request, '/api/v1/auth/register/', { email: `overview.${randomUUID()}@example.invalid`,
    full_name: role === 'organizer' ? 'Nhóm Kết nối cộng đồng' : 'Nguyễn Minh An', role,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!' })
}

test('Tổng quan Nhà tổ chức: dữ liệu thật, xét duyệt, điểm danh và bố cục responsive', async ({ page, browser }, info) => {
  await register(page.request, 'organizer')
  const now = Date.now()
  const activities = []
  for (const [index, title] of ['Ngày hội xanh vì cộng đồng', 'Lớp học sẻ chia cuối tuần'].entries()) {
    const starts = now + (index + 1) * 86400000
    const activity = await post(page.request, '/api/v1/organizer/activities/', { title,
      description: 'Cùng chung tay mang lại những giá trị tốt đẹp cho cộng đồng.',
      address: 'Trung tâm sinh hoạt cộng đồng, thành phố Huế', capacity: 30,
      starts_at: new Date(starts).toISOString(), ends_at: new Date(starts + 7200000).toISOString() })
    await post(page.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' })
    activities.push(activity)
  }
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await register(context.request, 'volunteer')
    for (const activity of activities) {
      await post(context.request, `/api/v1/activities/${activity.id}/participation/`, {})
    }
    // Advance only this test's clock; the first activity is now live and its pending entry is no longer actionable.
    const instant = new Date(now + 86400000 + 60000)
    await page.context().setExtraHTTPHeaders({ 'X-E2E-Time': instant.toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY })
    await page.clock.setFixedTime(instant)
    await page.goto('/nha-to-chuc')
    await expect(page.getByTestId('od-total')).toHaveText('2')
    await expect(page.getByTestId('od-pending-count')).toHaveText('1')
    await expect(page.getByTestId('od-completed')).toHaveText('0')
    await expect(page.getByRole('heading', { name: activities[0].title })).toBeVisible()
    await expect(page.getByRole('heading', { name: activities[1].title })).toBeVisible()
    await expect(page.locator('.od-pending-list')).toContainText('Nguyễn Minh An')
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-organizer-overview.png`), fullPage: true })
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    }
    await page.getByRole('link', { name: 'Điểm danh', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${activities[0].id}/diem-danh$`))
    await page.goto('/nha-to-chuc/')
    await expect(page.locator('.site-header')).toHaveCount(0)
    await page.getByRole('link', { name: 'Xem đơn đăng ký', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${activities[1].id}/dang-ky$`))
  } finally { await context.close() }
})

test('Tổng quan Nhà tổ chức: trạng thái trống, lỗi mạng và thử lại', async ({ page }) => {
  await register(page.request, 'organizer')
  await page.route('**/api/v1/reports/organizer-dashboard/', route => route.abort())
  await page.goto('/nha-to-chuc')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.getByTestId('od-total')).toHaveCount(0)
  await page.unroute('**/api/v1/reports/organizer-dashboard/')
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByTestId('od-total')).toHaveText('0')
  await expect(page.getByText('Chưa có hoạt động đang diễn ra', { exact: true })).toBeVisible()
  await expect(page.getByText('Không có đơn cần xét duyệt', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ', exact: true }).click()
  await expect(page).toHaveURL(/\/ho-so$/)
})
