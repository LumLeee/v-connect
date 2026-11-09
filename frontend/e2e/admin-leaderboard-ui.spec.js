import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const levels = [
  { key: 'beginner', name: 'Khởi đầu', min_score: 0, max_score: 19 },
  { key: 'companion', name: 'Đồng hành', min_score: 20, max_score: 49 },
  { key: 'inspiration', name: 'Truyền cảm hứng', min_score: 100, max_score: null },
]

async function fixtures(page, { hold = false } = {}) {
  const state = { gets: 0, fail: false, data: { results: Array.from({ length: 20 }, (_, i) => ({ rank: i < 2 ? 1 : i + 1, full_name: `Tình nguyện viên ${String(i + 1).padStart(2, '0')}`, total_score: i < 2 ? 30 : 28 - i, level: levels[1], avatar_url: null, is_me: false })), levels, updated_at: '2025-02-03T02:30:00Z', me: { full_name: 'Không hiển thị hồ sơ admin', rank: null, total_score: 0, level: levels[0] } } }
  const gate = hold ? new Promise(resolve => { state.release = resolve }) : Promise.resolve()
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-leaderboard-ui', full_name: 'Quản trị kiểm thử', username: 'admin', role: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/leaderboard/')) {
      state.gets++
      await gate
      if (state.fail) return route.abort()
      data = state.data
    } else throw new Error(`Unexpected leaderboard request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Bảng xếp hạng admin giữ thứ hạng thực, đồng hạng, cấp bậc và bố cục gọn', async ({ page }, info) => {
  const state = await fixtures(page)
  state.data.results[0].full_name = 'Nguyễn Minh Anh với họ tên dài để kiểm tra cách hiển thị trên điện thoại'
  await page.goto('/bang-xep-hang')
  const board = page.locator('.lb-admin')
  await expect(board.getByRole('heading', { name: 'Bảng xếp hạng tình nguyện viên', exact: true })).toBeVisible()
  await expect(board.locator('.lb-row')).toHaveCount(20)
  await expect(board.locator('.lb-rank').first()).toHaveText('#1')
  await expect(board.locator('.lb-rank').nth(1)).toHaveText('#1')
  await expect(board.locator('.lb-rank').nth(2)).toHaveText('#3')
  await expect(board.locator('.lb-score strong')).toHaveText(state.data.results.map(row => String(row.total_score)))
  await expect(board.locator('.lb-row > .lb-level')).toHaveText(state.data.results.map(row => row.level.name))
  await expect(board.locator('.lb-personal,.lb-eyebrow')).toHaveCount(0)
  await expect(board).not.toContainText('Không hiển thị hồ sơ admin')
  const rules = board.locator('.lb-admin-rules')
  await expect(rules).not.toHaveAttribute('open', '')
  await rules.locator('summary').focus(); await page.keyboard.press('Enter')
  await expect(rules).toHaveAttribute('open', '')
  await expect(rules).toContainText('Người bằng điểm có cùng thứ hạng')
  await expect(rules).toContainText('Không hiển thị email, số điện thoại hoặc hồ sơ riêng tư')
  await expect(rules).toContainText('Từ 100 điểm')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `leaderboard at ${width}px`).toBe(true)
    const heading = await board.locator('.lb-heading').boundingBox(), refresh = await board.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox()
    expect(Math.abs(heading.x + heading.width - refresh.x - refresh.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-remaining-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-leaderboard.png`), fullPage: true })
  state.data.results[0].total_score = 35
  const before = state.gets
  await board.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(board.locator('.lb-score strong').first()).toHaveText('35')
  expect(state.gets).toBeGreaterThan(before)
})

test('Bảng xếp hạng admin: lỗi có thể thử lại, danh sách trống và thời gian thiếu', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto('/bang-xep-hang')
  await expect(page.locator('.lb-row')).toHaveCount(20)
  state.fail = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.lb-row')).toHaveCount(0)
  state.fail = false
  state.data.results = []; state.data.updated_at = 'invalid-time'
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.lb-empty')).toContainText('Chưa có tình nguyện viên có điểm đóng góp để xếp hạng')
  await expect(page.locator('.lb-board-heading')).toContainText('0 tình nguyện viên')
  await expect(page.locator('.lb-updated')).toContainText('chưa có thông tin')
  await expect(page.locator('.lb-admin')).not.toContainText('Invalid Date')
})

test('Bảng xếp hạng admin: khóa Làm mới và chưa hiện số liệu trong lúc tải', async ({ page }) => {
  const state = await fixtures(page, { hold: true })
  await page.goto('/bang-xep-hang')
  await expect(page.locator('.lb-admin').getByRole('status')).toContainText('Đang tải dữ liệu')
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(page.locator('.lb-board')).toHaveCount(0)
  state.release()
  await expect(page.locator('.lb-row')).toHaveCount(20)
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled()
})
