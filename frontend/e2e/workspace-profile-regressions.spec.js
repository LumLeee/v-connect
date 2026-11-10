import { test, expect } from '@playwright/test'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT0QAAAAASUVORK5CYII=', 'base64')

async function fixture(page, role, avatarUrl = null) {
  const state = { logoutCalls: 0, signedIn: true, failedLayoutImages: 0, profile: {
    id: `workspace-profile-${role}`, username: 'admin-profile', full_name: 'Người dùng hồ sơ',
    email: 'profile@example.invalid', role, phone: '', bio: '', avatar_url: avatarUrl,
    organizer: { organization_name: '', description: '', website: '', contact_address: '' },
    volunteer: { skills: [], interests: [], availability: [], matching_visible: false },
  } }
  page.on('pageerror', error => { throw error })
  await page.route('**/workspace-broken-avatar.png*', route => {
    if (!new URL(route.request().url()).search) state.failedLayoutImages++
    return route.fulfill({ status: 404, body: '' })
  })
  await page.route('**/workspace-new-avatar.png*', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) {
      if (!state.signedIn) return route.fulfill({ status: 401, json: {} })
      data = { user: state.profile }
    } else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'workspace-profile-csrf' }
    else if (url.pathname.endsWith('/auth/logout/')) {
      state.logoutCalls++; state.signedIn = false; data = {}
    } else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/auth/profile/avatar/')) {
      state.profile.avatar_url = '/workspace-new-avatar.png'
      data = { avatar_url: state.profile.avatar_url }
    } else if (url.pathname.endsWith('/auth/profile/')) {
      if (request.method() === 'PATCH') Object.assign(state.profile, request.postDataJSON())
      data = { profile: state.profile }
    } else if (url.pathname.endsWith('/skills/')) data = { count: 0, results: [], next: null, previous: null }
    else throw new Error(`Unexpected workspace profile request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function openMenu(page) {
  const toggle = page.getByRole('button', { name: 'Mở menu', exact: true })
  if (await toggle.isVisible()) await toggle.click()
}

for (const role of ['volunteer', 'organizer', 'admin']) {
  test(`${role}: ảnh ở menu và thanh trên phục hồi sau ảnh cũ bị lỗi, không cần tải lại trang`, async ({ page }) => {
    const state = await fixture(page, role, '/workspace-broken-avatar.png')
    await page.goto('/ho-so')
    await expect(page.getByLabel('Họ và tên', { exact: true })).toBeVisible()
    await expect.poll(() => state.failedLayoutImages).toBeGreaterThan(0)
    await expect(page.locator('.od-avatar img')).toHaveCount(0)
    await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByText('Đã cập nhật ảnh đại diện.', { exact: true })).toBeVisible()
    const avatars = page.locator('.od-avatar img')
    await expect(avatars).toHaveCount(2)
    for (const avatar of await avatars.all()) {
      await expect(avatar).toHaveAttribute('src', '/workspace-new-avatar.png')
      await expect.poll(() => avatar.evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
    }
    await expect(page).toHaveURL(/\/ho-so$/)
  })
}

test('Admin: hủy đăng xuất giữ bản nháp, xác nhận mới gửi yêu cầu đăng xuất', async ({ page }) => {
  const state = await fixture(page, 'admin')
  await page.goto('/ho-so')
  const name = page.getByLabel('Họ và tên', { exact: true })
  await name.fill('Bản nháp cần giữ')
  await openMenu(page)
  const cancel = page.waitForEvent('dialog')
  const firstClick = page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  const firstDialog = await cancel
  expect(firstDialog.message()).toContain('thay đổi chưa lưu')
  await firstDialog.dismiss()
  await firstClick
  expect(state.logoutCalls).toBe(0)
  await expect(page).toHaveURL(/\/ho-so$/)
  await expect(name).toHaveValue('Bản nháp cần giữ')
  const confirm = page.waitForEvent('dialog')
  const secondClick = page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await (await confirm).accept()
  await secondClick
  await expect(page).toHaveURL(/\/dang-nhap$/)
  expect(state.logoutCalls).toBe(1)
})

test('Admin: hồ sơ đã lưu đăng xuất trực tiếp, không hỏi bỏ thay đổi', async ({ page }) => {
  const state = await fixture(page, 'admin')
  await page.goto('/ho-so')
  await page.getByLabel('Họ và tên', { exact: true }).fill('Hồ sơ đã lưu')
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.locator('.profile-save-status')).toHaveText('Không có thay đổi chưa lưu')
  await openMenu(page)
  let dialogs = 0
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss() })
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/dang-nhap$/)
  expect(dialogs).toBe(0)
  expect(state.logoutCalls).toBe(1)
})
