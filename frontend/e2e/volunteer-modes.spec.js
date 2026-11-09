import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import nodePath from 'node:path'

const instant = '2026-11-04T10:00:00Z'
function entry(id, overrides = {}) {
  return {
    id, status: 'approved', registered_at: '2026-11-03T08:00:00Z', reviewed_at: '2026-11-03T09:00:00Z',
    attendance: null, contribution: null, feedback: null, can_submit_feedback: false,
    activity: { id, title: `Hoạt động ${id}`, organizer_name: 'Nhóm cộng đồng', address: 'Đà Nẵng',
      status: 'published', starts_at: '2026-11-04T09:00:00Z', ends_at: '2026-11-04T11:00:00Z', time_checks_disabled: true },
    ...overrides,
  }
}

async function mockLists(page) {
  await page.clock.setFixedTime(new Date(instant))
  const approved = entry('approved')
  const pending = entry('pending', { status: 'pending', reviewed_at: null })
  const attended = entry('attended', { attendance: { confirmed_at: '2026-11-04T09:55:00Z', confirmed_by_name: 'Nhà tổ chức', method: 'manual' } })
  const zero = entry('zero', { ...attended, id: 'zero', activity: { ...approved.activity, id: 'zero', title: 'Hoạt động điểm không', status: 'completed' }, contribution: { score: 0, updated_at: instant }, feedback: { rating: 4, is_hidden: false } })
  const unscored = entry('unscored', { ...attended, id: 'unscored', activity: { ...approved.activity, id: 'unscored', title: 'Hoạt động chờ điểm', status: 'completed' }, can_submit_feedback: true })
  const cancelled = entry('cancelled', { ...attended, id: 'cancelled', status: 'cancelled', activity: { ...approved.activity, id: 'cancelled', title: 'Hoạt động đã hủy', status: 'cancelled' } })
  const state = { registrations: [pending, approved], checkin: [approved, attended], history: [zero, unscored, cancelled], requests: {}, cancelled: 0, cancelFails: false, empty: false, fail: false }
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    state.requests[path] = (state.requests[path] || 0) + 1
    if (path === '/api/v1/auth/me/') return route.fulfill({ json: { user: { id: 'volunteer', role: 'volunteer', full_name: 'Tình nguyện viên', email: 'test@example.invalid' } } })
    if (path.endsWith('/auth/profile/')) return route.fulfill({ json: { profile: { avatar_url: null } } })
    if (path.endsWith('/auth/csrf/')) return route.fulfill({ json: { csrfToken: 'test-csrf' } })
    if (path.endsWith('/notifications/unread-count/')) return route.fulfill({ json: { count: 0, latest_id: null } })
    if (route.request().method() === 'POST' && path.endsWith('/participation/cancel/')) {
      state.cancelled += 1
      if (state.cancelFails) return route.fulfill({ status: 400, json: { error: { message: 'Không thể hủy lúc này.' } } })
      const id = path.split('/')[4]
      state.registrations = state.registrations.map(item => item.activity.id === id ? { ...item, status: 'cancelled', cancellation_reason: 'volunteer' } : item)
      return route.fulfill({ json: {} })
    }
    if (path.startsWith('/api/v1/participations/')) {
      if (state.fail) return route.abort()
      if (new URL(route.request().url()).searchParams.get('page') === '99') return route.fulfill({ status: 404, json: { error: { message: 'Trang không tồn tại.' } } })
      const mode = path.includes('/history/') ? 'history' : path.includes('/check-in/') ? 'checkin' : 'registrations'
      const results = state.empty ? [] : state[mode]
      const summary = mode === 'registrations'
        ? { total: results.length, ...Object.fromEntries(['pending', 'approved', 'rejected', 'cancelled'].map(status => [status, results.filter(row => row.status === status).length])) }
        : mode === 'checkin' ? { total: results.length, attended: results.filter(row => row.attendance).length, pending: results.filter(row => !row.attendance).length,
          open: results.filter(row => !row.attendance && (row.activity.time_checks_disabled || (+new Date(row.activity.starts_at) <= +new Date(instant) && +new Date(instant) <= +new Date(row.activity.ends_at)))).length,
          upcoming: results.filter(row => !row.attendance && !row.activity.time_checks_disabled && row.activity.starts_at > instant).length,
          closed: results.filter(row => !row.attendance && !row.activity.time_checks_disabled && row.activity.ends_at < instant).length }
          : { total: results.length, completed: results.filter(row => row.activity.status === 'completed').length, total_score: results.reduce((sum, row) => sum + (row.contribution?.score || 0), 0), feedback_count: results.filter(row => row.feedback).length, feedback_pending: results.filter(row => !row.feedback).length }
      return route.fulfill({ json: { count: results.length, results, next: null, previous: null, summary } })
    }
    return route.fulfill({ json: { count: 0, results: [] } })
  })
  return state
}

test('Ba trang có dữ liệu, thống kê và thao tác riêng; hủy cần xác nhận', async ({ page }) => {
  const state = await mockLists(page)
  await page.goto('/tinh-nguyen-vien/dang-ky')
  await expect(page.locator('.vp-registration')).toHaveCount(2)
  await expect(page.locator('.vp-registration').first()).toContainText('Gửi đơn:')
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toHaveCount(0)
  await page.locator('.vp-registration').first().getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
  expect(state.cancelled).toBe(0)
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.cancelled).toBe(0)
  await page.locator('.vp-registration').first().getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
  state.cancelFails = true
  await page.getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Không thể hủy lúc này.')
  state.cancelFails = false
  await page.getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Lọc trạng thái đơn đăng ký' }).getByRole('button', { name: /^Chờ duyệt/ }).locator('span')).toHaveText('0')
  await expect(page.locator('.vp-registration').first()).toContainText('Đã hủy đăng ký')

  await page.goto('/tinh-nguyen-vien/check-in')
  await expect(page.locator('.vp-checkin.vp-row')).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toHaveCount(1)
  await expect(page.locator('.vp-checkin.is-attended')).toContainText('Điểm danh:')
  await expect(page.locator('.vp-checkin.is-attended .vp-attendance time')).toHaveText('5 phút trước')
  await expect(page.getByRole('button', { name: 'Hủy đăng ký', exact: true })).toHaveCount(0)
  const before = state.requests['/api/v1/participations/check-in/']
  state.checkin = state.checkin.map(row => ({ ...row, attendance: state.checkin[1].attendance }))
  await page.locator('.refresh-button').click()
  await expect(page.locator('.vp-summary > div').nth(2).locator('strong')).toHaveText('2')
  expect(state.requests['/api/v1/participations/check-in/']).toBeGreaterThan(before)

  await page.goto('/tinh-nguyen-vien/lich-su')
  await expect(page.locator('.vp-history.vp-row')).toHaveCount(3)
  await expect(page.locator('.vp-history-result').first().locator('strong')).toHaveText('0điểm')
  await expect(page.locator('.vp-history-result').nth(1)).toContainText('Chờ chấm điểm đóng góp')
  await expect(page.getByRole('link', { name: 'Xem phản hồi của tôi', exact: true })).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Gửi phản hồi', exact: true })).toHaveCount(1)
  const cancelled = page.locator('.vp-history.vp-row').last()
  await expect(cancelled).toContainText('lượt có mặt được giữ lại')
  await cancelled.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(cancelled).toBeFocused()
})

test('Điểm danh tuân thủ khung giờ; cả ba trang vừa màn hình điện thoại', async ({ page }, info) => {
  const state = await mockLists(page)
  const future = entry('future')
  future.activity.time_checks_disabled = false
  future.activity.starts_at = '2026-11-05T09:00:00Z'
  future.activity.ends_at = '2026-11-05T11:00:00Z'
  state.checkin = [future]
  await page.goto('/tinh-nguyen-vien/check-in')
  await expect(page.getByText('Chưa đến giờ điểm danh.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toHaveCount(0)
  future.activity.time_checks_disabled = true
  await page.locator('.refresh-button').click()
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toBeVisible()
  for (const path of ['dang-ky', 'check-in', 'lich-su']) {
    await page.goto(`/tinh-nguyen-vien/${path}`)
    await expect(page.locator('.vp-row').first()).toBeVisible()
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} at ${width}px`).toBe(true)
      if (process.env.E2E_ARTIFACT_DIR && [1280, 390].includes(width)) {
        await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
        await page.screenshot({ path: nodePath.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-mode-${path}-${width}.png`), fullPage: true })
      }
    }
  }
})

test('Trạng thái trống, lỗi mạng và trang không còn dữ liệu có đường xử lý', async ({ page }) => {
  const state = await mockLists(page)
  state.empty = true
  for (const [path, message] of [['dang-ky', 'Chưa có đơn đăng ký.'], ['check-in', 'Chưa có hoạt động được duyệt đang công khai.'], ['lich-su', 'Chưa có hoạt động được xác nhận có mặt.']]) {
    await page.goto(`/tinh-nguyen-vien/${path}`)
    await expect(page.getByText(message, { exact: true })).toBeVisible()
    if (path === 'dang-ky') await expect(page.getByRole('group', { name: 'Lọc trạng thái đơn đăng ký' }).locator('button span')).toHaveText(['0', '0', '0', '0', '0'])
    else await expect(page.locator('.vp-summary strong')).toHaveText(['0', '0', '0'])
  }
  state.fail = true
  await page.goto('/tinh-nguyen-vien/lich-su')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.fail = false
  state.empty = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.vp-row')).toHaveCount(3)
  await page.goto('/tinh-nguyen-vien/lich-su?page=99')
  await page.getByRole('button', { name: 'Về trang đầu', exact: true }).click()
  await expect(page.locator('.vp-row')).toHaveCount(3)
})
