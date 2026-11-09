import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/quan-tri/tai-khoan'
const makeAccount = (id, extra = {}) => ({ id: `account-${id}`, full_name: `Tình nguyện viên ${String(id).padStart(2, '0')}`, email: `account${id}@example.invalid`, username: null, role: 'volunteer', is_active: true, date_joined: '2025-02-03T02:30:00Z', ...extra })

async function fixtures(page) {
  const state = {
    entries: [...Array.from({ length: 14 }, (_, index) => makeAccount(index + 1)), makeAccount(15, { full_name: 'Nhà tổ chức cộng đồng', role: 'organizer' }), makeAccount(16, { full_name: 'Quản trị kiểm thử', email: null, username: 'admin', role: 'admin' }), makeAccount(17, { full_name: 'Tài khoản bị khóa', is_active: false })],
    gets: [], posts: [], failList: false, failStatus: false, holdStatus: null,
  }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-ui', full_name: 'Quản trị kiểm thử', email: null, username: 'admin', role: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'admin-ui-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/status/') && request.method() === 'POST') {
      const id = url.pathname.split('/').at(-3), payload = request.postDataJSON()
      state.posts.push({ id, ...payload })
      if (state.holdStatus) await state.holdStatus
      if (state.failStatus) return route.fulfill({ status: 400, json: { detail: 'Không thể đổi trạng thái lúc này. Vui lòng thử lại.' } })
      const entry = state.entries.find(item => item.id === id)
      entry.is_active = payload.is_active
      data = entry
    } else if (url.pathname.endsWith('/admin/accounts/')) {
      state.gets.push(url.search)
      if (state.failList) return route.abort()
      const term = (url.searchParams.get('search') || '').toLocaleLowerCase('vi-VN')
      const role = url.searchParams.get('role'), status = url.searchParams.get('status')
      const entries = state.entries.filter(entry => (!term || `${entry.full_name} ${entry.email || ''} ${entry.username || ''}`.toLocaleLowerCase('vi-VN').includes(term)) && (!role || entry.role === role) && (!status || entry.is_active === (status === 'active')))
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      data = { count: entries.length, results: entries.slice(offset, offset + 12), next: entries.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else throw new Error(`Unexpected admin accounts request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function screenshot(page, info, label) {
  const target = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-stage1-preview'
  await mkdir(target, { recursive: true })
  await page.screenshot({ path: path.join(target, `${info.project.name}-${label}.png`), fullPage: true })
}

test('Tài khoản admin: lọc từ URL, phân trang, quay lại và bỏ từng điều kiện', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(`${base}?role=volunteer&status=active`)
  const filters = page.getByRole('form', { name: 'Bộ lọc tài khoản' })
  await expect(filters.getByLabel('Vai trò', { exact: true })).toHaveValue('volunteer')
  await expect(filters.getByLabel('Trạng thái', { exact: true })).toHaveValue('active')
  await expect(page.locator('.ad-account-results')).toContainText('14 tài khoản phù hợp bộ lọc')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.ad-account-row h2')).toHaveText(['Tình nguyện viên 13', 'Tình nguyện viên 14'])
  expect(state.gets.at(-1)).toContain('role=volunteer')
  await filters.getByLabel('Tìm tài khoản', { exact: true }).fill('account13@')
  await filters.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  await expect(page.locator('.ad-account-row h2')).toHaveText(['Tình nguyện viên 13'])
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await page.goBack()
  await expect(filters.getByLabel('Tìm tài khoản', { exact: true })).toHaveValue('')
  await expect(page.locator('.ad-account-row')).toHaveCount(2)
  await page.goForward()
  await expect(filters.getByLabel('Tìm tài khoản', { exact: true })).toHaveValue('account13@')
  await page.getByRole('button', { name: 'Bỏ bộ lọc Tìm: account13@', exact: true }).click()
  await expect(page.locator('.ad-account-results')).toContainText('14 tài khoản phù hợp bộ lọc')
  await filters.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await expect(page.locator('.ad-account-results')).toContainText('17 tài khoản trong hệ thống')
  await expect(filters.getByLabel('Vai trò', { exact: true })).toHaveValue('')
  await expect(filters.getByLabel('Trạng thái', { exact: true })).toHaveValue('')
})

test('Tài khoản admin: bàn phím mở chi tiết, admin được bảo vệ và bố cục không tràn', async ({ page }, info) => {
  const state = await fixtures(page)
  state.entries = [state.entries[0], state.entries[14], state.entries[15], state.entries[16]]
  state.entries[0].full_name = 'Nguyễn Minh Anh với họ tên dài để kiểm tra bố cục tài khoản'
  state.entries[0].email = 'tai.khoan.tinh.nguyen.vien.dia.chi.dai@example.invalid'
  await page.goto(base)
  const row = page.locator('.ad-account-row').first()
  await row.focus(); await row.press('Enter')
  const details = page.getByRole('dialog', { name: state.entries[0].full_name, exact: true })
  await expect(details).toContainText(state.entries[0].email)
  await expect(details).toContainText('Ngày tham gia')
  await expect(details.locator('time')).toHaveAttribute('datetime', state.entries[0].date_joined)
  await details.getByRole('button', { name: 'Đóng', exact: true }).click()
  const admin = page.locator('.ad-account-row').filter({ has: page.getByRole('heading', { name: 'Quản trị kiểm thử', exact: true }) })
  await expect(admin).toContainText('Được bảo vệ')
  await expect(admin.getByRole('button', { name: /^(Khóa|Mở khóa)$/ })).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `accounts at ${width}px`).toBe(true)
    const heading = page.locator('.ad-account-heading'), refresh = heading.getByRole('button', { name: 'Làm mới', exact: true })
    const headingBox = await heading.boundingBox(), refreshBox = await refresh.boundingBox()
    expect(Math.abs(headingBox.x + headingBox.width - refreshBox.x - refreshBox.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  await screenshot(page, info, 'admin-accounts')
  const before = state.gets.length
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets.length).toBeGreaterThan(before)
})

test('Tài khoản admin: lỗi tải có thể thử lại và kết quả trống có hướng dẫn', async ({ page }) => {
  const state = await fixtures(page)
  state.failList = true
  await page.goto(base)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.ad-account-row')).toHaveCount(0)
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.ad-account-results')).toContainText('17 tài khoản')
  await page.getByLabel('Tìm tài khoản', { exact: true }).fill('không-tồn-tại')
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Không có tài khoản phù hợp' })).toBeVisible()
  await expect(page.locator('.ad-account-results')).toContainText('0 tài khoản phù hợp bộ lọc')
  await expect(page.locator('.ad-account-row')).toHaveCount(0)
})

test('Tài khoản admin: khóa cần lý do, giữ lỗi để thử lại và cập nhật đúng bộ lọc', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto(`${base}?role=volunteer&status=active&page=2`)
  const row = page.locator('.ad-account-row').first()
  await expect(row).toContainText('Tình nguyện viên 13')
  await row.getByRole('button', { name: 'Khóa', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Khóa tài khoản', exact: true })
  await expect(dialog).toContainText('Tình nguyện viên 13')
  await expect(dialog).toContainText('account13@example.invalid')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  const confirm = dialog.getByRole('button', { name: 'Xác nhận khóa', exact: true })
  await expect(confirm).toBeDisabled()
  const reason = dialog.getByLabel('Lý do khóa tài khoản', { exact: true })
  await reason.fill('   '); await expect(confirm).toBeDisabled()
  await reason.fill('Kiểm tra thông tin theo yêu cầu quản trị.')
  state.failStatus = true
  await confirm.click()
  await expect(dialog.getByRole('alert')).toContainText('Không thể đổi trạng thái lúc này')
  await expect(reason).toHaveValue('Kiểm tra thông tin theo yêu cầu quản trị.')
  await screenshot(page, info, 'admin-account-status-error')
  let release
  state.holdStatus = new Promise(resolve => { release = resolve })
  state.failStatus = false
  await confirm.click()
  await expect(dialog.getByRole('button', { name: 'Đang lưu…', exact: true })).toBeDisabled()
  await expect(reason).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  release()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.ad-account-success')).toContainText('Đã khóa tài khoản Tình nguyện viên 13')
  await expect(page.locator('.ad-account-results')).toContainText('13 tài khoản phù hợp bộ lọc')
  expect(new URL(page.url()).searchParams.get('status')).toBe('active')
  expect(new URL(page.url()).searchParams.get('role')).toBe('volunteer')
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  expect(state.posts).toHaveLength(2)
  expect(state.posts[1]).toEqual({ id: 'account-13', is_active: false, reason: 'Kiểm tra thông tin theo yêu cầu quản trị.' })
})

test('Tài khoản admin: hủy mở khóa không gửi yêu cầu, xác nhận mới đổi trạng thái', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(`${base}?status=locked`)
  await page.getByRole('button', { name: 'Mở khóa', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Mở khóa tài khoản', exact: true })
  await dialog.getByLabel('Lý do mở khóa tài khoản', { exact: true }).fill('Đã xác minh thông tin.')
  await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.posts).toHaveLength(0)
  await page.getByRole('button', { name: 'Mở khóa', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Mở khóa tài khoản', exact: true })
  await expect(dialog.getByLabel('Lý do mở khóa tài khoản', { exact: true })).toHaveValue('')
  await dialog.getByLabel('Lý do mở khóa tài khoản', { exact: true }).fill('Đã xác minh thông tin.')
  await dialog.getByRole('button', { name: 'Xác nhận mở khóa', exact: true }).click()
  await expect(page.locator('.ad-account-success')).toContainText('Đã mở khóa tài khoản Tài khoản bị khóa')
  await expect(page.locator('.ad-account-results')).toContainText('0 tài khoản phù hợp bộ lọc')
  expect(state.posts).toEqual([{ id: 'account-17', is_active: true, reason: 'Đã xác minh thông tin.' }])
})
