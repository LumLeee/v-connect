import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const owner = { id: 'volunteer-profile-ui', full_name: 'Tình nguyện viên', email: 'profile@example.invalid', role: 'volunteer' }
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT0QAAAAASUVORK5CYII='
async function fixture(page, role = 'volunteer') {
  const state = { role, failGet: false, failSave: false, writes: [], avatarWrites: 0, logoutCalls: 0, profile: {
    ...owner, phone: '', bio: '', avatar_url: null,
    volunteer: { skills: ['chosen'], interests: ['Cộng đồng'], availability: [], matching_visible: false },
  } }
  page.on('pageerror', error => { throw error })
  await page.route('**/profile-volunteer.png*', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { ...owner, role: state.role } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'profile-csrf' }
    else if (url.pathname.endsWith('/auth/logout/')) { state.logoutCalls++; data = {} }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/auth/profile/avatar/')) {
      state.avatarWrites++
      state.profile.avatar_url = request.method() === 'DELETE' ? null : '/profile-volunteer.png'
      data = { avatar_url: state.profile.avatar_url }
    } else if (url.pathname.endsWith('/auth/profile/')) {
      if (request.method() === 'PATCH') {
        state.writes.push(request.postDataJSON())
        if (state.failSave) return route.fulfill({ status: 400, json: { error: { message: 'Chưa lưu được hồ sơ.', details: { phone: ['Số điện thoại chưa hợp lệ.'] } } } })
        state.profile = { ...state.profile, ...request.postDataJSON() }
      } else if (state.failGet) return route.abort()
      data = { profile: state.profile }
    } else if (url.pathname.endsWith('/applicants/candidate/')) data = { profile: { ...state.profile, id: 'candidate', avatar_url: '/profile-volunteer.png' } }
    else if (url.pathname.endsWith('/skills/')) data = { count: 2, next: null, previous: null, results: [{ id: 'chosen', name: 'Giảng dạy' }, { id: 'other', name: 'Giao tiếp' }] }
    else if (url.pathname.endsWith('/reports/volunteer-dashboard/')) data = null
    else throw new Error(`Unexpected volunteer profile request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Hồ sơ tình nguyện: theo dõi cả kỹ năng, sở thích và lịch rảnh, lưu lỗi giữ nháp và hoàn tác đúng', async ({ page }, info) => {
  const state = await fixture(page)
  await page.goto('/ho-so')
  const save = page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })
  const status = page.locator('.profile-save-status')
  await expect(save).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Tải ảnh đại diện', exact: true })).toBeVisible()
  await page.getByLabel('Giao tiếp', { exact: true }).check()
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click()
  await expect(page.getByLabel('Giao tiếp', { exact: true })).not.toBeChecked()
  await expect(save).toBeDisabled()
  await page.getByLabel('Sở thích', { exact: true }).fill('Giáo dục\nMôi trường')
  await page.getByRole('button', { name: 'Thêm khung giờ', exact: true }).click()
  state.failSave = true
  await save.click()
  await expect(page.getByText('Số điện thoại chưa hợp lệ.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Sở thích', { exact: true })).toHaveValue('Giáo dục\nMôi trường')
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  state.failGet = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.profile-form > [role=alert]')).toContainText('Không kết nối được máy chủ')
  await expect(page.getByLabel('Giờ bắt đầu 1', { exact: true })).toHaveValue('08:00')
  state.failGet = false
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByText('Đã làm mới. Các thay đổi chưa lưu của bạn vẫn được giữ lại.', { exact: true })).toBeVisible()
  state.failSave = false
  await save.click()
  await expect(status).toHaveText('Không có thay đổi chưa lưu')
  await expect(save).toBeDisabled()
  expect(state.writes.at(-1).volunteer.interests).toEqual(['Giáo dục', 'Môi trường'])
  expect(state.writes.at(-1).volunteer.availability).toHaveLength(1)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage4-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-volunteer-profile.png`), fullPage: true })
})

test('Hồ sơ tình nguyện: cảnh báo rời trang hoặc đăng xuất và không hỏi lại sau khi lưu', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/ho-so')
  await page.getByLabel('Họ và tên', { exact: true }).fill('Bản nháp')
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('link', { name: 'Về tài khoản', exact: true }).click()
  await expect(page).toHaveURL(/\/ho-so$/)
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Bản nháp')
  const openMenu = page.getByRole('button', { name: 'Mở menu', exact: true })
  if (await openMenu.isVisible()) await openMenu.click()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  expect(state.logoutCalls).toBe(0)
  const menuDialog = page.getByRole('dialog', { name: 'Không gian Tình nguyện viên', exact: true })
  if (await menuDialog.isVisible()) await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.locator('.profile-save-status')).toHaveText('Không có thay đổi chưa lưu')
  let dialogs = 0
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss() })
  await page.getByRole('link', { name: 'Về tài khoản', exact: true }).click()
  await expect(page).toHaveURL(/\/tinh-nguyen-vien$/)
  expect(dialogs).toBe(0)
})

test('Hồ sơ tình nguyện: avatar chọn/dán lưu riêng và hồ sơ ứng viên chỉ đọc không đổi', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/ho-so')
  await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Bản nháp riêng')
  await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByText('Đã cập nhật ảnh đại diện.', { exact: true })).toBeVisible()
  const group = page.getByRole('group', { name: 'Tải ảnh đại diện', exact: true })
  await group.evaluate((element, base64) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([Uint8Array.from(atob(base64), character => character.charCodeAt(0))], 'paste.png', { type: 'image/png' }))
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
  }, png)
  await expect.poll(() => state.avatarWrites).toBe(2)
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Ảnh đại diện của bạn', exact: true })).toBeVisible()
  await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('')
  state.role = 'organizer'
  await page.goto('/ho-so?hoat-dong=activity&ung-vien=candidate')
  await expect(page.getByRole('heading', { name: 'Hồ sơ ứng viên', exact: true })).toBeVisible()
  await expect(page.getByLabel('Họ và tên', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Số điện thoại', { exact: true })).toHaveCount(0)
  await expect(page.locator('.profile-skill-options')).toContainText('Giảng dạy')
  await expect(page.locator('.profile-skill-options')).not.toContainText('Giao tiếp')
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toHaveCount(0)
  await expect(page.locator('.profile-save-status')).toHaveCount(0)
})
