import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/quan-tri/nhat-ky'
const actor = '12345678-1234-4234-8234-123456789012'
const entry = index => ({ id: `audit-${index}`, actor, actor_name: 'Quản trị kiểm thử', subject: '22345678-1234-4234-8234-123456789012', subject_name: `Tài khoản ${index}`, activity: '32345678-1234-4234-8234-123456789012', activity_title: 'Hoạt động hỗ trợ cộng đồng', action: 'activity_updated', action_label: 'Sửa hoạt động', object_id: '42345678-1234-4234-8234-123456789012', reason: `Đối chiếu thay đổi ${index}.`, created_at: '2025-02-03T02:30:00Z', before: { capacity: 0, is_active: false, required_skills: [], description: null }, after: { capacity: 12, is_active: true, required_skills: ['Giao tiếp'], description: '<img src=x onerror="window.auditInjected=true">', timeline: [{ description: 'Nội dung mốc', title: 'Tập trung', starts_at: '2025-02-03T03:00:00Z', ends_at: 'invalid-time' }] } })

async function fixtures(page) {
  const state = { entries: Array.from({ length: 14 }, (_, i) => entry(i + 1)), gets: [], fail: false, failDetail: false, hold: null }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-audit-ui', full_name: 'Quản trị kiểm thử', username: 'admin', role: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/admin/audit/')) {
      state.gets.push(url.search)
      if (state.hold) await state.hold
      if (state.fail) return route.abort()
      const fields = { actor_search: 'actor_name', subject_search: 'subject_name', activity_search: 'activity_title', actor: 'actor', subject: 'subject', activity: 'activity', object_id: 'object_id', action: 'action' }
      const matches = state.entries.filter(row => Object.entries(fields).every(([filter, key]) => !url.searchParams.get(filter) || String(row[key]).includes(url.searchParams.get(filter))))
      const current = Number(url.searchParams.get('page') || 1), offset = (current - 1) * 12
      data = { count: matches.length, results: matches.slice(offset, offset + 12), previous: current > 1 ? 'previous' : null, next: matches.length > offset + 12 ? 'next' : null }
    } else if (/\/admin\/audit\/[^/]+\/$/.test(url.pathname)) {
      if (state.failDetail) return route.abort()
      data = state.entries.find(row => row.id === url.pathname.split('/').at(-2))
      if (!data) return route.fulfill({ status: 404, json: { detail: 'Không tìm thấy thao tác.' } })
    } else throw new Error(`Unexpected audit request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function capture(page, info, label) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label} at ${width}px`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-remaining-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-${label}.png`), fullPage: true })
}

test('Nhật ký admin: URL, phân trang, quay lại, bỏ từng bộ lọc và chọn thao tác tự áp dụng', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(`${base}?action=activity_updated&actor=${actor}&date_from=2025-02-01&date_to=2025-02-04`)
  const filters = page.getByRole('form', { name: 'Bộ lọc nhật ký' })
  await expect(filters.getByLabel('Loại thao tác', { exact: true })).toHaveValue('activity_updated')
  await expect(filters.getByLabel('Mã người thực hiện', { exact: true })).toHaveValue(actor)
  await expect(filters.getByLabel('Từ ngày', { exact: true })).toHaveValue('2025-02-01')
  await expect(page.locator('.ad-audit-count')).toContainText('14 thao tác phù hợp bộ lọc')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.ad-audit-row')).toHaveCount(2)
  expect(state.gets.at(-1)).toContain(`actor=${actor}`)
  await filters.getByLabel('Tài khoản liên quan', { exact: true }).fill('Tài khoản 14')
  await filters.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
  await expect(page.locator('.ad-audit-row')).toHaveCount(1)
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  await page.goBack()
  await expect(filters.getByLabel('Tài khoản liên quan', { exact: true })).toHaveValue('')
  await expect(page.locator('.ad-audit-row')).toHaveCount(2)
  await page.goForward()
  await expect(filters.getByLabel('Tài khoản liên quan', { exact: true })).toHaveValue('Tài khoản 14')
  await page.getByRole('button', { name: 'Bỏ bộ lọc Tài khoản liên quan: Tài khoản 14', exact: true }).click()
  await expect(page.locator('.ad-audit-count')).toContainText('14 thao tác')
  await filters.getByLabel('Loại thao tác', { exact: true }).selectOption('account_locked')
  await expect(page.getByRole('heading', { name: 'Chưa có thao tác phù hợp', exact: true })).toBeVisible()
  expect(new URL(page.url()).searchParams.get('action')).toBe('account_locked')
  await filters.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await expect(page.locator('.ad-audit-count')).toContainText('14 thao tác được ghi nhận')
  await expect(filters.getByLabel('Loại thao tác', { exact: true })).toHaveValue('')
})

test('Nhật ký admin: bàn phím mở chi tiết, so sánh dữ liệu có kiểu và giữ bộ lọc khi trở về', async ({ page }, info) => {
  const state = await fixtures(page)
  state.entries[0].actor_name = 'Quản trị có tên rất dài để kiểm tra cách hiển thị trên điện thoại'
  state.entries[0].reason = 'Đối chiếu thông tin theo yêu cầu quản trị. '.repeat(8)
  await page.goto(`${base}?action=activity_updated`)
  await expect(page.locator('.ad-audit-row').first()).toContainText(state.entries[0].reason.trim())
  await capture(page, info, 'admin-audit-list')
  const row = page.locator('.ad-audit-row').first()
  await row.focus(); await row.press('Enter')
  await expect(page.getByRole('heading', { name: 'Chi tiết thao tác', exact: true })).toBeVisible()
  await expect(page.locator('.audit-meta')).toContainText(actor)
  await expect(page.locator('.ad-audit-detail-reason')).toContainText(state.entries[0].reason.trim())
  const changes = page.locator('.audit-changes')
  const field = name => changes.locator('.audit-change').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await expect(field('Sức chứa').locator('.audit-comparison > section').first()).toContainText('0')
  await expect(field('Tài khoản hoạt động').locator('.audit-comparison > section')).toHaveText(['TrướcKhông', 'SauCó'])
  await expect(field('Kỹ năng yêu cầu')).toContainText('Danh sách rỗng')
  await expect(field('Mô tả')).toContainText('Chưa có')
  await expect(field('Mô tả')).toContainText(state.entries[0].after.description)
  await expect(field('Mô tả').locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => window.auditInjected)).toBeUndefined()
  await expect(field('Chương trình hoạt động')).toContainText('Không ghi nhận')
  await expect(field('Chương trình hoạt động')).toContainText('invalid-time')
  await expect(changes).not.toContainText('Invalid Date')
  await expect(field('Chương trình hoạt động').locator('time')).toHaveAttribute('datetime', '2025-02-03T03:00:00Z')
  await expect(page.getByRole('link', { name: 'Xem lịch sử tài khoản', exact: true })).toHaveAttribute('href', `${base}?subject=${state.entries[0].subject}`)
  await capture(page, info, 'admin-audit-detail')
  await page.getByRole('link', { name: 'Về nhật ký thao tác', exact: true }).click()
  await expect(page).toHaveURL(/\/quan-tri\/nhat-ky\?action=activity_updated$/)
  await expect(page.getByLabel('Loại thao tác', { exact: true })).toHaveValue('activity_updated')
})

test('Nhật ký admin: lỗi tải, thử lại, trạng thái đang tải và nhật ký cũ thiếu ảnh chụp', async ({ page }) => {
  const state = await fixtures(page)
  state.fail = true
  await page.goto(base)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.ad-audit-row')).toHaveCount(0)
  state.fail = false
  let release
  state.hold = new Promise(resolve => { release = resolve })
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(page.locator('.ad-audit-count')).toHaveCount(0)
  release(); state.hold = null
  await expect(page.locator('.ad-audit-row')).toHaveCount(12)
  state.entries[0].before = null; state.entries[0].after = null
  state.failDetail = true
  await page.locator('.ad-audit-row').first().click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failDetail = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Bản ghi này chưa lưu dữ liệu trước–sau.', { exact: false })).toBeVisible()
  await expect(page.locator('.audit-change')).toHaveCount(0)
  await expect(page.locator('.ad-audit-summary')).toContainText('Nhật ký chỉ đọc')
})

test('Nhật ký admin: diễn giải trạng thái lời mời và ngày không hợp lệ không tạo lịch sử giả', async ({ page }) => {
  const state = await fixtures(page)
  Object.assign(state.entries[0], { action: 'invitation_accepted', action_label: 'Chấp nhận lời mời', created_at: null, before: { status: 'pending', source: null, expires_at: null }, after: { status: 'accepted', source: 'invitation', expires_at: 'invalid-date' } })
  await page.goto(`${base}/audit-1`)
  await expect(page.locator('.audit-changes')).toContainText('Chờ phản hồi')
  await expect(page.locator('.audit-changes')).toContainText('Đã chấp nhận')
  await expect(page.locator('.audit-changes')).toContainText('Chấp nhận lời mời')
  await expect(page.locator('.audit-changes')).toContainText('invalid-date')
  await expect(page.locator('.ad-audit-summary-heading')).toContainText('Chưa có thời gian')
  await expect(page.locator('.ad-audit-detail')).not.toContainText('Invalid Date')
})
