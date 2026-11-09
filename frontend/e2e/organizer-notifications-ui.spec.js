import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function fixtures(page, role = 'organizer') {
  await page.clock.install({ time: new Date('2026-11-04T17:15:00Z') })
  const state = { role, failList: false, failPreferences: false, failToggle: false, enabled: true, items: Array.from({ length: 14 }, (_, index) => ({
    id: `notice-${index}`, title: `Cập nhật hoạt động ${index + 1}`, body: 'Có thông tin mới cần xem.',
    created_at: index < 5 ? '2026-11-04T17:05:00Z' : index < 9 ? '2026-11-04T16:55:00Z' : '2026-11-02T08:00:00Z',
    read_at: index === 13 ? '2026-11-03T08:00:00Z' : null, href: '/thong-bao?from=notification',
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: `notice-ui-${state.role}`, role: state.role, full_name: 'Người kiểm tra', email: 'notice@example.invalid' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'notice-ui-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: state.items.filter(item => !item.read_at).length, latest_id: state.items[0]?.id }
    else if (url.pathname.endsWith('/notifications/preferences/')) {
      if (state.failPreferences && request.method() === 'GET') return route.abort()
      if (request.method() === 'PATCH') {
        if (state.failToggle) return route.fulfill({ status: 400, json: { error: { message: 'Chưa lưu được tùy chọn email.' } } })
        state.enabled = request.postDataJSON().email_enabled
      }
      data = { email_enabled: state.enabled, email_available: state.role !== 'admin' }
    } else if (url.pathname.endsWith('/read-all/')) {
      state.items.forEach(item => { item.read_at = '2026-11-04T17:15:00Z' }); data = { updated: state.items.length }
    } else if (url.pathname.endsWith('/read/')) {
      const item = state.items.find(entry => url.pathname.includes(`/${entry.id}/`))
      item.read_at = '2026-11-04T17:15:00Z'; data = item
    } else if (url.pathname.endsWith('/notifications/')) {
      if (state.failList) return route.abort()
      const filter = url.searchParams.get('state'), pageNo = Number(url.searchParams.get('page') || 1)
      const items = state.items.filter(item => filter === 'unread' ? !item.read_at : filter === 'read' ? item.read_at : true)
      const offset = (pageNo - 1) * 12
      if (offset && offset >= items.length) return route.fulfill({ status: 404, json: { error: { message: 'Trang không tồn tại.' } } })
      data = { count: items.length, results: items.slice(offset, offset + 12), next: offset + 12 < items.length ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else throw new Error(`Unexpected notifications UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Thông báo nhà tổ chức: nhóm theo ngày Việt Nam, thu gọn email và đọc mục cuối trang', async ({ page }, info) => {
  await fixtures(page)
  await page.goto('/thong-bao')
  await expect(page.locator('.notifications-eyebrow')).toHaveCount(0)
  const email = page.locator('.notification-preference-disclosure')
  await expect(email).not.toHaveAttribute('open')
  await expect(page.locator('.notification-day > h2')).toHaveText(['Hôm nay', 'Hôm qua', '2 tháng 11, 2026'])
  await expect(page.getByRole('region', { name: 'Hôm nay', exact: true }).locator('.notification-card')).toHaveCount(5)
  await expect(page.locator('.notification-card.is-unread')).toHaveCount(12)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/remaining-organizer-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-notifications.png`), fullPage: true })
  await email.locator('summary').click()
  await expect(email.getByLabel('Nhận thông báo qua email')).toBeChecked()
  await expect(email).not.toContainText('đã được duyệt trước mốc nhắc')
  await page.getByLabel('Hiển thị', { exact: true }).selectOption('unread')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.notification-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click()
  await expect(page).toHaveURL(/state=unread$/)
  await expect(page.locator('.notification-card')).toHaveCount(12)
  await expect(page.getByRole('status')).toContainText('Đã đánh dấu thông báo là đã đọc.')
  await page.getByLabel('Hiển thị', { exact: true }).selectOption('read')
  await expect(page.locator('.notification-card')).toHaveCount(2)
  await page.locator('.notification-card').first().focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/from=notification$/)
  await page.getByLabel('Hiển thị', { exact: true }).selectOption('unread')
  await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chưa có thông báo trong danh sách này', exact: true })).toBeVisible()
})

test('Thông báo nhà tổ chức: thử lại lỗi tải và khôi phục lựa chọn email khi lưu thất bại', async ({ page }) => {
  const state = await fixtures(page)
  state.failList = true; state.failPreferences = true
  await page.goto('/thong-bao')
  await expect(page.locator('.notifications-page > [role="alert"]')).toContainText('Không kết nối được máy chủ')
  state.failList = false
  await page.locator('.notifications-page > [role="alert"]').getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.notification-card')).toHaveCount(12)
  const email = page.locator('.notification-preference-disclosure')
  await email.locator('summary').click()
  await expect(email.getByRole('alert')).toBeVisible()
  state.failPreferences = false
  await email.getByRole('button', { name: 'Thử lại', exact: true }).click()
  const checkbox = email.getByLabel('Nhận thông báo qua email')
  await expect(checkbox).toBeChecked()
  state.failToggle = true
  await checkbox.uncheck()
  await expect(page.locator('.notifications-page > [role="alert"]')).toHaveText('Chưa lưu được tùy chọn email.')
  await expect(checkbox).toBeChecked()
  state.failToggle = false
  await checkbox.uncheck()
  await expect(page.getByRole('status')).toContainText('Đã tắt email thông báo.')
  await page.reload()
  await email.locator('summary').click()
  await expect(checkbox).not.toBeChecked()
})

test('Thông báo: giữ bố cục tình nguyện viên và mô tả email đúng vai trò', async ({ page }) => {
  const state = await fixtures(page, 'volunteer')
  await page.goto('/thong-bao')
  await expect(page.locator('.notifications-eyebrow')).toHaveCount(0)
  await expect(page.locator('.notification-preference-disclosure')).toHaveCount(1)
  await page.locator('.notification-preference-disclosure summary').click()
  await expect(page.locator('.notification-preference')).toContainText('đã được duyệt trước mốc nhắc')
  await expect(page.locator('.notification-day')).toHaveCount(0)
  state.role = 'admin'
  await page.reload()
  await expect(page.locator('.notification-preference-disclosure')).toHaveCount(0)
  await expect(page.locator('.notification-preference')).not.toContainText('đã được duyệt trước mốc nhắc')
  await expect(page.getByText('Tài khoản chưa có email nên hiện chỉ nhận thông báo trong website.')).toBeVisible()
})
