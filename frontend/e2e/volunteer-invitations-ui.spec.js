import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/tinh-nguyen-vien/loi-moi'
const longMessage = 'Mời bạn cùng đồng hành và hỗ trợ người lớn tuổi sử dụng điện thoại. '.repeat(8).trim()

async function fixtures(page) {
  const state = { failList: false, failResponse: false, posts: 0, gets: 0, items: Array.from({ length: 16 }, (_, index) => ({
    id: `volunteer-invite-${index}`, status: index < 13 ? 'pending' : ['accepted', 'declined', 'withdrawn'][index - 13],
    activity: { id: `vi-activity-${index}`, title: index < 14 ? `Ngày xanh ${index + 1}` : `Chia sẻ ${index + 1}`,
      starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z', address: 'Đà Nẵng' },
    organizer_name: index < 14 ? 'Nhóm kết nối' : 'Nhóm Sẻ Chia', message: index === 0 ? longMessage : 'Cùng chung tay vì cộng đồng.',
    created_at: '2026-11-01T07:00:00Z', responded_at: index < 13 ? null : '2026-11-02T07:00:00Z',
    unavailable_reason: index === 0 ? 'Hoạt động đã đủ người.' : '', activity_changed: index === 1,
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'volunteer-invitations-ui', full_name: 'Nguyễn An', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'volunteer-invitations-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/respond/')) {
      state.posts++
      if (state.failResponse) return route.fulfill({ status: 409, json: { error: { message: 'Vui lòng kiểm tra lời mời rồi thử lại.' } } })
      const item = state.items.find(entry => url.pathname.includes(`/${entry.id}/`))
      item.status = request.postDataJSON().status; item.responded_at = '2026-11-05T08:00:00Z'; data = item
    } else if (url.pathname.endsWith('/invitations/')) {
      state.gets++
      if (state.failList) return route.abort()
      const search = (url.searchParams.get('search') || '').toLowerCase()
      const searched = state.items.filter(item => `${item.activity.title} ${item.organizer_name}`.toLowerCase().includes(search))
      const summary = { total: searched.length, ...Object.fromEntries(['pending', 'accepted', 'declined', 'withdrawn'].map(status => [status, searched.filter(item => item.status === status).length])) }
      const status = url.searchParams.get('status') || 'all'
      const filtered = searched.filter(item => status === 'all' || item.status === status)
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      data = { count: filtered.length, summary, results: filtered.slice(offset, offset + 12), next: filtered.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else if (/\/activities\/vi-activity-\d+\/$/.test(url.pathname)) return route.fulfill({ status: 404, json: { detail: 'Không tìm thấy hoạt động.' } })
    else throw new Error(`Unexpected volunteer invitations UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Lời mời tình nguyện viên: tìm/lọc, số đếm và phản hồi mục cuối giữ đúng bộ lọc', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(base)
  const filters = page.getByRole('group', { name: 'Lọc trạng thái lời mời' })
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('16')
  await expect(filters.getByRole('button', { name: /^Chờ phản hồi/ })).toContainText('13')
  await expect(page.locator('.invitation-row')).toHaveCount(12)
  await filters.getByRole('button', { name: /^Chờ phản hồi/ }).click()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.invitation-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Từ chối lời mời', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Xác nhận xử lý lời mời' })
  await expect(confirm).toContainText('Ngày xanh 13')
  await confirm.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.posts).toBe(0)
  await page.getByRole('button', { name: 'Từ chối lời mời', exact: true }).click()
  state.failResponse = true
  await confirm.getByRole('button', { name: 'Xác nhận từ chối', exact: true }).click()
  await expect(confirm.getByRole('alert')).toBeVisible()
  state.failResponse = false
  await confirm.getByRole('button', { name: 'Xác nhận từ chối', exact: true }).click()
  await expect(confirm).toHaveCount(0)
  await expect(page).toHaveURL(/status=pending.*page=1/)
  await expect(page.locator('.invitation-row')).toHaveCount(12)
  await expect(filters.getByRole('button', { name: /^Chờ phản hồi/ })).toContainText('12')
  await expect(filters.getByRole('button', { name: /^Đã từ chối/ })).toContainText('2')
  await page.getByLabel('Tìm hoạt động hoặc nhà tổ chức', { exact: true }).fill('  kết nối  ')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await filters.getByRole('button', { name: /^Đã chấp nhận/ }).click()
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('14')
  await expect(page.locator('.invitation-row h2')).toHaveText(['Ngày xanh 14'])
  await page.evaluate(() => history.back())
  await expect(filters.getByRole('button', { name: /^Chờ phản hồi/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Tìm hoạt động hoặc nhà tổ chức', { exact: true })).toHaveValue('kết nối')
  const previousGets = state.gets
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets).toBeGreaterThan(previousGets)
  await expect(page).toHaveURL(/search=/)
})

test('Lời mời tình nguyện viên: lời nhắn thu gọn, không thể nhận và nhấn dòng mở hoạt động', async ({ page }, info) => {
  await fixtures(page)
  await page.goto(base)
  const first = page.locator('.invitation-row').first()
  await expect(first.getByRole('button', { name: 'Chấp nhận lời mời', exact: true })).toBeDisabled()
  await expect(first.getByRole('button', { name: 'Từ chối lời mời', exact: true })).toBeEnabled()
  await expect(first).toContainText('Không thể chấp nhận: Hoạt động đã đủ người.')
  await expect(first.getByText(longMessage, { exact: true })).not.toBeVisible()
  await first.getByText('Đọc lời nhắn', { exact: true }).click()
  await expect(first.getByText(longMessage, { exact: true })).toBeVisible()
  await expect(page).toHaveURL(base)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `width ${width}`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage1-preview', { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage1-preview', `${info.project.name}-volunteer-invitations.png`), fullPage: true })
  await first.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/hoat-dong\/vi-activity-0$/)
})

test('Lời mời tình nguyện viên: tải lỗi có thể thử lại và xóa tìm kiếm trống', async ({ page }) => {
  const state = await fixtures(page)
  state.failList = true
  await page.goto(base)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.invitation-row')).toHaveCount(12)
  await page.getByLabel('Tìm hoạt động hoặc nhà tổ chức', { exact: true }).fill('Không tồn tại')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.getByText('Không có lời mời phù hợp với bộ lọc.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click()
  await expect(page.locator('.invitation-row')).toHaveCount(12)
})
