import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}

async function adminLogin(request) {
  expect((await post(request, '/api/v1/auth/login/', {
    identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD,
  })).status()).toBe(200)
}

async function filterAccounts(page, { search = '', role = '', status = '' }) {
  const form = page.getByRole('form', { name: 'Bộ lọc tài khoản' })
  await form.getByLabel('Tìm tài khoản', { exact: true }).fill(search)
  await form.getByLabel('Vai trò', { exact: true }).selectOption(role)
  await form.getByLabel('Trạng thái', { exact: true }).selectOption(status)
  await form.getByRole('button', { name: 'Áp dụng', exact: true }).click()
}

async function accountRow(page, email) {
  const row = page.locator('.ad-account-row').filter({ hasText: email })
  await expect(row).toHaveCount(1)
  await expect(row).toBeVisible()
  return row
}

async function openMenu(page) {
  const sidebar = page.locator('.od-sidebar')
  if (!await sidebar.isVisible()) await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
  await expect(sidebar).toBeVisible()
  return sidebar
}

async function evidence(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${name}: ${width}px`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-admin-stage1-${name}.png`), fullPage: true })
}

test('Admin đợt 1: số liệu thật, lọc tài khoản, bàn phím và khóa/mở khóa có nhật ký', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const settings = { baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport }
  const volunteer = await browser.newContext(settings)
  const organizer = await browser.newContext(settings)
  const unique = randomUUID()
  const email = `admin-stage1.${unique}@example.invalid`
  const organizerEmail = `admin-stage1.org.${unique}@example.invalid`
  const fullName = `Tình nguyện viên đợt 1 ${unique.slice(0, 8)}`
  const organizerName = `Nhà tổ chức đợt 1 ${unique.slice(0, 8)}`
  const password = 'River-Community-493!'
  try {
    const registered = await post(volunteer.request, '/api/v1/auth/register/', {
      email, full_name: fullName, role: 'volunteer', password, password_confirm: password,
    })
    expect(registered.status()).toBe(201)
    const { user } = await registered.json()
    expect((await post(organizer.request, '/api/v1/auth/register/', {
      email: organizerEmail, full_name: organizerName, role: 'organizer', password, password_confirm: password,
    })).status()).toBe(201)
    await adminLogin(page.request)
    await page.goto('/quan-tri')
    await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible()
    const overview = await (await page.request.get('/api/v1/reports/overview/')).json()
    const total = page.locator('.om-stat').filter({ hasText: 'Tổng tài khoản' })
    await expect(total.locator('strong')).toHaveText(String(overview.accounts.total))
    await expect(page.getByText('Tài khoản quản trị:', { exact: false })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Chỉnh sửa hồ sơ', exact: true })).toHaveCount(0)
    await total.click()
    await expect(page).toHaveURL(/\/quan-tri\/tai-khoan\/?$/)
    await expect(page.getByRole('heading', { name: 'Tài khoản hệ thống', exact: true })).toBeVisible()
    await filterAccounts(page, { search: email, role: 'volunteer' })
    let row = await accountRow(page, email)
    await expect(row).toContainText(fullName)
    await expect(row).toContainText('Tình nguyện viên')
    const selected = await (await page.request.get(`/api/v1/admin/accounts/?search=${encodeURIComponent(email)}&role=volunteer`)).json()
    expect(selected.count).toBe(1)
    await expect(row.locator('time')).toHaveAttribute('datetime', selected.results[0].date_joined)
    await row.focus()
    await page.keyboard.press('Enter')
    const details = page.getByRole('dialog')
    await expect(details).toBeVisible()
    await expect(details).toContainText(email)
    await expect(details).toContainText(fullName)
    await page.keyboard.press('Escape')
    await expect(details).toHaveCount(0)
    await expect(row).toBeFocused()

    await row.getByRole('button', { name: 'Khóa', exact: true }).click()
    const lock = page.getByRole('dialog', { name: 'Khóa tài khoản', exact: true })
    await expect(lock).toContainText(email)
    const confirm = lock.getByRole('button', { name: 'Xác nhận khóa', exact: true })
    await expect(confirm).toBeDisabled()
    await lock.getByLabel('Lý do khóa tài khoản', { exact: true }).fill('   ')
    await expect(confirm).toBeDisabled()
    const reason = `Kiểm tra khóa đợt 1 ${info.project.name} ${unique}`
    await lock.getByLabel('Lý do khóa tài khoản', { exact: true }).fill(reason)
    await confirm.click()
    row = await accountRow(page, email)
    await expect(row).toContainText('Bị khóa')
    expect((await volunteer.request.get('/api/v1/auth/me/')).status()).toBe(401)
    expect((await post(volunteer.request, '/api/v1/auth/login/', { identifier: email, password })).status()).toBe(401)
    await evidence(page, info, 'locked-account')

    await filterAccounts(page, { search: email, role: 'volunteer', status: 'locked' })
    row = await accountRow(page, email)
    await row.getByRole('button', { name: 'Mở khóa', exact: true }).click()
    const unlock = page.getByRole('dialog', { name: 'Mở khóa tài khoản', exact: true })
    await unlock.getByLabel('Lý do mở khóa tài khoản', { exact: true }).fill('Đã kiểm tra và xử lý')
    await unlock.getByRole('button', { name: 'Xác nhận mở khóa', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Không có tài khoản phù hợp', exact: true })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('search')).toBe(email)
    expect(new URL(page.url()).searchParams.get('role')).toBe('volunteer')
    expect(new URL(page.url()).searchParams.get('status')).toBe('locked')
    await filterAccounts(page, { search: email, role: 'volunteer', status: 'active' })
    await expect(await accountRow(page, email)).toContainText('Hoạt động')
    expect((await post(volunteer.request, '/api/v1/auth/login/', { identifier: email, password })).status()).toBe(200)
    expect((await volunteer.request.get('/api/v1/auth/me/')).status()).toBe(200)
    expect((await volunteer.request.get('/api/v1/admin/accounts/')).status()).toBe(403)

    const audit = await (await page.request.get(`/api/v1/admin/audit/?subject=${user.id}&action=account_locked`)).json()
    expect(audit.count).toBe(1)
    expect(audit.results[0].reason).toBe(reason)
    await page.getByRole('main').getByRole('link', { name: 'Lịch sử thao tác', exact: true }).click()
    await page.getByLabel('Tài khoản liên quan', { exact: true }).fill(fullName)
    await page.getByLabel('Loại thao tác', { exact: true }).selectOption('account_locked')
    const auditRow = page.locator('.ad-audit-row').filter({ hasText: fullName })
    await expect(auditRow).toHaveCount(1)
    await auditRow.click()
    await expect(page.getByRole('heading', { name: 'Chi tiết thao tác', exact: true })).toBeVisible()
    await expect(page.getByText(reason, { exact: true })).toBeVisible()

    await page.goto('/quan-tri/tai-khoan')
    await filterAccounts(page, { search: organizerEmail, role: 'organizer', status: 'active' })
    await expect(await accountRow(page, organizerEmail)).toContainText(organizerName)
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
    await expect(page.getByLabel('Tìm tài khoản', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Vai trò', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Trạng thái', { exact: true })).toHaveValue('')
    await filterAccounts(page, { search: process.env.E2E_ADMIN_USERNAME, role: 'admin' })
    const protectedRow = await accountRow(page, process.env.E2E_ADMIN_USERNAME)
    await expect(protectedRow).toContainText('Được bảo vệ')
    await expect(protectedRow.getByRole('button', { name: /^(Khóa|Mở khóa)$/ })).toHaveCount(0)
    await page.goto('/quan-tri')
    await page.locator('.om-stat').filter({ hasText: 'Tài khoản bị khóa' }).click()
    await expect(page).toHaveURL(/\/quan-tri\/tai-khoan\?status=locked$/)
    await expect(page.getByLabel('Trạng thái', { exact: true })).toHaveValue('locked')
  } finally {
    await volunteer.close()
    await organizer.close()
  }
})

test('Admin đợt 1: menu đóng/mở, lưu lựa chọn và điều hướng đúng trên máy tính/điện thoại', async ({ page }, info) => {
  page.on('pageerror', error => { throw error })
  await adminLogin(page.request)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/quan-tri')
  let sidebar = await openMenu(page)
  const nav = sidebar.getByRole('navigation', { name: 'Điều hướng Quản trị viên' })
  await expect(nav.getByRole('link', { name: 'Tổng quan', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Thông báo', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: /Hồ sơ/ })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Xem hồ sơ cá nhân', exact: true })).toHaveAttribute('href', '/ho-so')
  await expect(page.locator('.od-topbar').getByRole('link', { name: 'Tài khoản của tôi', exact: true })).toHaveAttribute('href', '/ho-so')
  await expect(page.locator('.notification-bell')).toHaveAttribute('href', '/thong-bao')
  await page.locator('.workspace-menu-toggle').click()
  await expect(sidebar).toBeHidden()
  await page.reload()
  await expect(page.locator('.workspace-menu-toggle')).toHaveAttribute('aria-expanded', 'false')
  sidebar = await openMenu(page)
  await page.keyboard.press('Escape')
  await expect(sidebar).toBeHidden()
  await expect(page.locator('.workspace-menu-toggle')).toBeFocused()

  await page.setViewportSize({ width: 390, height: 844 })
  sidebar = await openMenu(page)
  await expect(sidebar).toHaveAttribute('role', 'dialog')
  await expect(sidebar).toHaveAttribute('aria-modal', 'true')
  await expect(sidebar.getByRole('button', { name: 'Đóng menu', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sidebar).toBeHidden()
  await expect(page.locator('.workspace-menu-toggle')).toBeFocused()
  sidebar = await openMenu(page)
  await sidebar.getByRole('link', { name: 'Tài khoản hệ thống', exact: true }).click()
  await expect(page).toHaveURL(/\/quan-tri\/tai-khoan$/)
  await expect(sidebar).toBeHidden()
  sidebar = await openMenu(page)
  await expect(sidebar.getByRole('link', { name: 'Tài khoản hệ thống', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.locator('.workspace-menu-backdrop').click({ position: { x: 389, y: 400 } })
  await expect(sidebar).toBeHidden()
  await evidence(page, info, 'accounts-layout')
  await page.goto('/quan-tri')
  await evidence(page, info, 'overview-layout')
})
