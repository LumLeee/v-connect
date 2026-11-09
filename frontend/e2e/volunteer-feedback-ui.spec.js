import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const activity = { id: 'feedback-ui', title: 'Bữa ăn sẻ chia', starts_at: '2030-11-21T07:00:00Z', address: 'Đà Nẵng', status: 'completed' }
const feedbackUrl = `/hoat-dong/${activity.id}/phan-hoi`
const submittedAt = '2030-11-21T10:05:00Z'

async function mockFeedback(page, options = {}) {
  const state = { gets: 0, posts: [], logoutCalls: 0, failGet: false, postMode: 'success', saved: null, canSubmit: true, status: 200, ...options }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'feedback-volunteer', full_name: 'Người kiểm tra', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'mock-token' }
    else if (url.pathname.endsWith('/auth/logout/')) { state.logoutCalls++; data = { detail: 'Đã đăng xuất.' } }
    else if (url.pathname.endsWith(`/activities/${activity.id}/feedback/`)) {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON()
        state.posts.push(payload)
        if (state.postMode === 'failure') return route.fulfill({ status: 400, json: { detail: 'Chưa gửi được phản hồi. Hãy thử lại.' } })
        state.saved = { id: 'saved-feedback', ...payload, created_at: submittedAt, is_hidden: false, hidden_reason: '' }
        if (state.postMode === 'lost') return route.abort()
        return route.fulfill({ status: 201, json: state.saved })
      }
      state.gets++
      if (state.failGet) return route.abort()
      if (state.status !== 200) return route.fulfill({ status: state.status, json: { detail: 'Bạn không có quyền xem phản hồi này.' } })
      data = { activity: state.canSubmit || state.saved ? activity : null, can_submit: state.canSubmit && !state.saved, feedback: state.saved }
    } else if (url.pathname.endsWith('/participations/history/')) data = { count: 0, results: [], next: null, previous: null, summary: { total: 0, completed: 0, feedback_count: 0, feedback_pending: 0, total_score: 0 } }
    else throw new Error(`Unexpected feedback request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  await page.clock.setFixedTime(new Date('2030-11-21T10:10:00Z'))
  return state
}

async function fillDraft(page, rating = 4) {
  await page.getByRole('radio', { name: `${rating} sao`, exact: true }).check()
  await page.getByLabel('Nội dung phản hồi', { exact: true }).fill('Mọi người hỗ trợ nhau rất tốt.')
}

test('Phản hồi: chỉ chọn sao, hỗ trợ bàn phím và kiểm tra thông tin còn thiếu', async ({ page }) => {
  const state = await mockFeedback(page)
  await page.goto(feedbackUrl)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  await expect(page.getByRole('radio')).toHaveCount(5)
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  await expect(page.getByText('Vui lòng chọn từ 1 đến 5 sao.', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: '1 sao', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: '2 sao', exact: true })).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: '3 sao', exact: true })).toBeChecked()
  await expect(page.getByText('3/5 — Bình thường', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  await expect(page.getByLabel('Nội dung phản hồi', { exact: true })).toBeFocused()
  await expect(page.getByText('Vui lòng nhập nội dung phản hồi.', { exact: true })).toBeVisible()
  expect(state.posts).toHaveLength(0)
  await page.getByLabel('Nội dung phản hồi', { exact: true }).fill(' '.repeat(10))
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  expect(state.posts).toHaveLength(0)
  await page.getByLabel('Nội dung phản hồi', { exact: true }).fill('a'.repeat(2000))
  await expect(page.getByText('2000/2.000 ký tự', { exact: true })).toBeVisible()
  await page.getByLabel('Nội dung phản hồi', { exact: true }).press('End')
  await page.keyboard.type('b')
  await expect(page.getByLabel('Nội dung phản hồi', { exact: true })).toHaveValue('a'.repeat(2000))
})

test('Phản hồi: gửi một lần, hiển thị nội dung an toàn và điều hướng không hỏi lại sau thành công', async ({ page }) => {
  const state = await mockFeedback(page)
  await page.goto(feedbackUrl)
  await fillDraft(page, 5)
  const content = '  Trải nghiệm tốt. <script>window.feedbackInjected = true</script>  '
  await page.getByLabel('Nội dung phản hồi', { exact: true }).fill(content)
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Phản hồi đã gửi', exact: true })).toBeVisible()
  await expect(page.getByText('Điểm đánh giá: 5/5', { exact: true })).toBeVisible()
  await expect(page.locator('.vf-content')).toHaveText(content.trim())
  await expect(page.locator('.vf-sent-at time')).toHaveText('5 phút trước')
  await expect(page.getByRole('button', { name: 'Gửi phản hồi', exact: true })).toHaveCount(0)
  expect(state.posts).toEqual([{ rating: 5, content: content.trim() }])
  expect(await page.evaluate(() => window.feedbackInjected)).toBeUndefined()
  let dialogs = 0
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss() })
  await page.getByRole('link', { name: 'Về lịch sử hoạt động', exact: true }).click()
  await expect(page).toHaveURL(/\/tinh-nguyen-vien\/lich-su$/)
  expect(dialogs).toBe(0)
})

test('Phản hồi: lỗi gửi và lỗi kiểm tra trạng thái giữ bản nháp, thử lại rồi gửi được', async ({ page }) => {
  const state = await mockFeedback(page)
  await page.goto(feedbackUrl)
  await fillDraft(page)
  state.postMode = 'failure'; state.failGet = true
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  await expect(page.getByText('Chưa gửi được phản hồi. Hãy thử lại.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Nội dung phản hồi', { exact: true })).toHaveValue('Mọi người hỗ trợ nhau rất tốt.')
  await expect(page.getByRole('radio', { name: '4 sao', exact: true })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Gửi phản hồi', exact: true })).toBeDisabled()
  state.failGet = false; state.postMode = 'success'
  await page.locator('.volunteer-feedback').getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Gửi phản hồi', exact: true })).toBeEnabled()
  await expect(page.getByLabel('Nội dung phản hồi', { exact: true })).toHaveValue('Mọi người hỗ trợ nhau rất tốt.')
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  await expect(page.getByText('Bạn đã gửi phản hồi cho hoạt động này.', { exact: true })).toBeVisible()
  expect(state.posts).toHaveLength(2)
})

test('Phản hồi: tìm lại kết quả khi mất phản hồi POST và không gửi trùng', async ({ page }) => {
  const state = await mockFeedback(page, { postMode: 'lost' })
  await page.goto(feedbackUrl)
  await fillDraft(page)
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  await expect(page.getByText('Bạn đã gửi phản hồi cho hoạt động này.', { exact: true })).toBeVisible()
  await expect(page.locator('.vf-submit-error')).toHaveCount(0)
  expect(state.posts).toHaveLength(1)
  let dialogs = 0
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss() })
  await page.getByRole('link', { name: 'Về lịch sử hoạt động', exact: true }).click()
  await expect(page).toHaveURL(/\/tinh-nguyen-vien\/lich-su$/)
  expect(dialogs).toBe(0)
})

test('Phản hồi: cảnh báo bản nháp khi rời trang, giữ khi hủy và làm mới', async ({ page }) => {
  const state = await mockFeedback(page)
  await page.goto(feedbackUrl)
  await fillDraft(page)
  const before = state.gets
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets).toBeGreaterThan(before)
  await expect(page.getByLabel('Nội dung phản hồi', { exact: true })).toHaveValue('Mọi người hỗ trợ nhau rất tốt.')
  let warnings = 0
  page.once('dialog', async dialog => { warnings++; expect(dialog.message()).toContain('thay đổi chưa lưu'); await dialog.dismiss() })
  await page.getByRole('link', { name: 'Về lịch sử hoạt động', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${feedbackUrl}$`))
  await expect(page.getByRole('radio', { name: '4 sao', exact: true })).toBeChecked()
  if (!await page.getByRole('button', { name: 'Đăng xuất', exact: true }).isVisible()) await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
  page.once('dialog', async dialog => { warnings++; await dialog.dismiss() })
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  expect(state.logoutCalls).toBe(0)
  await expect(page).toHaveURL(new RegExp(`${feedbackUrl}$`))
  const closeMenu = page.locator('.workspace-sidebar-close:visible')
  if (await closeMenu.count()) await closeMenu.click()
  page.once('dialog', async dialog => { warnings++; await dialog.accept() })
  await page.getByRole('link', { name: 'Về lịch sử hoạt động', exact: true }).click()
  await expect(page).toHaveURL(/\/tinh-nguyen-vien\/lich-su$/)
  expect(warnings).toBe(3)
  expect(state.posts).toHaveLength(0)
})

test('Phản hồi: bản đã ẩn vẫn hiện nội dung của mình, lý do và không có thao tác sửa xóa', async ({ page }, info) => {
  await mockFeedback(page, { saved: { id: 'hidden-feedback', rating: 2, content: 'Cần chuẩn bị kỹ hơn.\nLần sau mong được hướng dẫn rõ.', created_at: submittedAt,
    is_hidden: true, hidden_reason: 'Nội dung cần được xem xét.' } })
  await page.goto(feedbackUrl)
  await expect(page.getByText('Điểm đánh giá: 2/5', { exact: true })).toBeVisible()
  await expect(page.getByText('Lý do: Nội dung cần được xem xét.', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Sửa|Xóa|Gửi phản hồi/ })).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage3-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-feedback-submitted.png`), fullPage: true })
})

test('Phản hồi: chưa đủ điều kiện, lỗi quyền truy cập và tải lại sau lỗi', async ({ page }) => {
  const state = await mockFeedback(page, { canSubmit: false })
  await page.goto(feedbackUrl)
  await expect(page.getByText('Bạn chỉ có thể gửi phản hồi khi đã được xác nhận có mặt và hoạt động đã Hoàn thành.', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  state.status = 403
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.volunteer-feedback').getByRole('alert')).toContainText('Bạn không có quyền xem phản hồi này.')
  await expect(page.getByRole('button', { name: 'Gửi phản hồi', exact: true })).toHaveCount(0)
  state.status = 200; state.canSubmit = true
  await page.locator('.volunteer-feedback').getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('radio')).toHaveCount(5)
})

test('Phản hồi: biểu mẫu vừa màn hình nhỏ, giữ nút làm mới bên phải và không hỏi khi chưa sửa', async ({ page }, info) => {
  await mockFeedback(page)
  await page.goto(feedbackUrl)
  await expect(page.getByRole('radio')).toHaveCount(5)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const button = await page.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox()
    const heading = await page.locator('.vf-heading').boundingBox()
    expect(Math.abs(button.x + button.width - heading.x - heading.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage3-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-feedback-form.png`), fullPage: true })
  let dialogs = 0
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss() })
  await page.getByRole('link', { name: 'Về lịch sử hoạt động', exact: true }).click()
  await expect(page).toHaveURL(/\/tinh-nguyen-vien\/lich-su$/)
  expect(dialogs).toBe(0)
})
