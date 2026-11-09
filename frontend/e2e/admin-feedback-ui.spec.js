import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/quan-tri/phan-hoi'
const activity = '11111111-1111-4111-8111-111111111111'
const otherActivity = '22222222-2222-4222-8222-222222222222'
const activityTitle = 'Bữa ăn cộng đồng – Chuẩn bị và trao tặng suất ăn'
const makeEntry = (number, extra = {}) => ({ id: `feedback-${number}`, activity_id: activity, activity_title: activityTitle, volunteer_name: `Tình nguyện viên ${String(number).padStart(2, '0')}`, rating: 4, content: `Nội dung phản hồi số ${number}. Nhóm hỗ trợ chu đáo và hướng dẫn rõ ràng.`, created_at: '2025-02-03T02:30:00Z', is_hidden: false, hidden_reason: '', hidden_by_name: null, hidden_at: null, ...extra })

async function fixtures(page) {
  const state = {
    entries: [...Array.from({ length: 14 }, (_, index) => makeEntry(index + 1)), makeEntry(15, { is_hidden: true, hidden_reason: 'Nội dung trùng lặp cần ẩn.', hidden_by_name: 'Quản trị kiểm thử', hidden_at: '2025-02-04T03:00:00Z' }), makeEntry(16, { activity_id: otherActivity, activity_title: 'Hướng dẫn công nghệ cho người lớn tuổi' })],
    gets: [], posts: [], aiPosts: [], failList: false, failHide: false, holdList: null, holdHide: null,
  }
  page.on('pageerror', error => { throw error })
  function selected(filters) {
    return state.entries.filter(entry => (!filters.activity || entry.activity_id === filters.activity) && (filters.status === 'hidden' ? entry.is_hidden : filters.status === 'visible' ? !entry.is_hidden : true))
  }
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-feedback-ui', full_name: 'Quản trị kiểm thử', username: 'admin', role: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'feedback-ui-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith(`/reports/activities/${activity}/`)) data = { activity: { id: activity, title: activityTitle, status: 'completed' } }
    else if (url.pathname.includes('/reports/activities/')) return route.fulfill({ status: 400, json: { detail: 'Mã hoạt động không hợp lệ.' } })
    else if (url.pathname.endsWith('/admin/feedback/ai-analysis/') && request.method() === 'POST') {
      const filters = request.postDataJSON(), count = selected(filters).length
      state.aiPosts.push(filters)
      data = { ai: { status: 'disabled' }, generated_at: '2025-02-03T02:30:00Z', scope: { feedback_count: count, analyzed_count: count, truncated: false }, sentiments: [], topics: [], review_items: [], summary: { text: 'Trích dẫn kiểm thử từ các phản hồi đang chọn.', evidence: [] }, limitations: [] }
    } else if (url.pathname.endsWith('/hide/') && request.method() === 'POST') {
      const id = url.pathname.split('/').at(-3), payload = request.postDataJSON()
      state.posts.push({ id, ...payload })
      if (state.holdHide) await state.holdHide
      if (state.failHide) return route.fulfill({ status: 400, json: { detail: 'Không thể ẩn phản hồi lúc này. Vui lòng thử lại.' } })
      const entry = state.entries.find(item => item.id === id)
      Object.assign(entry, { is_hidden: true, hidden_reason: payload.reason, hidden_by_name: 'Quản trị kiểm thử', hidden_at: '2025-02-05T03:00:00Z' })
      data = entry
    } else if (url.pathname.endsWith('/admin/feedback/')) {
      state.gets.push(url.search)
      if (url.searchParams.has('activity') && ![activity, otherActivity].includes(url.searchParams.get('activity'))) return route.fulfill({ status: 400, json: { detail: 'Mã hoạt động không hợp lệ.' } })
      if (state.holdList) await state.holdList
      if (state.failList) return route.abort()
      const entries = selected(Object.fromEntries(url.searchParams)), pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      data = { count: entries.length, results: entries.slice(offset, offset + 12), next: entries.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else throw new Error(`Unexpected feedback UI request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function screenshot(page, info, label) {
  const target = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-stage2-preview'
  await mkdir(target, { recursive: true })
  await page.screenshot({ path: path.join(target, `${info.project.name}-${label}.png`), fullPage: true })
}

test('Phản hồi admin: bộ lọc URL, hoạt động, phân trang và quay lại đúng phạm vi', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(`${base}?activity=${activity}&status=visible&page=2`)
  await expect(page.locator('.ad-feedback-results')).toContainText('14 phản hồi chưa ẩn')
  await expect(page.locator('.ad-feedback-row h2')).toHaveText(['Tình nguyện viên 13', 'Tình nguyện viên 14'])
  await expect(page.locator('.ad-feedback-context')).toContainText(activityTitle)
  await page.getByRole('button', { name: 'Đã ẩn', exact: true }).click()
  await expect(page.locator('.ad-feedback-row')).toHaveCount(1)
  expect(new URL(page.url()).searchParams.get('activity')).toBe(activity)
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await page.goBack()
  await expect(page.locator('.ad-feedback-row h2')).toHaveText(['Tình nguyện viên 13', 'Tình nguyện viên 14'])
  await expect(page.getByRole('button', { name: 'Chưa ẩn', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goForward()
  await expect(page.locator('.ad-feedback-results')).toContainText('1 phản hồi đã ẩn')
  await page.getByRole('button', { name: 'Bỏ lọc theo hoạt động', exact: true }).click()
  await expect(page.locator('.ad-feedback-context')).toHaveCount(0)
  await expect.poll(() => state.gets.at(-1).includes('activity=')).toBe(false)
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click()
  await expect(page.locator('.ad-feedback-results')).toContainText('16 phản hồi trong hệ thống')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.ad-feedback-row')).toHaveCount(4)
  expect(state.aiPosts).toHaveLength(0)
})

test('Phản hồi admin: mở dòng bằng bàn phím, xem đầy đủ nội dung và thông tin đã ẩn', async ({ page }, info) => {
  const state = await fixtures(page)
  state.entries = [makeEntry(1, { volunteer_name: 'Nguyễn Minh Anh với họ tên dài để kiểm tra bố cục', content: '<img src=x onerror=alert(1)> Nội dung phản hồi được hiển thị như văn bản.\n' + 'Đây là nội dung cần xem đầy đủ. '.repeat(30), created_at: 'không-phải-ngày' }), state.entries[14]]
  await page.goto(base)
  const row = page.locator('.ad-feedback-row').first()
  await row.focus(); await row.press('Enter')
  let dialog = page.getByRole('dialog', { name: `Phản hồi của ${state.entries[0].volunteer_name}`, exact: true })
  await expect(dialog.locator('.ad-feedback-full-content')).toHaveText(state.entries[0].content)
  await expect(dialog.locator('.ad-feedback-time')).toContainText('Chưa có thông tin')
  await expect(dialog.locator('img')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(row).toBeFocused()
  await row.press('Space')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await page.keyboard.press('Escape')
  const hidden = page.locator('.ad-feedback-row').last()
  await hidden.click()
  dialog = page.getByRole('dialog', { name: 'Phản hồi của Tình nguyện viên 15', exact: true })
  await expect(dialog).toContainText('Nội dung trùng lặp cần ẩn.')
  await expect(dialog).toContainText('Quản trị kiểm thử')
  await expect(dialog.locator('time')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: /Mở ẩn|Hiện lại/ })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `feedback at ${width}px`).toBe(true)
    const heading = await page.locator('.ad-feedback-heading').boundingBox(), refresh = await page.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox()
    expect(Math.abs(heading.x + heading.width - refresh.x - refresh.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  await screenshot(page, info, 'admin-feedback')
})

test('Phản hồi admin: lỗi tải, tải lại không giữ dữ liệu cũ và danh sách trống', async ({ page }) => {
  const state = await fixtures(page)
  state.failList = true
  await page.goto(base)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.ad-feedback-row')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Phân tích AI', exact: true })).toBeDisabled()
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.ad-feedback-row')).toHaveCount(12)
  let release
  state.holdList = new Promise(resolve => { release = resolve })
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.ad-feedback-row')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chưa ẩn', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  state.entries = []; release()
  await expect(page.getByRole('heading', { name: 'Chưa có phản hồi', exact: true })).toBeVisible()
  await expect(page.locator('.ad-feedback-results')).toContainText('0 phản hồi trong hệ thống')
})

test('Phản hồi admin: mã hoạt động sai hoặc rỗng không mở rộng ra toàn hệ thống', async ({ page }) => {
  const state = await fixtures(page)
  for (const value of ['khong-phai-uuid', '']) {
    await page.goto(`${base}?activity=${value}&status=visible`)
    await expect(page.getByRole('alert').filter({ hasText: 'Mã hoạt động không hợp lệ.' })).toBeVisible()
    await expect(page.locator('.ad-feedback-row')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Phân tích AI', exact: true })).toBeDisabled()
    expect(new URLSearchParams(state.gets.at(-1)).get('activity')).toBe(value)
  }
  expect(state.aiPosts).toHaveLength(0)
  await page.getByRole('button', { name: 'Bỏ lọc theo hoạt động', exact: true }).click()
  await expect(page.locator('.ad-feedback-results')).toContainText('15 phản hồi chưa ẩn')
})

test('Phản hồi admin: ẩn cần lý do, giữ lỗi để thử lại, chặn gửi trùng và bỏ kết quả AI cũ', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto(`${base}?activity=${activity}&status=visible&page=2`)
  await expect(page.locator('.ad-feedback-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Phân tích AI', exact: true }).click()
  await expect(page.getByLabel('Trạng thái AI', { exact: true })).toBeVisible()
  expect(state.aiPosts).toEqual([{ activity, status: 'visible' }])
  await page.locator('.ad-feedback-row').first().getByRole('button', { name: 'Ẩn phản hồi', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Ẩn phản hồi', exact: true })
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(dialog).toContainText('Tình nguyện viên 13')
  await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.posts).toHaveLength(0)
  await page.locator('.ad-feedback-row').first().getByRole('button', { name: 'Ẩn phản hồi', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Ẩn phản hồi', exact: true })
  const reason = dialog.getByLabel('Lý do ẩn phản hồi', { exact: true }), confirm = dialog.getByRole('button', { name: 'Xác nhận ẩn phản hồi', exact: true })
  await expect(confirm).toBeDisabled()
  await reason.fill('   '); await expect(confirm).toBeDisabled()
  await reason.fill('  Nội dung trùng lặp đã được kiểm tra.  ')
  state.failHide = true
  await confirm.click()
  await expect(dialog.getByRole('alert')).toContainText('Không thể ẩn phản hồi lúc này')
  await expect(reason).toHaveValue('  Nội dung trùng lặp đã được kiểm tra.  ')
  await screenshot(page, info, 'admin-feedback-hide-error')
  let release
  state.failHide = false
  state.holdHide = new Promise(resolve => { release = resolve })
  await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit() })
  await expect(dialog.getByRole('button', { name: 'Đang lưu…', exact: true })).toBeDisabled()
  await expect(reason).toBeDisabled()
  await expect(page.locator('.ad-feedback-filters button').filter({ hasText: 'Chưa ẩn' })).toBeDisabled()
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible()
  await expect.poll(() => state.posts.length).toBe(2)
  release()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.ad-feedback-results')).toContainText('13 phản hồi chưa ẩn')
  expect(new URL(page.url()).searchParams.get('activity')).toBe(activity)
  expect(new URL(page.url()).searchParams.get('status')).toBe('visible')
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  expect(state.posts).toEqual([{ id: 'feedback-13', reason: 'Nội dung trùng lặp đã được kiểm tra.' }, { id: 'feedback-13', reason: 'Nội dung trùng lặp đã được kiểm tra.' }])
  await expect(page.getByLabel('Trạng thái AI', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Phân tích AI', exact: true })).toBeEnabled()
  expect(state.aiPosts).toHaveLength(1)
  await page.getByRole('button', { name: 'Đã ẩn', exact: true }).click()
  const hiddenRow = page.locator('.ad-feedback-row').filter({ has: page.getByRole('heading', { name: 'Tình nguyện viên 13', exact: true }) })
  await expect(hiddenRow.getByRole('button', { name: 'Ẩn phản hồi', exact: true })).toHaveCount(0)
  await hiddenRow.focus(); await hiddenRow.press('Enter')
  await expect(page.getByRole('dialog')).toContainText('Nội dung trùng lặp đã được kiểm tra.')
})
