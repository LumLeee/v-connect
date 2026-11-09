import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const activity = { id: 'invitation-ui-activity', title: 'Kết nối cộng đồng', status: 'published', capacity: 20, approved_count: 2,
  starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z', address: 'Đà Nẵng', organizer_name: 'Nhóm cộng đồng' }
const base = `/nha-to-chuc/hoat-dong/${activity.id}/loi-moi`
const longMessage = 'Mời bạn cùng hỗ trợ người lớn tuổi sử dụng điện thoại. '.repeat(8)

async function fixtures(page, role = 'organizer') {
  const state = { failList: false, failWithdraw: false, posts: 0, activityGets: 0, items: Array.from({ length: 16 }, (_, i) => ({
    id: `invite-${i}`, activity, volunteer_name: i < 14 ? `An ${i + 1}` : `Linh ${i + 1}`, organizer_name: activity.organizer_name,
    status: i < 13 ? 'pending' : ['accepted', 'declined', 'withdrawn'][i - 13], message: i === 0 ? longMessage : 'Mời bạn đồng hành cùng chương trình.',
    created_at: '2026-11-01T07:00:00Z', responded_at: i < 13 ? null : '2026-11-02T07:00:00Z', unavailable_reason: '', activity_changed: i === 1,
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: `invitations-ui-${role}`, full_name: 'Người kiểm tra', email: 'ui@example.invalid', role } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'invitation-ui-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith(`/activities/${activity.id}/`)) { state.activityGets++; data = activity }
    else if (url.pathname.endsWith('/withdraw/')) {
      state.posts++
      if (state.failWithdraw) return route.fulfill({ status: 409, json: { error: { message: 'Vui lòng kiểm tra lời mời rồi thử lại.' } } })
      const item = state.items.find(entry => url.pathname.includes(`/${entry.id}/`))
      item.status = 'withdrawn'; item.responded_at = '2026-11-05T08:00:00Z'; data = item
    } else if (url.pathname.endsWith('/invitations/')) {
      if (state.failList) return route.abort()
      const term = (url.searchParams.get('search') || '').toLowerCase()
      const searched = state.items.filter(item => item.volunteer_name.toLowerCase().includes(term))
      const summary = { total: searched.length, ...Object.fromEntries(['pending', 'accepted', 'declined', 'withdrawn'].map(status => [status, searched.filter(item => item.status === status).length])) }
      const status = url.searchParams.get('status') || 'all'
      const filtered = searched.filter(item => status === 'all' || item.status === status)
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      data = { count: filtered.length, results: filtered.slice(offset, offset + 12), next: filtered.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null, ...(role === 'organizer' ? { summary } : {}) }
    } else throw new Error(`Unexpected invitations UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Lời mời nhà tổ chức: dòng ngang, tìm/lọc và thu hồi mục cuối vẫn giữ đúng số đếm', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto(base)
  const filters = page.getByRole('group', { name: 'Lọc trạng thái lời mời' })
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('16')
  await expect(filters.getByRole('button', { name: /^Chờ phản hồi/ })).toContainText('13')
  await expect(page.locator('.managed-invitation-row')).toHaveCount(12)
  await expect(page.locator('.managed-invitation-row').getByRole('heading', { name: activity.title })).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const first = page.locator('.managed-invitation-row').first()
  await first.focus(); await page.keyboard.press('Enter')
  const details = page.getByRole('dialog', { name: 'Lời mời gửi tới An 1', exact: true })
  await expect(details).toContainText(longMessage.trim())
  await details.getByRole('button', { name: 'Đóng', exact: true }).click()
  await filters.getByRole('button', { name: /^Chờ phản hồi/ }).click()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.managed-invitation-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Thu hồi lời mời', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Xác nhận xử lý lời mời' })
  await expect(confirm).toContainText('An 13')
  await confirm.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.posts).toBe(0)
  await page.getByRole('button', { name: 'Thu hồi lời mời', exact: true }).click()
  state.failWithdraw = true
  await confirm.getByRole('button', { name: 'Xác nhận thu hồi', exact: true }).click()
  await expect(confirm.getByRole('alert')).toBeVisible()
  state.failWithdraw = false
  await confirm.getByRole('button', { name: 'Xác nhận thu hồi', exact: true }).click()
  await expect(page).toHaveURL(/status=pending.*page=1/)
  await expect(page.locator('.managed-invitation-row')).toHaveCount(12)
  await expect(filters.getByRole('button', { name: /^Chờ phản hồi/ })).toContainText('12')
  await expect(filters.getByRole('button', { name: /^Đã thu hồi/ })).toContainText('2')
  await page.getByLabel('Tìm người nhận', { exact: true }).fill('  An  ')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await filters.getByRole('button', { name: /^Đã chấp nhận/ }).click()
  await expect(filters.getByRole('button', { name: /^Tất cả/ })).toContainText('14')
  await expect(page.locator('.managed-invitation-row h2')).toHaveText(['An 14'])
  await page.evaluate(() => history.back())
  await expect(filters.getByRole('button', { name: /^Chờ phản hồi/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Tìm người nhận', { exact: true })).toHaveValue('An')
  const previousGets = state.activityGets
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.activityGets).toBeGreaterThan(previousGets)
  await page.getByLabel('Tìm người nhận', { exact: true }).fill('Không tồn tại')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.getByText('Không có lời mời phù hợp với bộ lọc.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click()
  await expect(page.locator('.managed-invitation-row')).toHaveCount(12)
  await mkdir(process.env.E2E_ARTIFACT_DIR || '../tmp/stage3-invitation-preview', { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR || '../tmp/stage3-invitation-preview', `${info.project.name}-invitations.png`), fullPage: true })
})

test('Lời mời: thử lại lỗi tải và giữ giao diện tình nguyện viên', async ({ page }) => {
  const state = await fixtures(page)
  state.failList = true
  await page.goto(base)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failList = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.managed-invitation-row')).toHaveCount(12)
  await page.unroute('**/api/v1/**')
  const volunteer = await fixtures(page, 'volunteer')
  volunteer.items = [volunteer.items[0]]
  await page.goto('/tinh-nguyen-vien/loi-moi')
  await expect(page.getByRole('heading', { name: 'Lời mời của tôi', exact: true })).toBeVisible()
  await expect(page.locator('.invitation-row')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Chấp nhận lời mời', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Từ chối lời mời', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Lọc trạng thái lời mời' })).toBeVisible()
})
