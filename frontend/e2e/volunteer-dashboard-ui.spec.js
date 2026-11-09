import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const volunteer = { id: 'dashboard-ui-volunteer', full_name: 'Nguyễn An', email: 'an@example.invalid', role: 'volunteer' }
const activity = { id: 'upcoming', title: 'Kết nối số cùng cộng đồng', organizer_name: 'Nhóm sẻ chia', status: 'published', starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z' }
const entry = { id: 'participation', activity, status: 'approved', registered_at: '2026-11-01T07:00:00Z', activity_changed: false, attendance: null }

async function mockDashboard(page) {
  const state = { user: volunteer, gets: 0, fail: false, data: {
    profile: { ...volunteer, avatar_url: null }, member_since: '2026-01-01T07:00:00Z',
    summary: { pending_invitations: 3, pending_registrations: 2 }, metrics: { registered: 8, attended_completed: 4 },
    checkin_now_count: 1, checkin_now: [{ ...entry, id: 'live-entry', activity_changed: true, activity: { ...activity, id: 'live', title: 'Bếp ăn cộng đồng' } }],
    upcoming_count: 1, upcoming: [entry], history: [{ ...entry, id: 'past-entry', activity: { ...activity, status: 'cancelled', title: 'Ngày xanh đã tham gia' }, attendance: { confirmed_at: '2026-11-02T07:00:00Z' } }],
  } }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: state.user }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { ...state.user, avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 2, latest_id: 'latest' }
    else if (url.pathname.endsWith('/reports/volunteer-dashboard/')) {
      state.gets++
      if (state.fail) return route.abort()
      data = state.data
    } else if (url.pathname.endsWith('/invitations/')) data = { count: 0, results: [], previous: null, next: null, summary: { total: 0, pending: 0, accepted: 0, declined: 0, withdrawn: 0 } }
    else throw new Error(`Unexpected dashboard request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Tổng quan ưu tiên việc cần làm, liên kết đúng trang và làm mới số liệu', async ({ page }, info) => {
  const state = await mockDashboard(page)
  await page.goto('/tinh-nguyen-vien')
  await expect(page.locator('.vd-stat strong')).toHaveText(['3', '2', '1', '4'])
  await expect(page.locator('.vd-checkin-panel')).toContainText('Bếp ăn cộng đồng')
  await expect(page.locator('.vd-checkin-panel')).toContainText('Lịch hoặc địa điểm đã thay đổi')
  await expect(page.locator('.vd-checkin-panel .button.primary')).toHaveAttribute('href', '/hoat-dong/live/check-in')
  await expect(page.locator('#vd-upcoming .vd-activity-row')).toHaveCount(1)
  await expect(page.locator('.vd-panel').last()).toContainText('Đã hủy')
  await expect(page.locator('.vd-panel').last().getByRole('link', { name: 'Ngày xanh đã tham gia', exact: true })).toHaveAttribute('href', '/tinh-nguyen-vien/lich-su')
  await expect(page.locator('.vd-actions, .vd-profile-facts, .vd-bottom, .vd-eyebrow')).toHaveCount(0)
  await expect(page.locator('.vd-welcome')).toHaveAttribute('href', '/ho-so')
  const previousGets = state.gets
  state.data.summary.pending_invitations = 1
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets).toBeGreaterThan(previousGets)
  await expect(page.locator('.vd-stat strong')).toHaveText(['1', '2', '1', '4'])
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const refresh = await page.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox()
    const toolbar = await page.locator('.vd-heading-actions').boundingBox()
    expect(Math.abs(refresh.x + refresh.width - toolbar.x - toolbar.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage1-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-dashboard.png`), fullPage: true })
  await page.locator('.vd-stat').filter({ hasText: 'Lời mời chờ phản hồi' }).click()
  await expect(page).toHaveURL(/\/loi-moi\?status=pending$/)
  await expect(page.getByRole('group', { name: 'Lọc trạng thái lời mời' }).getByRole('button', { name: /^Chờ phản hồi/ })).toHaveAttribute('aria-pressed', 'true')
})

test('Tổng quan xử lý tải lỗi và dữ liệu trống', async ({ page }) => {
  const state = await mockDashboard(page)
  state.fail = true
  await page.goto('/tinh-nguyen-vien')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.fail = false
  state.data = { ...state.data, summary: { pending_invitations: 0, pending_registrations: 0 }, metrics: { registered: 0, attended_completed: 0 }, checkin_now_count: 0, checkin_now: [], upcoming_count: 0, upcoming: [], history: [] }
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.vd-stat strong')).toHaveText(['0', '0', '0', '0'])
  await expect(page.locator('.vd-checkin-panel')).toHaveCount(0)
  await expect(page.getByText('Chưa có hoạt động sắp tới.', { exact: true })).toBeVisible()
  await expect(page.getByText('Lịch sử sẽ xuất hiện sau khi bạn được xác nhận có mặt.', { exact: true })).toBeVisible()
})

test('Menu nhớ theo tài khoản trên máy tính, đóng khi điều hướng trên điện thoại', async ({ page }) => {
  const state = await mockDashboard(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/tinh-nguyen-vien')
  const aside = page.locator('.vs-shell > aside')
  const toggle = page.locator('.workspace-menu-toggle')
  await expect(aside).toBeVisible()
  await toggle.click()
  await expect(aside).toBeHidden()
  await page.reload()
  await expect(aside).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('v-connect:volunteer-menu:dashboard-ui-volunteer'))).toBe('closed')
  state.user = { ...volunteer, id: 'other-volunteer', full_name: 'Người khác' }
  await page.reload()
  await expect(aside).toBeVisible()
  state.user = volunteer
  await page.reload()
  await expect(aside).toBeHidden()
  await page.setViewportSize({ width: 390, height: 844 })
  await toggle.click()
  await expect(aside).toHaveAttribute('aria-modal', 'true')
  await expect(page.locator('.od-workspace')).toHaveAttribute('inert', '')
  await expect(page.locator('.workspace-sidebar-close')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(aside).toBeHidden()
  await expect(toggle).toBeFocused()
  await toggle.click()
  await aside.getByRole('link', { name: 'Lời mời của tôi', exact: true }).click()
  await expect(page).toHaveURL(/\/tinh-nguyen-vien\/loi-moi$/)
  await expect(aside).toBeHidden()
  await expect(page.locator('.od-workspace')).not.toHaveAttribute('inert', '')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(aside).toBeHidden()
})
