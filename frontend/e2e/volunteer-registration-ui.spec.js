import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/tinh-nguyen-vien/dang-ky'
const statuses = ['pending', 'approved', 'rejected', 'cancelled']
const activity = { status: 'published', organizer_name: 'Nhóm cộng đồng', address: 'Đà Nẵng', starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z', time_checks_disabled: true }

async function mockRegistrations(page) {
  const state = { posts: 0, gets: 0, failList: false, failCancel: false, items: Array.from({ length: 16 }, (_, i) => ({
    id: `registration-${i}`, activity: { ...activity, id: `activity-${i}`, title: `${i < 14 ? 'Bếp cộng đồng' : 'Rừng xanh'} ${i + 1}` },
    status: i < 13 ? 'pending' : statuses[i - 12], registered_at: '2026-11-01T07:00:00Z', reviewed_at: i < 13 ? null : '2026-11-02T07:00:00Z',
    attendance: null, activity_changed: i === 0, cancellation_reason: i === 15 ? 'volunteer' : '',
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'registration-ui-volunteer', full_name: 'Người kiểm tra', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'registration-ui-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/participation/cancel/')) {
      state.posts++
      if (state.failCancel) return route.fulfill({ status: 409, json: { error: { message: 'Chưa thể hủy đăng ký. Vui lòng thử lại.' } } })
      const item = state.items.find(entry => url.pathname.includes(`/${entry.activity.id}/`))
      item.status = 'cancelled'; item.cancellation_reason = 'volunteer'; data = item
    } else if (url.pathname.endsWith('/participations/check-in/')) data = { count: 1, next: null, previous: null, summary: { total: 1, pending: 1, attended: 0 }, results: [{ ...state.items[13], status: 'approved' }] }
    else if (url.pathname.endsWith('/participations/history/')) data = { count: 1, next: null, previous: null, summary: { total: 1, completed: 1, total_score: 8, feedback_count: 0 }, results: [{ ...state.items[13], status: 'approved', activity: { ...state.items[13].activity, status: 'completed' }, attendance: { confirmed_at: '2026-11-02T07:00:00Z', method: 'manual' }, contribution: { score: 8, updated_at: '2026-11-03T07:00:00Z' } }] }
    else if (url.pathname.endsWith('/participations/')) {
      state.gets++
      if (state.failList) return route.abort()
      const searched = state.items.filter(item => item.activity.title.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()))
      const summary = { total: searched.length, ...Object.fromEntries(statuses.map(status => [status, searched.filter(item => item.status === status).length])) }
      const filtered = searched.filter(item => !url.searchParams.get('status') || item.status === url.searchParams.get('status'))
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      if (pageNo > 1 && offset >= filtered.length) return route.fulfill({ status: 404, json: { detail: 'Trang không tồn tại.' } })
      data = { count: filtered.length, summary, results: filtered.slice(offset, offset + 12), next: filtered.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else throw new Error(`Unexpected registration request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Đăng ký: lọc toàn bộ dữ liệu, giữ URL và hủy đơn ở trang cuối', async ({ page }, info) => {
  const state = await mockRegistrations(page)
  await page.goto(base)
  const filters = page.getByRole('group', { name: 'Lọc trạng thái đơn đăng ký' })
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('16')
  await expect(filters.getByRole('button', { name: /^Chờ duyệt/ })).toContainText('13')
  await expect(page.locator('.vp-registration')).toHaveCount(12)
  await expect(page.locator('.vp-registration').first()).toContainText('Lịch hoặc địa điểm đã thay đổi')
  await page.locator('.vp-registration').first().focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Bếp cộng đồng 1', exact: true })).toContainText('Trạng thái đơn: Chờ duyệt')
  await page.getByRole('button', { name: 'Đóng', exact: true }).click()
  await filters.getByRole('button', { name: /^Chờ duyệt/ }).click()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.vp-registration')).toHaveCount(1)
  await page.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Xác nhận hủy đăng ký', exact: true })
  await confirm.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.posts).toBe(0)
  await page.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
  state.failCancel = true
  await confirm.getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
  await expect(confirm.getByRole('alert')).toContainText('Chưa thể hủy đăng ký')
  state.failCancel = false
  await confirm.getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
  await expect(page).toHaveURL(/status=pending.*page=1/)
  await expect(page.locator('.vp-registration')).toHaveCount(12)
  await expect(filters.getByRole('button', { name: /^Chờ duyệt/ })).toContainText('12')
  await expect(filters.getByRole('button', { name: /^Đã hủy đăng ký/ })).toContainText('2')
  await page.getByLabel('Tìm hoạt động đã đăng ký', { exact: true }).fill('  Bếp cộng đồng  ')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await filters.getByRole('button', { name: /^Được duyệt/ }).click()
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('14')
  await expect(page.locator('.vp-registration h2')).toHaveText(['Bếp cộng đồng 14'])
  await expect(page.locator('.vp-registration')).toContainText('Xét duyệt:')
  await page.evaluate(() => history.back())
  await expect(filters.getByRole('button', { name: /^Chờ duyệt/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Tìm hoạt động đã đăng ký', { exact: true })).toHaveValue('Bếp cộng đồng')
  const previousGets = state.gets
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets).toBeGreaterThan(previousGets)
  await expect(page.locator('.vp-registration')).toHaveCount(12)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage1-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-registrations.png`), fullPage: true })
})

test('Đăng ký: lỗi tải, bộ lọc rỗng và chế độ điểm danh/lịch sử giữ nguyên', async ({ page }) => {
  const state = await mockRegistrations(page)
  state.failList = true
  await page.goto(base)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.vp-registration')).toHaveCount(12)
  await page.getByLabel('Tìm hoạt động đã đăng ký', { exact: true }).fill('Không tồn tại')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.getByText('Không có đơn đăng ký phù hợp với bộ lọc.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem tất cả đơn đăng ký', exact: true }).click()
  await expect(page.locator('.vp-registration')).toHaveCount(12)
  await page.goto(`${base}?status=rejected&page=8`)
  await expect(page.getByRole('button', { name: 'Về trang đầu', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Về trang đầu', exact: true }).click()
  await expect(page).toHaveURL(/status=rejected&page=1/)
  const rejected = page.locator('.vp-registration')
  await expect(rejected).toHaveCount(1)
  await expect(rejected.getByRole('button', { name: 'Hủy đăng ký', exact: true })).toHaveCount(0)
  await expect(rejected.getByRole('button', { name: 'Xem chi tiết', exact: true })).toBeHidden()
  await rejected.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Rừng xanh 15', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Đóng', exact: true }).click()
  await page.goto('/tinh-nguyen-vien/check-in')
  await expect(page.locator('.vp-row.vp-checkin')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Lọc trạng thái đơn đăng ký' })).toHaveCount(0)
  await page.goto('/tinh-nguyen-vien/lich-su')
  await expect(page.locator('.vp-row.vp-history')).toHaveCount(1)
  await expect(page.locator('.vp-row.vp-history')).toContainText('8điểm')
  await expect(page.getByRole('group', { name: 'Lọc trạng thái đơn đăng ký' })).toHaveCount(0)
})
