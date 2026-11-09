import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/bao-cao/hoat-dong'
const entry = index => ({ id: `activity-${index}`, title: `Hoạt động cộng đồng ${String(index).padStart(2, '0')}`, status: index % 2 ? 'published' : 'completed', organizer_name: 'Nhóm tình nguyện cộng đồng', starts_at: '2026-02-03T02:00:00Z', ends_at: '2026-02-03T05:00:00Z', capacity: 12, approved_count: 5 })

async function fixtures(page, { hold = false } = {}) {
  const state = { entries: Array.from({ length: 14 }, (_, index) => entry(index + 1)), gets: [], fail: false }
  const gate = hold ? new Promise(resolve => { state.release = resolve }) : Promise.resolve()
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-activities-ui', full_name: 'Quản trị thử giao diện', username: 'admin', role: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/reports/activities/')) {
      state.gets.push(url.search)
      await gate
      if (state.fail) return route.abort()
      const keyword = (url.searchParams.get('search') || '').toLocaleLowerCase('vi-VN'), status = url.searchParams.get('status')
      const entries = state.entries.filter(item => (!keyword || item.title.toLocaleLowerCase('vi-VN').includes(keyword)) && (!status || item.status === status))
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      data = { count: entries.length, results: entries.slice(offset, offset + 12), previous: pageNo > 1 ? 'previous' : null, next: entries.length > offset + 12 ? 'next' : null }
    } else if (url.pathname.includes('/reports/activities/activity-')) {
      const id = url.pathname.split('/').at(-2)
      data = { activity: state.entries.find(item => item.id === id), metrics: { registered: 0, approved: 0, attended_completed: 0, feedback: { count: 0, average_rating: null } } }
    } else throw new Error(`Unexpected admin activity UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Admin hoạt động: URL, phân trang, quay lại, bỏ bộ lọc và mở dòng bằng bàn phím', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(`${base}?status=published`)
  const filters = page.getByRole('form', { name: 'Bộ lọc hoạt động' })
  await expect(filters.getByLabel('Trạng thái hoạt động', { exact: true })).toHaveValue('published')
  await expect(page.locator('.ad-system-activity-results')).toContainText('7 hoạt động phù hợp bộ lọc')
  await filters.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await expect(page.locator('.ad-system-activity-results')).toContainText('14 hoạt động trong hệ thống')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.ad-system-activity-row h2')).toHaveText(['Hoạt động cộng đồng 13', 'Hoạt động cộng đồng 14'])
  await filters.getByLabel('Tìm hoạt động', { exact: true }).fill('13')
  await filters.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  await expect(page.locator('.ad-system-activity-row h2')).toHaveText(['Hoạt động cộng đồng 13'])
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await page.goBack()
  await expect(filters.getByLabel('Tìm hoạt động', { exact: true })).toHaveValue('')
  await expect(page.locator('.ad-system-activity-row')).toHaveCount(2)
  await page.goForward()
  await expect(filters.getByLabel('Tìm hoạt động', { exact: true })).toHaveValue('13')
  await page.getByRole('button', { name: 'Bỏ bộ lọc Tìm: 13', exact: true }).click()
  await expect(page.locator('.ad-system-activity-row')).toHaveCount(12)
  expect(state.gets.at(-1)).toContain('page_size=12')
  const row = page.locator('.ad-system-activity-row').first()
  await row.focus()
  await expect(row).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/bao-cao\/hoat-dong\/activity-1$/)
  await expect(page.getByRole('heading', { name: 'Kết quả hoạt động', exact: true })).toBeVisible()
})

test('Admin hoạt động: chỉ dùng dữ liệu API, dòng ngang và không tràn màn hình', async ({ page }, info) => {
  await fixtures(page)
  await page.goto(base)
  await expect(page.getByRole('heading', { name: 'Hoạt động toàn hệ thống', exact: true })).toBeVisible()
  const row = page.locator('.ad-system-activity-row').first()
  await expect(row).toContainText('Nhóm tình nguyện cộng đồng')
  await expect(row).toContainText('5 người')
  await expect(row).toContainText('Cần tuyển 12 người')
  await expect(row.locator('time')).toHaveCount(2)
  await expect(row.getByRole('button')).toHaveCount(0)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Activities at ${width}px`).toBe(true)
    const refresh = await page.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox(), header = await page.locator('.ad-system-activity-heading').boundingBox()
    expect(Math.abs(refresh.x + refresh.width - header.x - header.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-stage2-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-system-activities.png`), fullPage: true })
})

test('Admin hoạt động: tải, làm mới, thử lại và danh sách rỗng không giữ dữ liệu cũ', async ({ page }) => {
  const state = await fixtures(page, { hold: true })
  await page.goto(base)
  await expect(page.locator('.ad-system-activities')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(page.locator('.ad-system-activity-row')).toHaveCount(0)
  state.release()
  await expect(page.locator('.ad-system-activity-row')).toHaveCount(12)
  state.fail = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.ad-system-activity-row')).toHaveCount(0)
  state.fail = false; state.entries = []
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Không có hoạt động phù hợp', exact: true })).toBeVisible()
  await expect(page.locator('.ad-system-activity-results')).toContainText('0 hoạt động trong hệ thống')
  await expect(page.getByRole('navigation', { name: 'Phân trang', exact: true })).toHaveCount(0)
})
