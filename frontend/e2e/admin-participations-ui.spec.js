import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const activity = { id: 'scope-activity', title: 'Chương trình cộng đồng', organizer_name: 'Nhóm tình nguyện', status: 'completed', starts_at: '2026-02-03T02:00:00Z', ends_at: '2026-02-03T05:00:00Z', capacity: 30, time_checks_disabled: true }
const entry = index => ({ id: `registration-${index}`, activity, status: index % 2 ? 'approved' : 'pending', volunteer_name: `Tình nguyện viên ${String(index).padStart(2, '0')}`, volunteer_email: `volunteer${index}@example.invalid`, volunteer_phone: index % 2 ? '0900000000' : '', registered_at: '2026-02-01T03:00:00Z', reviewed_at: index % 2 ? '2026-02-02T02:00:00Z' : null, cancellation_reason: '', attendance: index % 2 ? { confirmed_at: '2026-02-03T02:10:00Z', confirmed_by_name: 'Nhà tổ chức cộng đồng', method: 'manual' } : null })
async function fixtures(page, { hold = false } = {}) {
  const state = { entries: Array.from({ length: 28 }, (_, index) => entry(index + 1)), requests: [], fail: false }
  const gate = hold ? new Promise(resolve => { state.release = resolve }) : Promise.resolve()
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-participation-ui', full_name: 'Quản trị giao diện', role: 'admin', username: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/reports/activities/scope-activity/')) data = { activity, metrics: { registered: 28, approved: 14, attended_completed: 14, feedback: { count: 0, average_rating: null } } }
    else if (url.pathname.endsWith('/reports/participations/')) {
      state.requests.push(url.search); await gate
      if (state.fail) return route.abort()
      const metric = url.searchParams.get('metric') || 'registered'
      const entries = state.entries.filter(item => metric === 'registered' || (metric === 'attended_completed' ? item.attendance : item.status === metric))
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      data = { count: entries.length, results: entries.slice(offset, offset + 12), previous: pageNo > 1 ? 'previous' : null, next: entries.length > offset + 12 ? 'next' : null }
    } else throw new Error(`Unexpected admin participation UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Đăng ký admin: giữ phạm vi hoạt động, phân trang, URL và khôi phục bộ lọc khi quay lại', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto('/bao-cao/dang-ky?metric=approved&activity=scope-activity&page=2')
  const form = page.getByRole('form', { name: 'Bộ lọc đăng ký' })
  await expect(page.getByRole('heading', { name: 'Chi tiết đăng ký', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Hoạt động đang xem' })).toContainText('Chương trình cộng đồng')
  await expect(page.locator('.ad-participation-results')).toContainText('14 đơn · Được duyệt')
  await expect(page.locator('.ad-participation-row')).toHaveCount(2)
  await form.getByLabel('Loại số liệu', { exact: true }).selectOption('pending')
  await form.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  await expect(page.locator('.ad-participation-row')).toHaveCount(12)
  expect(new URL(page.url()).searchParams.get('activity')).toBe('scope-activity')
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await page.goBack()
  await expect(form.getByLabel('Loại số liệu', { exact: true })).toHaveValue('approved')
  await expect(page.locator('.ad-participation-row')).toHaveCount(2)
  await page.goForward()
  await expect(form.getByLabel('Loại số liệu', { exact: true })).toHaveValue('pending')
  await page.getByRole('button', { name: 'Bỏ phạm vi hoạt động', exact: true }).click()
  await expect(page.locator('.ad-participation-context')).toHaveCount(0)
  await expect(page.locator('.ad-participation-results')).toContainText('Toàn hệ thống')
  expect(new URLSearchParams(state.requests.at(-1)).has('activity')).toBe(false)
  await page.goBack()
  await expect(page.getByRole('region', { name: 'Hoạt động đang xem' })).toBeVisible()
  await form.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await expect(page.locator('.ad-participation-results')).toContainText('28 đơn · Tổng đơn đăng ký')
  expect(new URL(page.url()).searchParams.has('activity')).toBe(false)
  await expect(form.getByLabel('Loại số liệu', { exact: true })).toHaveValue('registered')
})

test('Đăng ký admin: đối chiếu dữ liệu, chi tiết an toàn bằng bàn phím và bố cục mọi kích thước', async ({ page }, info) => {
  const state = await fixtures(page)
  state.entries[0].volunteer_name = '<script>window.injected=true</script>'
  await page.goto('/bao-cao/dang-ky?metric=attended_completed&activity=scope-activity')
  const row = page.locator('.ad-participation-row').first()
  await expect(row).toContainText('Đã có mặt')
  await expect(row).toContainText('volunteer1@example.invalid')
  await expect(row.locator('time')).toHaveCount(2)
  await expect(row.getByRole('button')).toHaveCount(0)
  await row.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('<script>window.injected=true</script>')
  await expect(dialog).toContainText('Nhà tổ chức cộng đồng')
  await expect(dialog).toContainText('Thời gian điểm danh')
  await expect(dialog.getByRole('link', { name: 'Kết quả hoạt động', exact: true })).toHaveAttribute('href', '/bao-cao/hoat-dong/scope-activity')
  await expect(dialog.locator('script')).toHaveCount(0)
  expect(await page.evaluate(() => window.injected)).toBeUndefined()
  await page.keyboard.press('Escape')
  await expect(row).toBeFocused()
  await page.keyboard.press('Space'); await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Participations ${width}px`).toBe(true)
    const refresh = await page.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox(), header = await page.locator('.ad-participation-heading').boundingBox()
    expect(Math.abs(refresh.x + refresh.width - header.x - header.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-remaining-preview'; await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-participations.png`), fullPage: true })
})

test('Đăng ký admin: tải, lỗi, thử lại và trang rỗng', async ({ page }) => {
  const state = await fixtures(page, { hold: true })
  await page.goto('/bao-cao/dang-ky')
  await expect(page.locator('.ad-participations')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  state.release(); await expect(page.locator('.ad-participation-row')).toHaveCount(12)
  state.fail = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.ad-participation-row')).toHaveCount(0)
  state.fail = false; state.entries = []
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Không có đăng ký phù hợp', exact: true })).toBeVisible()
  await expect(page.locator('.ad-participation-results')).toContainText('0 đơn')
  await expect(page.getByRole('navigation', { name: 'Phân trang', exact: true })).toHaveCount(0)
})
