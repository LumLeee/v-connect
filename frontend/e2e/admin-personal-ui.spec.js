import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT0QAAAAASUVORK5CYII='
const original = { id: 'admin-personal-ui', username: 'admin-personal', full_name: 'Quản trị viên', email: '', role: 'admin', phone: '', bio: '', avatar_url: null }

async function fixtures(page) {
  const state = { profile: { ...original }, profilePosts: [], avatarPosts: 0, readPosts: [], preferencePosts: [], email: true,
    failList: false, failPreference: false, failProfile: false, profileGate: null, listGate: null,
    items: Array.from({ length: 14 }, (_, index) => ({ id: `notice-${index}`, title: `Thông báo ${index + 1}`, body: index === 4 ? '<img src=x onerror="window.noticeInjected=true">' : `Nội dung cập nhật ${index + 1}.`,
      href: index === 1 ? '' : index === 2 ? 'javascript:alert(1)' : index === 3 ? '//example.invalid' : '/quan-tri',
      read_at: index < 2 ? null : '2026-11-01T02:00:00Z', created_at: index === 5 ? 'invalid-date' : new Date(Date.now() - index * 86400000).toISOString() })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/admin-personal-avatar.png*', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: state.profile }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'personal-csrf' }
    else if (url.pathname.endsWith('/auth/profile/avatar/')) {
      state.avatarPosts++; state.profile.avatar_url = request.method() === 'DELETE' ? null : '/admin-personal-avatar.png'
      data = { avatar_url: state.profile.avatar_url }
    } else if (url.pathname.endsWith('/auth/profile/')) {
      if (request.method() === 'PATCH') {
        state.profilePosts.push(request.postDataJSON()); if (state.profileGate) await state.profileGate
        if (state.failProfile) return route.fulfill({ status: 400, json: { error: { details: { full_name: ['Họ tên chưa hợp lệ.'] } } } })
        Object.assign(state.profile, request.postDataJSON())
      }
      data = { profile: state.profile }
    } else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: state.items.filter(item => !item.read_at).length, latest_id: state.items[0]?.id || null }
    else if (url.pathname.endsWith('/notifications/preferences/')) {
      if (request.method() === 'PATCH') {
        state.preferencePosts.push(request.postDataJSON())
        if (state.failPreference) return route.fulfill({ status: 503, json: {} })
        state.email = request.postDataJSON().email_enabled
      }
      data = { email_enabled: state.email, email_available: false }
    } else if (url.pathname.endsWith('/notifications/read-all/') || /\/notifications\/[^/]+\/read\/$/.test(url.pathname)) {
      state.readPosts.push(url.pathname)
      const id = url.pathname.split('/').at(-3)
      for (const item of state.items) if (url.pathname.endsWith('/read-all/') || item.id === id) item.read_at = new Date().toISOString()
      data = { updated: 1 }
    } else if (url.pathname.endsWith('/notifications/')) {
      if (state.listGate) await state.listGate
      if (state.failList) return route.fulfill({ status: 503, json: {} })
      const selected = url.searchParams.get('state') || 'all', current = Number(url.searchParams.get('page') || 1)
      const items = state.items.filter(item => selected === 'all' || (selected === 'read') === Boolean(item.read_at))
      data = { count: items.length, results: items.slice((current - 1) * 12, current * 12), next: current * 12 < items.length ? 'next' : null,
        previous: current > 1 ? 'previous' : null, summary: { total: state.items.length, unread: state.items.filter(item => !item.read_at).length, read: state.items.filter(item => item.read_at).length } }
    } else if (url.pathname.endsWith('/reports/overview/')) data = { accounts: { total: 1, active: 1, locked: 0 }, activities: {}, metrics: { attended_completed: 0 } }
    else throw new Error(`Unexpected personal request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${width}`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Thông báo admin: bộ lọc, phân trang và quay lại dùng tổng số API', async ({ page }, info) => {
  await fixtures(page)
  await page.goto('/thong-bao')
  await expect(page.locator('.ad-notification-count')).toHaveText('14 thông báo.')
  await expect(page.getByRole('button', { name: 'Chưa đọc', exact: true })).toContainText('2')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.ad-notification-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click()
  await expect(page.locator('.ad-notification-count')).toHaveText('2 thông báo chưa đọc.')
  await expect(page.locator('.ad-notification-row')).toHaveCount(2)
  await page.goBack()
  await expect(page.locator('.ad-notification-row')).toHaveCount(2)
  expect(new URL(page.url()).searchParams.get('page')).toBe('2')
  await page.goForward()
  await expect(page.getByRole('button', { name: 'Chưa đọc', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await capture(page, info, 'admin-notifications')
})

test('Thông báo admin: mở dòng bằng bàn phím, đánh dấu riêng và chặn liên kết không hợp lệ', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto('/thong-bao?state=unread')
  let row = page.locator('.ad-notification-row').filter({ hasText: 'Thông báo 2' })
  await row.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click()
  await expect(page).toHaveURL(/\/thong-bao\?state=unread$/)
  await expect(page.locator('.ad-notification-count')).toHaveText('1 thông báo chưa đọc.')
  expect(state.readPosts).toEqual(['/api/v1/notifications/notice-1/read/'])
  row = page.locator('.ad-notification-row')
  await row.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/quan-tri$/)
  expect(state.readPosts).toHaveLength(2)
  await page.goto('/thong-bao')
  for (const title of ['Thông báo 3', 'Thông báo 4']) {
    const unsafe = page.locator('.ad-notification-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    await expect(unsafe).not.toHaveAttribute('tabindex', '0')
    await expect(unsafe.locator('[data-row-primary]')).toHaveCount(0)
  }
  await expect(page.locator('.ad-notification-row img')).toHaveCount(0)
  expect(await page.evaluate(() => window.noticeInjected)).toBeUndefined()
  await expect(page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true })).toBeDisabled()
})

test('Thông báo admin: lỗi tải, thử lại, đánh dấu tất cả và email bị lỗi hoàn tác', async ({ page }) => {
  const state = await fixtures(page)
  state.failList = true
  await page.goto('/thong-bao')
  await expect(page.getByRole('alert')).toContainText('Máy chủ')
  await expect(page.locator('.ad-notification-row')).toHaveCount(0)
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).evaluate(button => { button.click(); button.click() })
  await expect.poll(() => state.readPosts).toEqual(['/api/v1/notifications/read-all/'])
  await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Không có thông báo chưa đọc', exact: true })).toBeVisible()
  await page.getByText('Email thông báo', { exact: true }).click()
  const checkbox = page.getByRole('checkbox', { name: 'Nhận thông báo qua email', exact: true })
  state.failPreference = true
  await checkbox.uncheck()
  await expect(page.getByRole('alert')).toContainText('Máy chủ')
  await expect(checkbox).toBeChecked()
  state.failPreference = false
  await checkbox.uncheck()
  await expect(checkbox).not.toBeChecked()
  await expect(page.getByText('Đã tắt email thông báo.', { exact: true })).toBeVisible()
  expect(state.preferencePosts).toEqual([{ email_enabled: false }, { email_enabled: false }])
})

test('Hồ sơ admin: thông tin đăng nhập chỉ đọc, hoàn tác và làm mới giữ bản đang sửa', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto('/ho-so')
  await expect(page.locator('.ad-profile-page')).toBeVisible()
  await expect(page.getByText('Username đăng nhập:', { exact: false })).toContainText(original.username)
  await expect(page.locator('input[name=username], input[name=email], .organization-fields, .profile-skills')).toHaveCount(0)
  const name = page.getByLabel('Họ và tên', { exact: true })
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeDisabled()
  await name.fill('Tên đang sửa')
  state.profile.full_name = 'Tên trên máy chủ'
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(name).toHaveValue('Tên đang sửa')
  await expect(page.locator('.profile-save-status')).toHaveText('Có thay đổi chưa lưu')
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click()
  await expect(name).toHaveValue(original.full_name)
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(name).toHaveValue('Tên trên máy chủ')
  await name.fill('Bản nháp cần giữ')
  page.once('dialog', dialog => dialog.dismiss())
  await page.locator('.om-breadcrumb a').click()
  await expect(page).toHaveURL(/\/ho-so$/)
  await expect(name).toHaveValue('Bản nháp cần giữ')
  await capture(page, info, 'admin-profile')
})

test('Hồ sơ admin: lỗi giữ bản sửa, gửi đúng trường và chặn lưu trùng', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto('/ho-so')
  await page.getByLabel('Họ và tên', { exact: true }).fill('Quản trị viên mới')
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678')
  await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Quản lý cộng đồng.')
  state.failProfile = true
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Họ tên chưa hợp lệ.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Quản trị viên mới')
  state.failProfile = false
  let release
  state.profileGate = new Promise(resolve => { release = resolve })
  await page.locator('form.profile-form').evaluate(form => { form.requestSubmit(); form.requestSubmit() })
  await expect(page.getByRole('button', { name: 'Đang lưu…', exact: true })).toBeDisabled()
  await expect.poll(() => state.profilePosts.length).toBe(2)
  release()
  await expect(page.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
  expect(state.profilePosts.at(-1)).toEqual({ full_name: 'Quản trị viên mới', phone: '0912345678', bio: 'Quản lý cộng đồng.' })
  await expect(page.locator('.profile-save-status')).toHaveText('Không có thay đổi chưa lưu')
  await page.reload()
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Quản trị viên mới')
})

test('Hồ sơ admin: ảnh lưu riêng với thông tin hồ sơ và có thể xóa', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto('/ho-so')
  await page.getByLabel('Họ và tên', { exact: true }).fill('Tên chưa lưu')
  await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByText('Đã cập nhật ảnh đại diện.', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Ảnh đại diện của bạn', exact: true })).toBeVisible()
  expect(state.profilePosts).toHaveLength(0)
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Tên chưa lưu')
  await page.getByRole('button', { name: 'Xóa ảnh', exact: true }).click()
  await expect(page.getByText('Đã xóa ảnh đại diện.', { exact: true })).toBeVisible()
  expect(state.avatarPosts).toBe(2)
  await expect(page.locator('.profile-save-status')).toHaveText('Có thay đổi chưa lưu')
})
