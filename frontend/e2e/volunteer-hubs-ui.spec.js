import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const instant = Date.parse('2026-11-06T10:00:00Z')
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
const statuses = ['open', 'upcoming', 'attended', 'closed']
function item(index) {
  return { id: `entry-${index}`, status: 'approved', registered_at: '2026-11-01T10:00:00Z', reviewed_at: '2026-11-02T10:00:00Z', attendance: null,
    activity: { id: `activity-${index}`, title: `${index < 14 ? 'Bếp cộng đồng' : 'Ngày xanh'} ${index + 1}`, organizer_name: 'Nhóm sẻ chia', status: 'published', address: 'Đà Nẵng', starts_at: '2026-11-06T09:00:00Z', ends_at: '2026-11-06T11:00:00Z', time_checks_disabled: false } }
}

async function fixtures(page) {
  await page.clock.setFixedTime(new Date(instant))
  const checkin = Array.from({ length: 16 }, (_, i) => item(i))
  checkin[13].activity.starts_at = '2026-11-07T09:00:00Z'; checkin[13].activity.ends_at = '2026-11-07T11:00:00Z'
  checkin[14].attendance = { confirmed_at: '2026-11-06T09:55:00Z', method: 'qr', confirmed_by_name: 'Nguyễn An' }
  checkin[15].activity.starts_at = '2026-11-06T07:00:00Z'; checkin[15].activity.ends_at = '2026-11-06T08:00:00Z'
  const history = Array.from({ length: 16 }, (_, i) => ({ ...item(i),
    activity: { ...item(i).activity, status: i === 15 ? 'cancelled' : 'completed' }, status: i === 15 ? 'cancelled' : 'approved',
    attendance: { confirmed_at: i === 14 ? '2026-11-05T17:00:00Z' : i === 15 ? '2026-11-06T17:00:00Z' : '2026-11-06T09:55:00Z', method: 'manual', confirmed_by_name: 'Nhà tổ chức' },
    contribution: i === 0 ? { score: 0, updated_at: '2026-11-06T09:56:00Z' } : null,
    feedback: i === 13 || i === 14 ? { rating: 5, is_hidden: i === 14 } : null, can_submit_feedback: i !== 13 && i !== 14 && i !== 15,
  }))
  const state = { checkin, history, now: instant, fail: false, requests: [] }
  page.on('pageerror', error => { throw error })
  function category(entry) {
    if (entry.attendance) return 'attended'
    if (entry.activity.time_checks_disabled) return 'open'
    if (Date.parse(entry.activity.starts_at) > state.now) return 'upcoming'
    return Date.parse(entry.activity.ends_at) < state.now ? 'closed' : 'open'
  }
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'hub-volunteer', role: 'volunteer', full_name: 'Nguyễn An', email: 'hubs@example.invalid' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/participations/check-in/') || url.pathname.endsWith('/participations/history/')) {
      const historyMode = url.pathname.endsWith('/history/')
      state.requests.push({ mode: historyMode ? 'history' : 'checkin', ...Object.fromEntries(url.searchParams) })
      if (state.fail) return route.abort()
      let rows = (historyMode ? state.history : state.checkin).filter(entry => entry.activity.title.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()))
      if (historyMode) rows = rows.filter(entry => (!url.searchParams.get('date_from') || day.format(new Date(entry.attendance.confirmed_at)) >= url.searchParams.get('date_from')) && (!url.searchParams.get('date_to') || day.format(new Date(entry.attendance.confirmed_at)) <= url.searchParams.get('date_to')))
      const summary = historyMode
        ? { total: rows.length, completed: rows.filter(row => row.activity.status === 'completed').length, total_score: rows.reduce((sum, row) => sum + (row.contribution?.score || 0), 0), feedback_count: rows.filter(row => row.feedback).length, feedback_pending: rows.filter(row => !row.feedback).length }
        : { total: rows.length, pending: rows.filter(row => !row.attendance).length, ...Object.fromEntries(statuses.map(status => [status, rows.filter(row => category(row) === status).length])) }
      const transitions = historyMode ? [] : rows.filter(row => !row.attendance && !row.activity.time_checks_disabled)
        .flatMap(row => [Date.parse(row.activity.starts_at), Date.parse(row.activity.ends_at) + 1]).filter(value => value > state.now)
      if (historyMode && ['pending', 'submitted'].includes(url.searchParams.get('feedback'))) rows = rows.filter(row => Boolean(row.feedback) === (url.searchParams.get('feedback') === 'submitted'))
      if (!historyMode && statuses.includes(url.searchParams.get('status'))) rows = rows.filter(row => category(row) === url.searchParams.get('status'))
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      if (pageNo > 1 && offset >= rows.length) return route.fulfill({ status: 404, json: { error: { message: 'Trang không tồn tại.' } } })
      data = { count: rows.length, summary, results: rows.slice(offset, offset + 12), next: offset + 12 < rows.length ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
      if (!historyMode) data.next_transition_at = transitions.length ? new Date(Math.min(...transitions)).toISOString() : null
    } else throw new Error(`Unexpected hub request ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Điểm danh: số đếm toàn danh sách, lọc/tìm/phân trang giữ URL và thời gian có mặt', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto('/tinh-nguyen-vien/check-in')
  const filters = page.getByRole('group', { name: 'Lọc trạng thái điểm danh' })
  await expect(filters.locator('button span')).toHaveText(['16', '13', '1', '1', '1'])
  await filters.getByRole('button', { name: /^Đang mở điểm danh/ }).click()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.vp-row.vp-checkin')).toHaveCount(1)
  await expect(page).toHaveURL(/status=open&page=2/)
  const before = state.requests.length
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.requests.length).toBeGreaterThan(before)
  await expect(page.locator('.vp-row.vp-checkin')).toHaveCount(1)
  await page.getByLabel('Tìm hoạt động được duyệt', { exact: true }).fill(' Bếp cộng đồng ')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect.poll(() => state.requests.at(-1)).toMatchObject({ status: 'open', page: '1', search: 'Bếp cộng đồng' })
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('14')
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await filters.getByRole('button', { name: /^Đã điểm danh/ }).click()
  await expect(page.locator('.vp-row.vp-checkin .vp-attendance time')).toHaveText('5 phút trước')
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toHaveCount(0)
  await filters.getByRole('button', { name: /^Đã hết giờ/ }).click()
  const closed = page.locator('.vp-row.vp-checkin')
  await expect(closed).toHaveCount(1)
  await closed.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Ngày xanh 16', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Đóng', exact: true }).click()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await filters.getByRole('button', { name: /^Tất cả/ }).click()
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-checkin-hub.png`), fullPage: true })
})

test('Lịch sử: lọc ngày điểm danh và phản hồi trước phân trang, giữ điểm 0 và bằng chứng đã hủy', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto('/tinh-nguyen-vien/lich-su')
  await expect(page.locator('.vp-history-result').first()).toContainText('0điểm')
  const filters = page.getByRole('group', { name: 'Lọc trạng thái phản hồi' })
  await expect(filters.locator('button span')).toHaveText(['16', '14', '2'])
  await page.getByLabel('Điểm danh từ ngày', { exact: true }).fill('2026-11-06')
  await page.getByLabel('Điểm danh đến ngày', { exact: true }).fill('2026-11-06')
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect.poll(() => state.requests.at(-1)).toMatchObject({ date_from: '2026-11-06', date_to: '2026-11-06' })
  await expect(filters.locator('button span')).toHaveText(['15', '13', '2'])
  await filters.getByRole('button', { name: /^Chưa gửi/ }).click()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.vp-row.vp-history')).toHaveCount(1)
  await expect(page).toHaveURL(/date_from=2026-11-06.*date_to=2026-11-06.*feedback=pending/)
  await filters.getByRole('button', { name: /^Đã gửi/ }).click()
  await expect(page.locator('.vp-row.vp-history')).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Xem phản hồi của tôi', exact: true })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Gửi phản hồi', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  const cancelled = page.locator('.vp-row.vp-history').filter({ hasText: 'Ngày xanh 16' })
  await expect(cancelled).toContainText('lượt có mặt được giữ lại')
  await expect(cancelled).toContainText('Chưa thể gửi phản hồi')
  await expect(cancelled.getByRole('link', { name: 'Gửi phản hồi', exact: true })).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-history-hub.png`), fullPage: true })
})

test('Bộ lọc lịch sử: chặn ngày ngược, xử lý lỗi/rỗng/404 và không mang lỗi sang Điểm danh', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto('/tinh-nguyen-vien/lich-su?date_from=2026-11-06&date_to=2026-11-06')
  await expect(page.locator('.vp-row.vp-history')).toHaveCount(12)
  await page.getByLabel('Điểm danh từ ngày', { exact: true }).fill('2026-11-05')
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect.poll(() => state.requests.at(-1)).toMatchObject({ date_from: '2026-11-05', date_to: '2026-11-06' })
  const before = state.requests.length
  await page.getByLabel('Điểm danh từ ngày', { exact: true }).fill('2026-11-07')
  await page.getByLabel('Điểm danh đến ngày', { exact: true }).fill('2026-11-06')
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Ngày đến phải bằng hoặc sau ngày từ.')
  expect(state.requests.length).toBe(before)
  await page.goBack()
  await expect(page).toHaveURL(/date_from=2026-11-06&date_to=2026-11-06/)
  await expect(page.getByLabel('Điểm danh từ ngày', { exact: true })).toHaveValue('2026-11-06')
  await expect(page.getByLabel('Điểm danh đến ngày', { exact: true })).toHaveValue('2026-11-06')
  await expect(page.getByLabel('Điểm danh đến ngày', { exact: true })).toHaveAttribute('aria-invalid', 'false')
  await expect(page.locator('#history-date-error')).toHaveCount(0)
  await page.getByLabel('Điểm danh từ ngày', { exact: true }).fill('2026-11-07')
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect(page.locator('#history-date-error')).toBeVisible()
  const aside = page.locator('.vs-shell > aside')
  if (!await aside.isVisible()) await page.locator('.workspace-menu-toggle').click()
  await aside.getByRole('link', { name: 'Điểm danh của tôi', exact: true }).click()
  await expect(page.locator('#history-date-error')).toHaveCount(0)
  state.fail = true
  await page.goto('/tinh-nguyen-vien/lich-su?feedback=pending&search=Không+tồn+tại&date_from=2026-11-06')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.fail = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Không có lượt tham gia phù hợp với bộ lọc.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem toàn bộ lịch sử', exact: true }).click()
  await expect(page.locator('.vp-row.vp-history')).toHaveCount(12)
  await page.goto('/tinh-nguyen-vien/lich-su?feedback=submitted&page=99&date_from=2026-11-06')
  await page.getByRole('button', { name: 'Về trang đầu', exact: true }).click()
  await expect(page.locator('.vp-row.vp-history')).toHaveCount(2)
  await expect(page).toHaveURL(/feedback=submitted.*page=1.*date_from=2026-11-06/)
})

test('Điểm danh giữ mốc kết thúc bao gồm và tự cập nhật sau khi qua mốc', async ({ page }) => {
  const state = await fixtures(page)
  state.checkin = [{ ...item(0), activity: { ...item(0).activity, ends_at: new Date(instant).toISOString() } }]
  await page.goto('/tinh-nguyen-vien/check-in', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toBeVisible()
  const before = state.requests.length
  state.now = instant + 1
  await page.clock.setFixedTime(new Date(state.now))
  await expect.poll(() => state.requests.length).toBeGreaterThan(before)
  await expect(page.locator('.vp-row.vp-checkin')).toContainText('Đã hết giờ điểm danh.')
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toHaveCount(0)
})

test('Điểm danh tự tải lại bộ lọc Đang mở đang rỗng khi hoạt động đến giờ', async ({ page }) => {
  const state = await fixtures(page)
  state.checkin = [{ ...item(0), activity: { ...item(0).activity, starts_at: new Date(instant + 1000).toISOString() } }]
  await page.goto('/tinh-nguyen-vien/check-in?status=open', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.vp-row.vp-checkin')).toHaveCount(0)
  await expect(page.getByText('Không có hoạt động phù hợp với bộ lọc.', { exact: true })).toBeVisible()
  const before = state.requests.length
  state.now = instant + 1000
  await page.clock.setFixedTime(new Date(state.now))
  await expect.poll(() => state.requests.length).toBeGreaterThan(before)
  await expect(page.locator('.vp-row.vp-checkin')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Check-in hoạt động', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/status=open/)
})
