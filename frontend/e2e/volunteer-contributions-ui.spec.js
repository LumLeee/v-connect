import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/tinh-nguyen-vien/dong-gop'
async function mockContributions(page) {
  const state = { gets: 0, statisticsGets: 0, failList: false, failHistory: false, items: Array.from({ length: 16 }, (_, index) => ({
    id: `attendance-${index}`, volunteer_name: 'Người kiểm tra', confirmed_at: '2026-11-02T07:00:00Z',
    activity: { id: `activity-${index}`, title: `${index < 14 ? 'Bếp cộng đồng' : 'Rừng xanh'} ${index + 1}`, organizer_name: 'Nhóm cộng đồng', status: 'completed', starts_at: '2026-11-02T06:00:00Z', max_score: 10 },
    contribution: index < 13 ? null : { score: index === 13 ? 0 : 8, revision: 2, confirmed_by_name: 'Nhóm cộng đồng', updated_at: '2026-11-03T07:00:00Z' },
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'contribution-ui', full_name: 'Người kiểm tra', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/reports/overview/')) {
      state.statisticsGets++
      data = { metrics: { registered: 24, approved: 20, pending: 2, attended_completed: 16, rejected: 1, cancelled: 1, attended_ongoing: 2, attended_cancelled: 1, feedback: { count: 5, average_rating: 4.6 } } }
    } else if (url.pathname.endsWith('/history/')) {
      if (state.failHistory) return route.abort()
      data = { count: 2, next: null, previous: null, results: [
        { revision: 2, previous_score: 8, score: 0, reason: 'Đối chiếu lại đóng góp', actor_name: 'Nhóm cộng đồng', created_at: '2026-11-03T07:00:00Z' },
        { revision: 1, previous_score: null, score: 8, reason: '', actor_name: 'Nhóm cộng đồng', created_at: '2026-11-02T12:00:00Z' },
      ] }
    } else if (url.pathname.endsWith('/contributions/')) {
      state.gets++
      if (state.failList) return route.abort()
      const search = (url.searchParams.get('search') || '').toLowerCase(), status = url.searchParams.get('status') || 'all'
      const searched = state.items.filter(item => item.activity.title.toLowerCase().includes(search))
      const summary = { score: searched.reduce((sum, item) => sum + (item.contribution?.score || 0), 0), confirmed: searched.filter(item => item.contribution).length, pending: searched.filter(item => !item.contribution).length }
      const filtered = searched.filter(item => status === 'all' || Boolean(item.contribution) === (status === 'confirmed'))
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      if (pageNo > 1 && offset >= filtered.length) return route.fulfill({ status: 404, json: { detail: 'Trang không tồn tại.' } })
      data = { count: filtered.length, summary, results: filtered.slice(offset, offset + 12), next: filtered.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else throw new Error(`Unexpected contributions request: ${url.pathname}`)
    await route.fulfill({ json: data })
  })
  return state
}
async function capture(page, info) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage4-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-contributions.png`), fullPage: true })
}

test('Đóng góp: đếm trước phân trang, lọc URL và điểm 0 đã chấm', async ({ page }, info) => {
  await mockContributions(page)
  await page.goto(base)
  const filters = page.getByRole('group', { name: 'Lọc trạng thái đóng góp' })
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('16')
  await expect(filters.getByRole('button', { name: /^Chờ chấm/ })).toContainText('13')
  await expect(page.locator('.mc-total > strong')).toHaveText('16điểm')
  await expect(page.locator('.mc-row')).toHaveCount(12)
  await filters.getByRole('button', { name: /^Chờ chấm/ }).click()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.mc-row')).toHaveCount(1)
  await expect(page).toHaveURL(/status=pending.*page=2/)
  await page.getByLabel('Tìm hoạt động đóng góp', { exact: true }).fill(' Bếp cộng đồng ')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await filters.getByRole('button', { name: /^Đã chấm/ }).click()
  await expect(page.locator('.mc-row')).toHaveCount(1)
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('14')
  await expect(page.locator('.mc-row-score > strong')).toHaveText('0điểm')
  await expect(page.locator('.mc-status')).toHaveText('Đã chấm điểm')
  await expect(page.locator('.mc-total > strong')).toHaveText('0điểm')
  await expect(page.getByLabel('Đóng góp trong kết quả tìm kiếm')).toBeVisible()
  await page.locator('.mc-row').focus(); await page.keyboard.press('Enter')
  const details = page.getByRole('dialog', { name: 'Bếp cộng đồng 14', exact: true })
  await expect(details).toContainText('Điểm đóng góp: 0 điểm')
  await expect(details.getByRole('link', { name: 'Xem hoạt động', exact: true })).toHaveCount(0)
  await details.getByRole('button', { name: 'Đóng', exact: true }).click()
  await capture(page, info)
})

test('Đóng góp: lỗi mạng, lịch sử điều chỉnh và làm mới thống kê', async ({ page }) => {
  const state = await mockContributions(page)
  state.failList = true
  await page.goto(`${base}?status=confirmed`)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.mc-row')).toHaveCount(3)
  state.failHistory = true
  await page.locator('.mc-row').first().getByRole('button', { name: 'Lịch sử điều chỉnh', exact: true }).click()
  const history = page.getByRole('dialog', { name: 'Lịch sử điều chỉnh đóng góp', exact: true })
  await expect(history.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failHistory = false
  await history.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(history).toContainText('8 điểm → 0 điểm')
  await expect(history).toContainText('Lý do: Đối chiếu lại đóng góp')
  await page.keyboard.press('Escape')
  await page.getByText('Thống kê tham gia', { exact: true }).click()
  await expect(page.locator('.mc-stat-grid > a').first()).toContainText('24')
  await expect(page.locator('.mc-statistics')).toContainText('5 phản hồi hợp lệ')
  const gets = state.gets, reports = state.statisticsGets
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets).toBeGreaterThan(gets)
  await expect.poll(() => state.statisticsGets).toBeGreaterThan(reports)
  await expect(page).toHaveURL(/status=confirmed/)
})

test('Đóng góp: bộ lọc rỗng, hồi phục trang mất và tài khoản mới', async ({ page }) => {
  const state = await mockContributions(page)
  await page.goto(`${base}?search=Bếp&status=confirmed&page=99`)
  await page.getByRole('button', { name: 'Về trang đầu', exact: true }).click()
  await expect(page).toHaveURL(/search=B%E1%BA%BFp&status=confirmed&page=1/)
  await expect(page.locator('.mc-row')).toHaveCount(1)
  await page.getByLabel('Tìm hoạt động đóng góp', { exact: true }).fill('Không tồn tại')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Không có đóng góp phù hợp với bộ lọc', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem tất cả đóng góp', exact: true }).click()
  await expect(page.locator('.mc-row')).toHaveCount(12)
  state.items = []
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chưa có đóng góp được ghi nhận', exact: true })).toBeVisible()
  await expect(page.locator('.mc-total > strong')).toHaveText('0điểm')
  await expect(page.getByRole('link', { name: 'Khám phá hoạt động', exact: true })).toHaveAttribute('href', '/hoat-dong')
})
