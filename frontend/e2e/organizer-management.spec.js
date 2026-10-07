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

async function register(request, role, name) {
  return post(request, '/api/v1/auth/register/', { email: `management.${randomUUID()}@example.invalid`, full_name: name,
    role, password: 'River-Community-493!', password_confirm: 'River-Community-493!' })
}

test('Các trang quản lý dùng chung điều hướng, dữ liệu và bố cục responsive', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  await register(page.request, 'organizer', 'Nhóm tình nguyện Kết Nối')
  const start = Date.now() + 86400000
  const activity = await post(page.request, '/api/v1/organizer/activities/', { title: 'Chung tay làm xanh khu phố',
    description: 'Cùng dọn vệ sinh, trồng cây và chăm sóc không gian chung của cộng đồng.', address: 'Nhà văn hóa phường, thành phố Huế', capacity: 25,
    starts_at: new Date(start).toISOString(), ends_at: new Date(start + 3600000).toISOString() })
  await post(page.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' })
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await register(context.request, 'volunteer', 'Nguyễn An Tình Nguyện')
    const entry = await post(context.request, `/api/v1/activities/${activity.id}/participation/`, {})
    const base = `/nha-to-chuc/hoat-dong/${activity.id}`
    const pages = [
      ['/nha-to-chuc/hoat-dong', 'Hoạt động của tôi', 'Quản lý hoạt động', 'activities'],
      ['/nha-to-chuc/hoat-dong/tao', 'Tạo hoạt động', 'Quản lý hoạt động', 'create'],
      [`${base}/sua`, 'Chỉnh sửa hoạt động', 'Quản lý hoạt động', 'edit'],
      [base, activity.title, 'Quản lý hoạt động', 'detail'],
      ['/nha-to-chuc/dang-ky', 'Quản lý đơn đăng ký', 'Đơn đăng ký', 'registration-hub'],
      [`${base}/dang-ky`, 'Danh sách đăng ký', 'Đơn đăng ký', 'registrations'],
      ['/nha-to-chuc/diem-danh', 'Quản lý điểm danh', 'Quản lý điểm danh', 'attendance-hub'],
      [`${base}/diem-danh`, 'Điểm danh người tham gia', 'Quản lý điểm danh', 'attendance'],
      ['/nha-to-chuc/phan-hoi', 'Phản hồi từ người tham gia', 'Phản hồi hoạt động', 'feedback-hub'],
      [`${base}/phan-hoi`, 'Phản hồi hoạt động', 'Phản hồi hoạt động', 'feedback'],
      ['/bao-cao', 'Thống kê của tôi', 'Báo cáo', 'reports'],
      ['/bao-cao/mo-rong', 'Báo cáo mở rộng', 'Báo cáo', 'analytics'],
      ['/ho-so', 'Hồ sơ của tôi', 'Chỉnh sửa hồ sơ', 'profile'],
      ['/thong-bao', 'Thông báo', 'Thông báo', 'notifications'],
    ]
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    for (const [url, heading, active, name] of pages) {
      await page.goto(url)
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
      await expect(page.getByText('Đang tải dữ liệu…', { exact: true })).toHaveCount(0)
      const nav = page.getByRole('navigation', { name: 'Điều hướng Nhà tổ chức' })
      await expect(nav.getByRole('link', { name: active, exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(page.locator('.site-header')).toHaveCount(0)
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${url} at ${width}px`).toBe(true)
      }
      await page.setViewportSize(info.project.use.viewport)
      await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-management-${name}.png`), fullPage: true })
    }
    await page.goto(`${base}/dang-ky`)
    await page.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận xét duyệt', exact: true }).click()
    await expect(page.locator('.om-context-main .om-capacity strong')).toHaveText('1/25')
    const result = await (await page.request.get(`/api/v1/organizer/activities/${activity.id}/applicants/`)).json()
    expect(result.results.find(item => item.id === entry.participation.id).status).toBe('approved')
    await page.getByRole('link', { name: 'Bảng điểm danh', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Nguyễn An Tình Nguyện' })).toBeVisible()
    await page.goto('/bao-cao/mo-rong')
    await expect(page.getByRole('button', { name: 'In / Lưu PDF' })).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.od-sidebar')).toBeHidden()
    await expect(page.locator('.od-topbar')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Báo cáo mở rộng' })).toBeVisible()
    await page.emulateMedia({ media: 'screen' })
    await page.goto('/hoat-dong')
    await expect(page.locator('.site-header')).toBeVisible()
    await expect(page.locator('.od-sidebar')).toHaveCount(0)
  } finally { await context.close() }
})

test('Danh sách quản lý xử lý lỗi và các mục nghiệp vụ dẫn đúng hoạt động', async ({ page }) => {
  await register(page.request, 'organizer', 'Nhóm kiểm tra điều hướng')
  await page.route('**/api/v1/organizer/activities/?*', route => route.abort())
  await page.goto('/nha-to-chuc/diem-danh')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await page.unroute('**/api/v1/organizer/activities/?*')
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText('Chưa có hoạt động phù hợp. Bạn có thể tạo hoạt động mới hoặc đổi bộ lọc.')).toBeVisible()
  await page.getByRole('navigation', { name: 'Điều hướng Nhà tổ chức' }).getByRole('link', { name: 'Đơn đăng ký', exact: true }).click()
  await expect(page).toHaveURL(/\/nha-to-chuc\/dang-ky$/)
  await page.getByRole('link', { name: 'Tạo hoạt động', exact: true }).click()
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toBeVisible()
})
