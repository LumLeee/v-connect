import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/bang-xep-hang'
const levels = [
  { key: 'beginner', name: 'Khởi đầu', min_score: 0, max_score: 19 },
  { key: 'companion', name: 'Đồng hành', min_score: 20, max_score: 49 },
  { key: 'active', name: 'Tích cực', min_score: 50, max_score: 99 },
  { key: 'pioneer', name: 'Tiên phong', min_score: 100, max_score: 199 },
  { key: 'inspiration', name: 'Truyền cảm hứng', min_score: 200, max_score: null },
]
const companion = { ...levels[1], next_min_score: 50, next_name: 'Tích cực', progress: 16 }
async function mockLeaderboard(page) {
  const me = { full_name: 'Người kiểm tra', avatar_url: null, rank: 3, total_score: 25, level: companion, is_me: true }
  const state = { gets: 0, fail: false, data: { levels, limit: 20, updated_at: '2026-11-06T10:00:00Z', me, results: [
    { full_name: 'Bình An', avatar_url: '/api/v1/leaderboard/avatars/broken/', rank: 1, total_score: 40, level: companion, is_me: false, email: 'private@example.invalid', phone: '0912345678' },
    { full_name: 'Hoàng Hà với tên rất dài để kiểm tra bố cục ở điện thoại', avatar_url: null, rank: 1, total_score: 40, level: companion, is_me: false },
    me,
  ] } }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'leaderboard-ui', full_name: 'Người kiểm tra', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.includes('/leaderboard/avatars/')) return route.fulfill({ status: 404 })
    else if (url.pathname.endsWith('/leaderboard/')) {
      state.gets++
      if (state.fail) return route.abort()
      data = state.data
    } else throw new Error(`Unexpected leaderboard request: ${url.pathname}`)
    await route.fulfill({ json: data })
  })
  return state
}

test('Bảng xếp hạng: cá nhân, đồng hạng, riêng tư và bố cục hẹp', async ({ page }, info) => {
  await mockLeaderboard(page)
  await page.goto(base)
  const personal = page.getByRole('article', { name: 'Thứ hạng của tôi' })
  await expect(personal).toContainText('25 điểm')
  await expect(personal).toContainText('#3')
  await expect(personal).toContainText('Còn 25 điểm để đạt cấp Tích cực.')
  await expect(page.locator('.lb-row .lb-rank')).toHaveText(['#1', '#1', '#3'])
  await expect(page.locator('.lb-me')).toHaveCount(1)
  await expect(page.locator('.lb-me .lb-you')).toHaveText('Bạn')
  await expect(page.locator('.lb-board-heading')).toContainText('3 tình nguyện viên')
  await expect(page.locator('.lb-board')).not.toContainText('private@example.invalid')
  await expect(page.locator('.lb-board')).not.toContainText('0912345678')
  await expect(page.locator('.lb-row').first().locator('.lb-avatar svg')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xem điểm từng hoạt động', exact: true })).toHaveAttribute('href', '/tinh-nguyen-vien/dong-gop')
  await expect(page.locator('.lb-volunteer-rules')).not.toHaveAttribute('open', '')
  await page.getByText('Cách tính điểm và cấp bậc', { exact: true }).click()
  await expect(page.locator('.lb-volunteer-rules')).toContainText('20–49 điểm')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage4-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-leaderboard.png`), fullPage: true })
})

test('Bảng xếp hạng: lỗi tải, thử lại và điểm mới sau làm mới', async ({ page }) => {
  const state = await mockLeaderboard(page)
  state.fail = true
  await page.goto(base)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.lb-personal')).toHaveCount(0)
  state.fail = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.lb-personal')).toContainText('25 điểm')
  state.data.me = { ...state.data.me, total_score: 200, rank: 1, level: { ...levels[4], next_min_score: null, progress: 100 } }
  state.data.results = [state.data.me]
  const gets = state.gets
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets).toBeGreaterThan(gets)
  await expect(page.locator('.lb-personal')).toContainText('200 điểm')
  await expect(page.locator('.lb-personal')).toContainText('Bạn đã đạt cấp bậc cao nhất.')
  await expect(page.getByRole('progressbar', { name: 'Tiến độ cấp bậc' })).toHaveAttribute('value', '100')
  await expect(page.locator('.lb-row')).toHaveCount(1)
})

test('Bảng xếp hạng: chưa có điểm và cá nhân ngoài Top 20', async ({ page }) => {
  const state = await mockLeaderboard(page)
  state.data.me = { ...state.data.me, rank: null, total_score: 0, level: { ...levels[0], next_min_score: 20, next_name: 'Đồng hành', progress: 0 } }
  state.data.results = []
  await page.goto(base)
  await expect(page.locator('.lb-personal')).toContainText('0 điểm')
  await expect(page.locator('.lb-personal')).toContainText('Chưa xếp hạng')
  await expect(page.locator('.lb-empty')).toContainText('Chưa có tình nguyện viên có điểm đóng góp để xếp hạng.')
  await expect(page.locator('.lb-row')).toHaveCount(0)
  state.data.me = { ...state.data.me, rank: 23, total_score: 5 }
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.lb-personal')).toContainText('#23')
  await expect(page.locator('.lb-personal')).toContainText('Bạn không nằm trong danh sách 20 người bên dưới.')
  await expect(page.locator('.lb-me')).toHaveCount(0)
  state.data.me = { ...state.data.me, rank: 1, total_score: 10 }
  state.data.results = Array.from({ length: 20 }, (_, index) => ({ ...state.data.me, full_name: `Đồng hạng ${index + 1}`, is_me: false }))
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.lb-row')).toHaveCount(20)
  await expect(page.locator('.lb-personal')).toContainText('#1')
  await expect(page.locator('.lb-personal')).toContainText('Bạn không nằm trong danh sách 20 người bên dưới.')
  await expect(page.locator('.lb-me')).toHaveCount(0)
})
