import { test, expect } from '@playwright/test'

const first = { id: 'session-first', full_name: 'Tài khoản thứ nhất', email: 'first@example.invalid', role: 'volunteer' }
const second = { id: 'session-second', full_name: 'Tài khoản thứ hai', email: 'second@example.invalid', role: 'volunteer' }

async function fixture(page) {
  const state = { user: first, failure: null, meGets: 0 }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) {
      state.meGets++
      if (state.failure === 'network') return route.abort()
      if (state.failure) return route.fulfill({ status: state.failure, json: { error: { message: state.failure === 401 ? 'Phiên đăng nhập đã hết hạn.' : 'Máy chủ tạm thời không khả dụng.' } } })
      data = { user: state.user }
    } else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { ...state.user, phone: '', bio: '', avatar_url: null,
      volunteer: { skills: [], interests: [], availability: [], matching_visible: false } } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/skills/')) data = { count: 0, next: null, previous: null, results: [] }
    else throw new Error(`Unexpected session request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function focusSession(page, state) {
  const before = state.meGets
  const failed = state.failure === 'network'
  const finished = page.waitForEvent(failed ? 'requestfailed' : 'requestfinished', request => new URL(request.url()).pathname.endsWith('/auth/me/'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await finished
  await expect.poll(() => state.meGets).toBeGreaterThan(before)
  // Let the completed fetch update React before checking whether the draft survived.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

test('Phiên đăng nhập: mất mạng hoặc lỗi máy chủ khi focus giữ bản nháp và phục hồi cùng tài khoản', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/ho-so')
  await page.getByLabel('Họ và tên', { exact: true }).fill('Tên đang chỉnh sửa')
  await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Bản nháp cần giữ')
  await page.getByRole('button', { name: 'Thêm khung giờ', exact: true }).click()
  for (const failure of ['network', 503]) {
    state.failure = failure
    await focusSession(page, state)
    await expect(page).toHaveURL(/\/ho-so$/)
    await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Tên đang chỉnh sửa')
    await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('Bản nháp cần giữ')
    await expect(page.getByLabel('Giờ bắt đầu 1', { exact: true })).toHaveValue('08:00')
    await expect(page.locator('.profile-save-status')).toHaveText('Có thay đổi chưa lưu')
    await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeEnabled()
  }
  state.failure = null
  await focusSession(page, state)
  await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('Bản nháp cần giữ')
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Tên đang chỉnh sửa')
})

test('Phiên đăng nhập: tài khoản thay đổi xóa bản nháp cũ, lỗi 401 vẫn kết thúc phiên', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/ho-so')
  await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Bản nháp riêng tư của người trước')
  state.user = second
  await focusSession(page, state)
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue(second.full_name)
  await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('')
  await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Bản nháp tài khoản thứ hai')
  state.failure = 401
  await focusSession(page, state)
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await expect(page.locator('.profile-form')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible()
})

test('Phiên đăng nhập: lỗi kiểm tra lần đầu hiển thị thử lại, không cấp phiên khi chưa xác thực', async ({ page }) => {
  const state = await fixture(page)
  state.failure = 503
  await page.goto('/ho-so')
  await expect(page.getByRole('alert')).toContainText('Máy chủ gặp lỗi khi xử lý yêu cầu.')
  await expect(page.locator('.profile-form')).toHaveCount(0)
  state.failure = null
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue(first.full_name)
  await expect(page.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('')
})
