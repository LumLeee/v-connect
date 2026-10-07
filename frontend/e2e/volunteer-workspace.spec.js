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
  return post(request, '/api/v1/auth/register/', { full_name: role === 'volunteer' ? 'Nguyễn An Cộng Đồng' : 'Nhóm Sẻ Chia',
    email: `volunteer-ui.${randomUUID()}@example.invalid`, role, password: 'River-Community-493!', password_confirm: 'River-Community-493!' })
}

test('Không gian Tình nguyện viên: các trang, lịch sử thật và gửi đánh giá bằng sao', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const organizer = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await register(organizer.request, 'organizer')
    await register(page.request, 'volunteer')
    const start = Date.now() + 2 * 86400000
    const activity = await post(organizer.request, '/api/v1/organizer/activities/', { title: 'Ngày xanh cùng cộng đồng',
      description: 'Cùng chăm sóc cây xanh và kết nối với những người bạn mới.', address: 'Công viên bên sông, Huế', capacity: 20,
      starts_at: new Date(start).toISOString(), ends_at: new Date(start + 3600000).toISOString() })
    await post(organizer.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' })
    const entry = await post(page.request, `/api/v1/activities/${activity.id}/participation/`, {})
    await post(organizer.request, `/api/v1/organizer/activities/${activity.id}/applicants/${entry.participation.id}/review/`, { status: 'approved' })
    const headers = instant => ({ 'X-E2E-Time': new Date(instant).toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY })
    await organizer.setExtraHTTPHeaders(headers(start + 60000))
    await post(organizer.request, `/api/v1/organizer/activities/${activity.id}/attendance/${entry.participation.id}/`, {})
    await organizer.setExtraHTTPHeaders(headers(start + 3660000))
    await post(organizer.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'completed' })
    await page.context().setExtraHTTPHeaders(headers(start + 3660000))
    await page.clock.setFixedTime(new Date(start + 3660000))
    const pages = [
      ['/tinh-nguyen-vien', 'Tổng quan', 'Tổng quan', 'dashboard'],
      ['/hoat-dong', 'Khám phá hoạt động', 'Khám phá', 'activities'],
      [`/hoat-dong/${activity.id}`, activity.title, 'Khám phá', 'detail'],
      ['/tinh-nguyen-vien/dang-ky', 'Đăng ký của tôi', 'Quản lý đăng ký', 'registrations'],
      ['/tinh-nguyen-vien/lich-su', 'Lịch sử tham gia', 'Lịch sử hoạt động', 'history'],
      ['/tinh-nguyen-vien/check-in', 'Điểm danh của tôi', 'Điểm danh của tôi', 'checkin-hub'],
      [`/hoat-dong/${activity.id}/check-in`, 'Check-in hoạt động', 'Điểm danh của tôi', 'checkin'],
      ['/tinh-nguyen-vien/phan-hoi', 'Đánh giá hoạt động', 'Đánh giá hoạt động', 'feedback-hub'],
      [`/hoat-dong/${activity.id}/phan-hoi`, 'Phản hồi của tôi', 'Đánh giá hoạt động', 'feedback'],
      ['/ho-so', 'Hồ sơ của tôi', 'Hồ sơ cá nhân', 'profile'],
      ['/thong-bao', 'Thông báo', 'Thông báo', 'notifications'],
      ['/bao-cao', 'Thống kê của tôi', 'Thống kê', 'reports'],
    ]
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    for (const [url, heading, active, name] of pages) {
      await page.goto(url)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expect(page.getByText('Đang tải dữ liệu…', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('navigation', { name: 'Điều hướng Tình nguyện viên' }).getByRole('link', { name: active, exact: true })).toHaveAttribute('aria-current', 'page')
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${url} at ${width}px`).toBe(true)
      }
      await page.setViewportSize(info.project.use.viewport)
      await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-volunteer-${name}.png`), fullPage: true })
    }
    await page.goto('/tinh-nguyen-vien/phan-hoi')
    await page.getByRole('link', { name: 'Gửi hoặc xem phản hồi của tôi', exact: true }).click()
    await page.getByRole('button', { name: '5 sao', exact: true }).click()
    await expect(page.getByLabel('Điểm đánh giá (1–5)', { exact: true })).toHaveValue('5')
    await page.getByLabel('Nội dung phản hồi', { exact: true }).fill('Hoạt động thiết thực, mọi người hỗ trợ nhau rất tốt.')
    await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
    await expect(page.getByText('Bạn đã gửi phản hồi cho hoạt động này.', { exact: true })).toBeVisible()
    await page.goto('/tinh-nguyen-vien/lich-su')
    await expect(page.getByText('Đã xác nhận có mặt', { exact: true })).toBeVisible()
    await page.goto('/')
    await expect(page.locator('.site-header')).toBeVisible()
    await expect(page.locator('.vs-shell')).toHaveCount(0)
  } finally { await organizer.close() }
})

test('Danh sách cá nhân: lỗi có thể thử lại, trạng thái trống và chặn khách', async ({ page }) => {
  await page.goto('/tinh-nguyen-vien/check-in')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await register(page.request, 'volunteer')
  await page.route('**/api/v1/participations/history/?*', route => route.abort())
  await page.goto('/tinh-nguyen-vien/phan-hoi')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await page.unroute('**/api/v1/participations/history/?*')
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText('Chưa có hoạt động được xác nhận có mặt.', { exact: true })).toBeVisible()
})
