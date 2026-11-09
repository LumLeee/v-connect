import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const owner = { id: 'profile-ui-owner', full_name: 'Nhà tổ chức', email: 'profile@example.invalid', role: 'organizer' }
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT0QAAAAASUVORK5CYII='
const avatarUrl = '/profile-ui-avatar.png'
const profile = { ...owner, phone: '', bio: '', avatar_url: null, organizer: { organization_name: 'Cộng đồng', description: '', website: '', contact_address: '' } }

async function mockProfile(page) {
  const state = { profile: structuredClone(profile), failSave: false, avatarWrites: 0 }
  page.on('pageerror', error => { throw error })
  await page.route('**/profile-ui-avatar.png*', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: owner }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'profile-ui-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/auth/profile/avatar/')) {
      state.avatarWrites += 1
      state.profile.avatar_url = request.method() === 'DELETE' ? null : avatarUrl
      data = { avatar_url: state.profile.avatar_url }
    } else if (url.pathname.endsWith('/auth/profile/')) {
      if (request.method() === 'PATCH') {
        if (state.failSave) return route.fulfill({ status: 400, json: { error: { details: { full_name: ['Họ tên chưa hợp lệ.'] } } } })
        state.profile = { ...state.profile, ...request.postDataJSON() }
      }
      data = { profile: state.profile }
    } else if (url.pathname.endsWith('/applicants/candidate/')) data = { profile: {
      id: 'candidate', role: 'volunteer', full_name: 'Ứng viên', email: 'candidate@example.invalid', phone: '', bio: '', avatar_url: avatarUrl,
      volunteer: { skills: ['chosen'], interests: [], availability: [], matching_visible: true },
    } }
    else if (url.pathname.endsWith('/skills/')) data = { count: 2, results: [{ id: 'chosen', name: 'Giảng dạy' }, { id: 'other', name: 'Giao tiếp' }], next: null, previous: null }
    else throw new Error(`Unexpected profile request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Hồ sơ nhà tổ chức gọn, theo dõi thay đổi riêng với ảnh và chỉ đặt lại sau khi lưu thành công', async ({ page }, info) => {
  const state = await mockProfile(page)
  await page.goto('/ho-so')
  const status = page.locator('.profile-save-status')
  const group = page.getByRole('group', { name: 'Tải ảnh đại diện', exact: true })
  const name = page.getByLabel('Họ và tên', { exact: true })
  await expect(group).toBeVisible()
  await expect(page.getByRole('group', { name: 'Tải ảnh bìa', exact: true })).toHaveCount(0)
  await expect(page.locator('.profile-page .eyebrow')).toHaveCount(0)
  await expect(status).toHaveText('Không có thay đổi chưa lưu')
  await name.fill('Tên tạm')
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  await name.fill(owner.full_name)
  await expect(status).toHaveText('Không có thay đổi chưa lưu')
  await page.getByLabel('Tên tổ chức', { exact: true }).fill('Tổ chức đã thay đổi')
  await page.locator('#avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByText('Đã cập nhật ảnh đại diện.', { exact: true })).toBeVisible()
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  await group.getByRole('button', { name: 'Xóa ảnh', exact: true }).click()
  await expect(page.getByText('Đã xóa ảnh đại diện.', { exact: true })).toBeVisible()
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  await group.focus()
  const pastedFiles = await group.evaluate((element, base64) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([Uint8Array.from(atob(base64), character => character.charCodeAt(0))], 'pasted.png', { type: 'image/png' }))
    const event = new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })
    element.dispatchEvent(event)
    return event.clipboardData.files.length
  }, png)
  expect(pastedFiles).toBe(1)
  await expect.poll(() => state.avatarWrites).toBe(3)
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  state.failSave = true
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Họ tên chưa hợp lệ.', { exact: true })).toBeVisible()
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  state.failSave = false
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
  await expect(status).toHaveText('Không có thay đổi chưa lưu')
  await page.getByLabel('Tên tổ chức', { exact: true }).fill('Sửa lần nữa')
  await expect(status).toHaveText('Có thay đổi chưa lưu')
  await page.getByLabel('Tên tổ chức', { exact: true }).fill('Tổ chức đã thay đổi')
  await expect(status).toHaveText('Không có thay đổi chưa lưu')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/remaining-organizer-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-profile.png`), fullPage: true })
})

test('Hồ sơ ứng viên giữ avatar, chỉ hiện trường có dữ liệu và kỹ năng đã chọn', async ({ page }) => {
  await mockProfile(page)
  await page.goto('/ho-so?hoat-dong=activity&ung-vien=candidate')
  await expect(page.getByRole('heading', { name: 'Hồ sơ ứng viên', exact: true })).toBeVisible()
  await expect(page.locator('.profile-summary img.profile-avatar')).toBeVisible()
  await expect(page.getByLabel('Họ và tên', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Số điện thoại', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveCount(0)
  await expect(page.locator('.profile-skill-options')).toContainText('Giảng dạy')
  await expect(page.locator('.profile-skill-options')).not.toContainText('Giao tiếp')
  await expect(page.locator('.profile-save-status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Tải ảnh đại diện', exact: true })).toHaveCount(0)
})
