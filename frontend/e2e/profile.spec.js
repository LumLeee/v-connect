import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAO0lEQVR4nO3RQREAMAjEwKOG6qdC0F8J4cMvK+CYCXX7ZdNZXY8HBvwBMhEyETIRMhEyETIRMhEyUcgHopoBP7W97BsAAAAASUVORK5CYII=', 'base64')

test('Đổi tài khoản ở phiên khác không giữ hồ sơ và bản nháp của người cũ', async ({ page }) => {
  async function createAccount(name) {
    const tokenResponse = await page.request.get('/api/v1/auth/csrf/')
    const { csrfToken } = await tokenResponse.json()
    const result = await page.request.post('/api/v1/auth/register/', {
      headers: { 'X-CSRFToken': csrfToken },
      data: { full_name: name, email: `switch.${randomUUID()}@example.invalid`, role: 'volunteer',
        password: 'River-Community-493!', password_confirm: 'River-Community-493!' },
    })
    expect(result.status()).toBe(201)
  }
  await createAccount('Người dùng thứ nhất')
  await page.goto('/ho-so')
  await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Bản nháp riêng tư của người trước')
  await createAccount('Người dùng thứ hai')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Người dùng thứ hai')
  await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('')
})

for (const role of ['volunteer', 'organizer']) {
  test(`${role}: chỉnh sửa hồ sơ, giữ bản nháp khi focus, avatar và tải lại`, async ({ page }, info) => {
    page.on('pageerror', error => { throw error })
    await page.goto('/dang-ky')
    await page.getByLabel('Họ và tên', { exact: true }).fill('Nguyễn An Hồ Sơ')
    await page.getByRole('radio', { name: role === 'organizer' ? 'Nhà tổ chức' : 'Tình nguyện viên', exact: true }).check()
    await page.getByLabel('Email', { exact: true }).fill(`profile.${randomUUID()}@example.invalid`)
    await page.getByLabel('Mật khẩu', { exact: true }).fill('River-Community-493!')
    await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('River-Community-493!')
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
    await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ' }).click()
    await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi' })).toBeVisible()
    await page.getByLabel('Họ và tên', { exact: true }).fill('Nguyễn An Cập Nhật')
    await page.getByLabel('Số điện thoại', { exact: true }).fill('abc')
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
    await expect(page.getByText('Nhập số điện thoại có từ 7 đến 15 chữ số.')).toBeVisible()
    await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678')
    await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Sẵn sàng đóng góp cho cộng đồng 🌱')
    const refreshed = page.waitForResponse(response => response.url().includes('/auth/me/') && response.status() === 200)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await refreshed
    await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('Sẵn sàng đóng góp cho cộng đồng 🌱')
    if (role === 'organizer') {
      await page.getByLabel('Tên tổ chức', { exact: true }).fill('Nhóm Tình Nguyện Xanh')
      await page.getByLabel('Mô tả tổ chức', { exact: true }).fill('Cùng chăm sóc không gian sống xanh.')
      await page.getByLabel('Website', { exact: true }).fill('https://example.org')
      await page.getByLabel('Địa chỉ liên hệ', { exact: true }).fill('Đà Nẵng')
    } else {
      await expect(page.getByLabel('Tên tổ chức', { exact: true })).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
    await expect(page.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Nguyễn An Cập Nhật')
    await expect(page.getByLabel('Số điện thoại', { exact: true })).toHaveValue('0912345678')
    if (role === 'organizer') await expect(page.getByLabel('Tên tổ chức', { exact: true })).toHaveValue('Nhóm Tình Nguyện Xanh')

    await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByText('Đã cập nhật ảnh đại diện.', { exact: true })).toBeVisible()
    const avatar = page.getByRole('img', { name: 'Ảnh đại diện của bạn' })
    await expect(avatar).toBeVisible()
    await expect.poll(() => avatar.evaluate(element => element.naturalWidth)).toBeGreaterThan(0)
    await page.reload()
    await expect(page.getByRole('img', { name: 'Ảnh đại diện của bạn' })).toBeVisible()
    await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles({ name: 'fake.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') })
    await expect(page.getByText('File ảnh không hợp lệ hoặc bị hỏng.', { exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Ảnh đại diện của bạn' })).toBeVisible()
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${role}-profile.png`), fullPage: true })
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    }
    await page.getByRole('button', { name: 'Xóa ảnh đại diện', exact: true }).click()
    await expect(page.getByText('Đã xóa ảnh đại diện.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Ảnh đại diện của bạn' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Về tài khoản', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Xin chào, Nguyễn An Cập Nhật.' })).toBeVisible()
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await expect(page).toHaveURL(/\/dang-nhap$/)
    expect((await page.request.get('/api/v1/auth/me/')).status()).toBe(401)
    await page.goto('/ho-so')
    await expect(page).toHaveURL(/\/dang-nhap$/)
  })
}
