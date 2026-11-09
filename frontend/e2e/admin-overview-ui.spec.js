import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const admin = { id: 'admin-overview-ui', full_name: 'Quản trị viên thử giao diện', username: 'admin-ui-secret', email: '', role: 'admin' }

async function mockOverview(page, { hold = false } = {}) {
  const state = { requests: 0, fail: false, data: {
    accounts: { total: 18, active: 15, locked: 3 },
    activities: { draft: 2, published: 7, completed: 4, cancelled: 1 },
    metrics: { attended_completed: 24 },
  } }
  const gate = hold ? new Promise(resolve => { state.release = resolve }) : Promise.resolve()
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: admin }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { ...admin, avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/reports/overview/')) {
      state.requests++
      await gate
      if (state.fail) return route.abort()
      data = state.data
    } else if (url.pathname.endsWith('/reports/activities/')) data = { count: 0, results: [], next: null, previous: null }
    else throw new Error(`Unexpected overview request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Tổng quan admin hiển thị số liệu, lối tắt và bố cục gọn trên mọi kích thước', async ({ page }, info) => {
  await mockOverview(page)
  await page.goto('/quan-tri')
  const dashboard = page.locator('.ad-dashboard')
  await expect(dashboard.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible()
  await expect(dashboard.locator('.ad-overview-stat strong')).toHaveText(['18', '3', '7', '24'])
  const targets = [
    ['Tổng tài khoản', '/quan-tri/tai-khoan'],
    ['Tài khoản bị khóa', '/quan-tri/tai-khoan?status=locked'],
    ['Hoạt động công khai', '/bao-cao/hoat-dong?status=published'],
    ['Lượt tham gia hoàn thành', '/bao-cao/dang-ky?metric=attended_completed'],
  ]
  for (const [label, to] of targets) await expect(dashboard.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveAttribute('href', to)
  await expect(dashboard.locator('.ad-overview-status strong')).toHaveText(['2', '7', '4', '1'])
  for (const [index, status] of ['draft', 'published', 'completed', 'cancelled'].entries()) {
    await expect(dashboard.locator('.ad-overview-status').nth(index)).toHaveAttribute('href', `/bao-cao/hoat-dong?status=${status}`)
  }
  await expect(dashboard.locator('.ad-overview-task')).toHaveCount(3)
  for (const [index, to] of ['/quan-tri/tai-khoan', '/quan-tri/phan-hoi', '/quan-tri/nhat-ky'].entries()) {
    await expect(dashboard.locator('.ad-overview-task').nth(index)).toHaveAttribute('href', to)
  }
  await expect(dashboard.getByText(/Xin chào|Tài khoản quản trị:|Chỉnh sửa hồ sơ|ĐIỀU HÀNH V-CONNECT|admin-ui-secret/)).toHaveCount(0)
  await expect(dashboard.getByRole('link', { name: 'Xem báo cáo', exact: true })).toHaveAttribute('href', '/bao-cao')
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const refresh = await dashboard.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox()
    const actions = await dashboard.locator('.ad-overview-actions').boundingBox()
    expect(Math.abs(refresh.x + refresh.width - actions.x - actions.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-stage1-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-overview.png`), fullPage: true })
  const published = dashboard.locator('.ad-overview-stat').filter({ hasText: 'Hoạt động công khai' })
  await published.focus()
  await expect(published).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/bao-cao\/hoat-dong\?status=published$/)
  await expect(page.getByRole('combobox', { name: 'Trạng thái hoạt động', exact: true })).toHaveValue('published')
})

test('Tổng quan admin không hiển thị số cũ khi tải lại và thử lại sau lỗi', async ({ page }) => {
  const state = await mockOverview(page)
  await page.goto('/quan-tri')
  await expect(page.locator('.ad-overview-stat strong')).toHaveText(['18', '3', '7', '24'])
  const beforeRefresh = state.requests
  state.fail = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  expect(state.requests).toBeGreaterThan(beforeRefresh)
  await expect(page.locator('.ad-overview-stat, .ad-overview-status')).toHaveCount(0)
  const beforeRetry = state.requests
  state.fail = false
  state.data = { accounts: { total: 0, active: 0, locked: 0 }, activities: {}, metrics: { attended_completed: 0 } }
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.ad-overview-stat strong')).toHaveText(['0', '0', '0', '0'])
  await expect(page.locator('.ad-overview-status strong')).toHaveText(['0', '0', '0', '0'])
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(state.requests).toBeGreaterThan(beforeRetry)
})

test('Tổng quan admin khóa nút Làm mới và ẩn số liệu khi đang tải', async ({ page }) => {
  const state = await mockOverview(page, { hold: true })
  await page.goto('/quan-tri')
  await expect(page.locator('.ad-dashboard')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('status')).toContainText('Đang tải dữ liệu')
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(page.locator('.ad-overview-stat')).toHaveCount(0)
  state.release()
  await expect(page.locator('.ad-dashboard')).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled()
  await expect(page.locator('.ad-overview-stat')).toHaveCount(4)
})
