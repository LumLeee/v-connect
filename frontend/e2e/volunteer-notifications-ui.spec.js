import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function fixture(page) {
  const state = { failList: false, failRead: false, failEmail: false, enabled: true, reads: 0, items: Array.from({ length: 14 }, (_, index) => ({
    id: `volunteer-notice-${index}`, title: `Kết quả đăng ký ${index + 1}`, body: 'Thông tin đăng ký hoạt động của bạn đã được cập nhật.', created_at: '2026-11-08T07:00:00Z',
    href: '/thong-bao?opened=true', read_at: index === 13 ? '2026-11-08T07:01:00Z' : null,
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'notification-volunteer', full_name: 'Tình nguyện viên', email: 'notice@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'notice-token' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: state.items.filter(item => !item.read_at).length, latest_id: state.items[0]?.id }
    else if (url.pathname.endsWith('/notifications/preferences/')) {
      if (request.method() === 'PATCH') {
        if (state.failEmail) return route.fulfill({ status: 503, json: { error: { message: 'Chưa lưu được email.' } } })
        state.enabled = request.postDataJSON().email_enabled
      }
      data = { email_available: true, email_enabled: state.enabled }
    } else if (url.pathname.endsWith('/read-all/') || url.pathname.endsWith('/read/')) {
      state.reads++
      if (state.failRead) return route.fulfill({ status: 503, json: { error: { message: 'Chưa đánh dấu được thông báo.' } } })
      for (const item of state.items) if (url.pathname.endsWith('/read-all/') || url.pathname.includes(`/${item.id}/`)) item.read_at = '2026-11-08T07:05:00Z'
      data = { updated: 1 }
    } else if (url.pathname.endsWith('/notifications/')) {
      if (state.failList) return route.abort()
      const unread = state.items.filter(item => !item.read_at).length
      const filter = url.searchParams.get('state'), pageNo = Number(url.searchParams.get('page') || 1)
      const rows = state.items.filter(item => filter === 'unread' ? !item.read_at : filter === 'read' ? item.read_at : true)
      const offset = (pageNo - 1) * 12
      if (offset && offset >= rows.length) return route.fulfill({ status: 404, json: { error: { message: 'Trang không tồn tại.' } } })
      data = { count: rows.length, summary: { total: state.items.length, unread, read: state.items.length - unread }, results: rows.slice(offset, offset + 12), next: offset + 12 < rows.length ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else throw new Error(`Unexpected volunteer notification request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Thông báo tình nguyện: tab có số đếm toàn bộ, phân trang và đánh dấu cuối trang', async ({ page }, info) => {
  await fixture(page)
  await page.goto('/thong-bao?state=unread')
  const unread = page.getByRole('button', { name: 'Chưa đọc', exact: true })
  await expect(unread).toHaveAttribute('aria-pressed', 'true')
  await expect(unread).toHaveText('Chưa đọc13')
  await expect(page.getByRole('button', { name: 'Tất cả', exact: true })).toHaveText('Tất cả14')
  await expect(page.locator('.notification-card.is-unread')).toHaveCount(12)
  await expect(page.locator('.notification-preference-disclosure')).not.toHaveAttribute('open')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.notification-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click()
  await expect(page).toHaveURL(/state=unread$/)
  await expect(unread).toHaveText('Chưa đọc12')
  await expect(page.locator('.notification-card')).toHaveCount(12)
  await page.getByRole('button', { name: 'Đã đọc', exact: true }).click()
  await expect(page.locator('.notification-card')).toHaveCount(2)
  await expect(page.locator('.notification-card.is-unread')).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage4-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-volunteer-notifications.png`), fullPage: true })
})

test('Thông báo tình nguyện: lỗi tải/đánh dấu giữ trang, thử lại và đánh dấu tất cả', async ({ page }) => {
  const state = await fixture(page)
  state.failList = true
  state.items[0].href = 'https://example.invalid'
  await page.goto('/thong-bao?state=unread')
  await expect(page.locator('.notifications-page > [role=alert]')).toContainText('Không kết nối được máy chủ')
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await page.locator('.notification-card').first().getByRole('button', { name: 'Mở nội dung liên quan', exact: true }).click()
  await expect(page.locator('.notifications-page > [role=alert]')).toHaveText('Thông báo này chưa có nội dung liên quan để mở.')
  expect(state.reads).toBe(0)
  state.items[0].href = '/thong-bao?opened=true'
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.notification-card')).toHaveCount(12)
  state.failRead = true
  await page.locator('.notification-card').first().getByRole('button', { name: 'Mở nội dung liên quan', exact: true }).click()
  await expect(page.locator('.notifications-page > [role=alert]')).toContainText('Máy chủ gặp lỗi khi xử lý yêu cầu')
  await expect(page).toHaveURL(/state=unread$/)
  await expect(page.locator('.notification-card.is-unread')).toHaveCount(12)
  state.failRead = false
  await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chưa có thông báo trong danh sách này', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chưa đọc', exact: true })).toHaveText('Chưa đọc0')
  await expect(page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Đã đọc', exact: true }).click()
  await page.locator('.notification-card').first().focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/opened=true$/)
  expect(state.reads).toBe(2)
})

test('Thông báo tình nguyện: khôi phục trang quá giới hạn và email lỗi giữ lựa chọn', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/thong-bao?state=read&page=99')
  await expect(page).toHaveURL(/state=read$/)
  await expect(page.locator('.notification-card')).toHaveCount(1)
  const settings = page.locator('.notification-preference-disclosure')
  await settings.locator('summary').click()
  await expect(settings).toContainText('đã được duyệt trước mốc nhắc')
  const email = settings.getByLabel('Nhận thông báo qua email', { exact: true })
  state.failEmail = true
  await email.uncheck()
  await expect(page.locator('.notifications-page > [role=alert]')).toContainText('Máy chủ gặp lỗi khi xử lý yêu cầu')
  await expect(email).toBeChecked()
  state.failEmail = false
  await email.uncheck()
  await expect(page.getByText('Đã tắt email thông báo.', { exact: true })).toBeVisible()
  await page.reload()
  await settings.locator('summary').click()
  await expect(email).not.toBeChecked()
})
