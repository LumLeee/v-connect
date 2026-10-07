import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function login(request) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  expect((await request.post('/api/v1/auth/login/', { headers: { 'X-CSRFToken': csrfToken }, data: { identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD } })).status()).toBe(200)
}

test('Admin: điều hướng tất cả trang, số liệu thật và bố cục responsive', async ({ page }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  await login(page.request)
  const data = await (await page.request.get('/api/v1/reports/overview/')).json()
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  const screens = [
    ['/quan-tri', 'Xin chào, Quản trị kiểm thử.', 'Tổng quan', 'dashboard'],
    ['/quan-tri/tai-khoan', 'Quản lý tài khoản', 'Tài khoản hệ thống', 'accounts'],
    ['/quan-tri/phan-hoi', 'Quản lý phản hồi', 'Kiểm duyệt phản hồi', 'feedback'],
    ['/quan-tri/nhat-ky', 'Nhật ký thao tác', 'Lịch sử thao tác', 'audit'],
    ['/bao-cao', 'Thống kê của tôi', 'Báo cáo và thống kê', 'reports'],
    ['/bao-cao/hoat-dong', 'Báo cáo hoạt động', 'Hoạt động toàn hệ thống', 'activities'],
    [`/bao-cao/hoat-dong/${activity}`, 'Kết quả hoạt động', 'Hoạt động toàn hệ thống', 'result'],
    ['/bao-cao/dang-ky', 'Tổng đơn đăng ký', 'Báo cáo và thống kê', 'participations'],
    ['/bao-cao/mo-rong', 'Báo cáo mở rộng', 'Báo cáo và thống kê', 'advanced'],
    ['/thong-bao', 'Thông báo', 'Thông báo', 'notifications'],
    ['/ho-so', 'Hồ sơ của tôi', 'Hồ sơ cá nhân', 'profile'],
  ]
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  for (const [url, heading, active, name] of screens) {
    await page.goto(url)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByText('Đang tải dữ liệu…', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Điều hướng Quản trị viên' }).getByRole('link', { name: active, exact: true })).toHaveAttribute('aria-current', 'page')
    if (name === 'dashboard') await expect(page.locator('.om-stat').filter({ hasText: 'Tổng tài khoản' }).locator('strong')).toHaveText(String(data.accounts.total))
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${url} at ${width}px`).toBe(true)
    }
    await page.setViewportSize(info.project.use.viewport)
    await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-admin-${name}.png`), fullPage: true })
  }
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.od-sidebar')).toBeHidden()
  await page.emulateMedia({ media: 'screen' })
  await page.goto('/')
  await expect(page.locator('.site-header')).toBeVisible()
})

test('Admin: khách bị chặn và tổng quan thử lại sau lỗi mạng', async ({ page }) => {
  await page.goto('/quan-tri')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await login(page.request)
  await page.route('**/api/v1/reports/overview/', route => route.abort())
  await page.goto('/quan-tri')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await page.unroute('**/api/v1/reports/overview/')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.om-stat')).toHaveCount(4)
})
