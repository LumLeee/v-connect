import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const password = 'River-Community-493!'
const newPassword = 'Garden-Community-843!'
const routes = { volunteer: '/tinh-nguyen-vien', organizer: '/nha-to-chuc', admin: '/quan-tri' }
const labels = { volunteer: 'Tình nguyện viên', organizer: 'Nhà tổ chức', admin: 'Quản trị viên' }
const account = () => ({ email: `ui.${randomUUID()}@example.invalid`, name: 'Nguyễn An Kiểm Thử' })

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
})

async function evidence(page, info, name) {
  const directory = process.env.E2E_ARTIFACT_DIR
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: path.join(directory, `${info.project.name}-${name}.png`), fullPage: true })
}

async function noOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
  }))
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport + 1)
  for (const field of await page.locator('form input:not([type=radio]):not([type=checkbox]), .auth-submit').all()) {
    const box = await field.boundingBox()
    expect(box).not.toBeNull()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(metrics.viewport + 1)
  }
}

async function register(page, user, role = 'volunteer') {
  await page.goto('/dang-ky')
  await page.getByLabel('Họ và tên', { exact: true }).fill(user.name)
  await page.getByRole('radio', { name: labels[role], exact: true }).check()
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${routes[role]}$`))
  await expect(page.getByRole('heading', { name: `Xin chào, ${user.name}.` })).toBeVisible()
}

async function login(page, email, value = password, remember = false) {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email hoặc username Admin', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(value)
  if (remember) await page.getByLabel('Ghi nhớ 14 ngày').check()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
}

async function logout(page) {
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/dang-nhap$/)
}

for (const role of ['volunteer', 'organizer']) {
  test(`${role}: đăng ký, tải lại, chặn sai vai trò, đăng xuất và ghi nhớ`, async ({ page, context }, info) => {
    const user = account()
    await register(page, user, role)
    await expect(page.getByText(user.email, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: `Xin chào, ${user.name}.` })).toBeVisible()
    await page.goto('/quan-tri')
    await expect(page).toHaveURL(new RegExp(`${routes[role]}$`))
    expect((await page.request.get('/api/v1/auth/workspace/admin/')).status()).toBe(403)
    await evidence(page, info, `${role}-workspace`)
    await noOverflow(page)
    await logout(page)
    await page.goto(routes[role])
    await expect(page).toHaveURL(/\/dang-nhap$/)
    await login(page, user.email.toUpperCase(), password, true)
    await expect(page).toHaveURL(new RegExp(`${routes[role]}$`))
    const session = (await context.cookies()).find(cookie => cookie.name === 'sessionid')
    expect(session.httpOnly).toBe(true)
    expect(session.expires).toBeGreaterThan(Date.now() / 1000 + 13 * 86400)
    await logout(page)
  })
}

test('Admin: đăng nhập, giữ phiên và điều hướng đúng vai trò', async ({ page }, info) => {
  await login(page, process.env.E2E_ADMIN_USERNAME, process.env.E2E_ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/quan-tri$/)
  await expect(page.getByRole('heading', { name: 'Xin chào, Quản trị kiểm thử.' })).toBeVisible()
  await page.goto('/nha-to-chuc')
  await expect(page).toHaveURL(/\/quan-tri$/)
  expect((await page.request.get('/api/v1/auth/workspace/organizer/')).status()).toBe(403)
  await page.reload()
  await expect(page.getByText(process.env.E2E_ADMIN_USERNAME, { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ' }).click()
  await expect(page.getByText('Username đăng nhập:', { exact: false })).toContainText(process.env.E2E_ADMIN_USERNAME)
  const profile = await (await page.request.get('/api/v1/auth/profile/')).json()
  expect(profile.profile.email).toBeNull()
  await page.getByRole('link', { name: 'Về tài khoản', exact: true }).click()
  await evidence(page, info, 'admin-workspace')
  await noOverflow(page)
  await logout(page)
  await page.goto(`${process.env.E2E_BACKEND_URL}/admin/login/`)
  await page.locator('input[name="username"]').fill(process.env.E2E_ADMIN_USERNAME)
  await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD)
  await page.locator('input[type="submit"]').click()
  await expect(page).toHaveURL(`${process.env.E2E_BACKEND_URL}/admin/`)
  await expect(page.locator('#user-tools')).toContainText(process.env.E2E_ADMIN_USERNAME)
})

test('Đặt lại mật khẩu qua email thật cục bộ, hủy phiên cũ và chặn dùng lại liên kết', async ({ page, browser }, info) => {
  const user = account()
  await register(page, user)
  const guest = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    const resetPage = await guest.newPage()
    await resetPage.goto('/quen-mat-khau')
    await resetPage.getByLabel('Email', { exact: true }).fill(user.email)
    await resetPage.getByRole('button', { name: 'Gửi hướng dẫn', exact: true }).click()
    await expect(resetPage.getByRole('status')).toContainText('Nếu email thuộc tài khoản đang hoạt động')
    await evidence(resetPage, info, 'forgot-success')
    let resetUrl
    await expect.poll(async () => {
      for (const file of await readdir(process.env.E2E_MAIL_DIR)) {
        const content = await readFile(path.join(process.env.E2E_MAIL_DIR, file), 'utf8')
        if (!content.includes(`To: ${user.email}`)) continue
        resetUrl = content.match(/http:\/\/127\.0\.0\.1:5174\/dat-lai-mat-khau\/[^\s]+/)?.[0]
        if (resetUrl) return true
      }
      return false
    }).toBe(true)
    expect(new URL(resetUrl).origin).toBe(process.env.E2E_BASE_URL)
    await resetPage.goto(resetUrl)
    await resetPage.getByLabel('Mật khẩu', { exact: true }).fill(newPassword)
    await resetPage.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('Wrong-confirmation!')
    await resetPage.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(resetPage.getByText('Mật khẩu xác nhận không khớp.', { exact: true })).toBeVisible()
    await evidence(resetPage, info, 'reset-validation')
    await noOverflow(resetPage)
    await resetPage.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(newPassword)
    await resetPage.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(resetPage.getByRole('status')).toContainText('Đã đặt lại mật khẩu')
    await evidence(resetPage, info, 'reset-success')
    await page.reload()
    await expect(page).toHaveURL(/\/dang-nhap$/)
    await login(page, user.email, password)
    await expect(page.getByRole('alert')).toContainText('Thông tin đăng nhập không đúng')
    await login(page, user.email, newPassword)
    await expect(page).toHaveURL(/\/tinh-nguyen-vien$/)
    await resetPage.goto(resetUrl)
    await resetPage.getByLabel('Mật khẩu', { exact: true }).fill(newPassword)
    await resetPage.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(newPassword)
    await resetPage.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(resetPage.getByRole('alert')).toContainText('Liên kết không hợp lệ hoặc đã hết hạn')
    await resetPage.getByRole('link', { name: 'Yêu cầu liên kết mới' }).click()
    await expect(resetPage).toHaveURL(/\/quen-mat-khau$/)
    await logout(page)
  } finally {
    await guest.close()
  }
})

test('Lỗi đăng ký, hiện/ẩn mật khẩu và email trùng', async ({ page }, info) => {
  const user = account()
  await register(page, user)
  await logout(page)
  await page.goto('/dang-ky')
  await page.getByLabel('Họ và tên', { exact: true }).fill(user.name)
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).click()
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click()
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page.getByText('Email này đã được đăng ký.', { exact: true })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(account().email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('123')
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page.locator('#password-error')).toBeVisible()
  await evidence(page, info, 'register-validation')
  await noOverflow(page)
})

test('Các form hiển thị đầy đủ ở các chiều rộng 320–1280px', async ({ page }, info) => {
  for (const width of [320, 390, 640, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/dang-ky', '/dang-nhap', '/quen-mat-khau', '/dat-lai-mat-khau/invalid/invalid']) {
      await page.goto(route)
      await expect(page.locator('.auth-card h2')).toBeVisible()
      await expect(page.locator('.auth-intro h1')).toHaveText('Điều tốt đẹp bắt đầu từ bạn.')
      await expect(page.locator('.auth-submit')).toBeVisible()
      await noOverflow(page)
      if (info.project.name === 'desktop' && [320, 390, 768, 1280].includes(width)) {
        await evidence(page, info, `layout-${width}-${route.split('/')[1]}`)
      }
    }
  }
})
