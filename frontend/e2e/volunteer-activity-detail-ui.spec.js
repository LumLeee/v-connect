import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const id = 'volunteer-detail-ui'
const base = `/hoat-dong/${id}`
const defaultActivity = {
  id, title: 'Kết nối số – Cùng người lớn tuổi sử dụng điện thoại',
  organizer_name: 'Nhóm Kết Nối Cộng Đồng', status: 'published',
  description: 'Hỗ trợ thao tác điện thoại và nhận biết dấu hiệu lừa đảo trực tuyến.',
  starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z',
  address: 'Phòng sinh hoạt cộng đồng Sơn Trà, Đà Nẵng', capacity: 12, approved_count: 3,
  skill_details: [{ id: 'technology', name: 'Công nghệ' }, { id: 'communication', name: 'Giao tiếp' }],
  timeline: [{ title: 'Hướng dẫn thao tác', description: '', starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T08:00:00Z' }],
  cover_url: null, time_checks_disabled: false,
}

async function fixtures(page, { role = 'volunteer', status, attendance = null } = {}) {
  const state = {
    activity: { ...defaultActivity }, participation: status ? {
      id: 'detail-entry', status, cancellation_reason: status === 'cancelled' ? 'volunteer' : '',
      activity: { id, status: 'published' }, attendance,
    } : null,
    participationGets: 0, failParticipation: false, failAction: false, writes: 0,
  }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: role ? { id: 'detail-volunteer', full_name: 'Nguyễn An', role, email: 'detail@example.invalid' } : null }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'detail-ui-csrf' }
    else if (url.pathname.endsWith(`/activities/${id}/participation/cancel/`) || (url.pathname.endsWith(`/activities/${id}/participation/`) && request.method() === 'POST')) {
      state.writes++
      if (state.failAction) return route.fulfill({ status: 409, json: { error: { message: 'Thông tin đã thay đổi. Vui lòng thử lại.' } } })
      const cancel = url.pathname.endsWith('/cancel/')
      state.participation = { id: 'detail-entry', status: cancel ? 'cancelled' : 'pending', cancellation_reason: cancel ? 'volunteer' : '', activity: { id, status: state.activity.status }, attendance: null }
      data = state.participation
    } else if (url.pathname.endsWith(`/activities/${id}/participation/`)) {
      state.participationGets++
      if (state.failParticipation) return route.fulfill({ status: 503, json: { error: { message: 'Chưa thể tải đăng ký.' } } })
      data = { participation: state.participation }
    } else if (url.pathname.endsWith(`/activities/${id}/`)) data = state.activity
    else throw new Error(`Unexpected detail UI request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Chi tiết công khai: khách xem thông tin gọn và đăng nhập, không gọi API đăng ký', async ({ page }) => {
  const state = await fixtures(page, { role: null })
  await page.goto(base)
  const detail = page.locator('.va-detail')
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText(defaultActivity.title)
  await expect(detail.getByText(defaultActivity.organizer_name, { exact: true })).toHaveCount(1)
  await expect(detail.locator('.activity-logistics')).toContainText('Đã duyệt3 ngườiCần tuyển12 ngườiCòn lại9 chỗ')
  await expect(detail.locator('.activity-logistics')).not.toContainText('3/12')
  await expect(detail.locator('.activity-logistics')).not.toContainText('UTC+7')
  await expect(detail.getByText('Công nghệ', { exact: true })).toBeVisible()
  await expect(detail.getByText('Nhà tổ chức xét duyệt từng đơn; kỹ năng không tự động giới hạn quyền đăng ký.', { exact: true })).toBeVisible()
  await expect(detail.locator('.va-participation').getByRole('link', { name: 'Đăng nhập', exact: true })).toHaveAttribute('href', '/dang-nhap')
  expect(state.participationGets).toBe(0)
})

test('Chi tiết hoạt động: đăng ký lỗi có thể thử lại, chuyển chờ duyệt và có một hành động chính', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(base)
  const panel = page.locator('.va-participation')
  await expect(panel).toContainText('họ tên, email và số điện thoại')
  state.failAction = true
  await panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click()
  await expect(panel.getByRole('alert')).toBeVisible()
  state.failAction = false
  await panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click()
  await expect(panel.locator('.va-participation-status')).toHaveText('Trạng thái: Chờ duyệt')
  await expect(panel.locator('.va-participation-actions .primary')).toHaveCount(1)
  await expect(panel.getByRole('link', { name: 'Xem các đăng ký của tôi', exact: true })).toHaveCount(1)
  expect(state.writes).toBe(2)
})

test('Chi tiết hoạt động: hủy chờ duyệt cần xác nhận và xử lý lỗi trong hộp thoại', async ({ page }) => {
  const state = await fixtures(page, { status: 'pending' })
  await page.goto(base)
  const panel = page.locator('.va-participation')
  await panel.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Xác nhận hủy đăng ký', exact: true })
  await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.writes).toBe(0)
  await panel.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
  state.failAction = true
  await dialog.getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(dialog.getByRole('alert')).toBeVisible()
  state.failAction = false
  await dialog.getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(panel.locator('.va-participation-status')).toHaveText('Trạng thái: Đã hủy đăng ký')
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toBeEnabled()
})

test('Chi tiết hoạt động: được duyệt chỉ hiện check-in khi trong giờ hoặc chính sách thử nghiệm', async ({ page }) => {
  const state = await fixtures(page, { status: 'approved' })
  await page.goto(base)
  const panel = page.locator('.va-participation')
  await expect(panel).toContainText('Điểm danh mở khi hoạt động bắt đầu.')
  await expect(panel.getByRole('link', { name: 'Check-in bằng QR hoặc mã', exact: true })).toHaveCount(0)
  state.activity.starts_at = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  state.activity.ends_at = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel.getByRole('link', { name: 'Check-in bằng QR hoặc mã', exact: true })).toHaveAttribute('href', `${base}/check-in`)
  await expect(panel.getByRole('button', { name: 'Hủy đăng ký', exact: true })).toHaveCount(0)
  state.activity.ends_at = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel).toContainText('Đã hết thời gian điểm danh.')
  await expect(panel.getByRole('link', { name: 'Check-in bằng QR hoặc mã', exact: true })).toHaveCount(0)
  state.activity.time_checks_disabled = true
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel.getByRole('link', { name: 'Check-in bằng QR hoặc mã', exact: true })).toBeVisible()
})

test('Chi tiết hoạt động: đã có mặt không thể hủy và chuyển phản hồi sau hoàn thành', async ({ page }) => {
  const state = await fixtures(page, { status: 'approved', attendance: { confirmed_at: '2026-11-05T07:30:00Z', confirmed_by_name: 'Nhóm Kết Nối', method: 'manual' } })
  await page.goto(base)
  const panel = page.locator('.va-participation')
  await expect(panel).toContainText('Đã xác nhận có mặt')
  await expect(panel).toContainText('Thời điểm:')
  await expect(panel.getByRole('button', { name: 'Hủy đăng ký', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('link', { name: 'Xem lịch sử hoạt động', exact: true })).toHaveAttribute('href', '/tinh-nguyen-vien/lich-su')
  state.activity.status = 'completed'; state.participation.activity.status = 'completed'
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel.getByRole('link', { name: 'Gửi hoặc xem phản hồi của tôi', exact: true })).toHaveAttribute('href', `${base}/phan-hoi`)
  await expect(panel.locator('.va-participation-actions .primary')).toHaveCount(1)
})

test('Chi tiết hoạt động: đủ người, bị từ chối và đã đóng giữ đúng quyền đăng ký', async ({ page }) => {
  const state = await fixtures(page)
  state.activity.approved_count = 12
  await page.goto(base)
  const panel = page.locator('.va-participation')
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toBeDisabled()
  await expect(panel).toContainText('Hoạt động đã đủ số lượng người được duyệt.')
  await expect(page.locator('.va-detail-capacity')).toContainText('Còn lại0 chỗ')
  state.participation = { status: 'rejected', activity: { id, status: 'published' }, attendance: null }
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel).toContainText('Đơn đã bị từ chối; bạn không thể đăng ký lại hoạt động này.')
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toHaveCount(0)
  state.participation = null; state.activity.status = 'completed'
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel).toContainText('Đã đóng đăng ký, hủy đăng ký và xét duyệt.')
  await expect(panel.getByRole('link', { name: 'Khám phá hoạt động khác', exact: true })).toHaveAttribute('href', '/hoat-dong')
  expect(state.writes).toBe(0)
})

test('Chi tiết hoạt động: lỗi tải trạng thái có thử lại, không lộ nút đăng ký khi chưa có dữ liệu', async ({ page }) => {
  const state = await fixtures(page)
  state.failParticipation = true
  await page.goto(base)
  const panel = page.locator('.va-participation')
  await expect(panel.getByRole('alert')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toHaveCount(0)
  state.failParticipation = false
  await panel.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toBeEnabled()
})

test('Nhà tổ chức bị khóa: ngừng nhận đăng ký nhưng vẫn cho hủy đơn hiện tại', async ({ page }) => {
  const state = await fixtures(page)
  state.activity.organizer_active = false
  await page.goto(base)
  const panel = page.locator('.va-participation')
  await expect(panel).toContainText('Tạm ngừng nhận đăng ký vì tài khoản nhà tổ chức không còn hoạt động.')
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('link', { name: 'Khám phá hoạt động khác', exact: true })).toBeVisible()
  state.participation = { status: 'pending', attendance: null }
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await panel.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
  await expect(panel.locator('.va-participation-status')).toHaveText('Trạng thái: Đã hủy đăng ký')
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toHaveCount(0)
  state.activity.organizer_active = true
  await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toBeEnabled()
  expect(state.writes).toBe(1)
})

test('Chi tiết hoạt động: hành động trước thông tin dài trên mobile, không tràn 320/390/768/1440px', async ({ page }, info) => {
  await fixtures(page, { status: 'pending' })
  await page.goto(base)
  await expect(page.locator('.va-participation-actions .primary')).toBeVisible()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `width ${width}`).toBe(true)
    if (width <= 768) {
      const action = await page.locator('.va-participation-actions').boundingBox()
      const logistics = await page.locator('.activity-logistics').boundingBox()
      const description = await page.locator('.va-detail-content').boundingBox()
      expect(action.y).toBeLessThan(logistics.y)
      expect(logistics.y).toBeLessThan(description.y)
    }
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage2-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-volunteer-detail.png`), fullPage: true })
})

test('Chi tiết hoạt động: tài khoản nhà tổ chức chỉ xem, không gọi API đăng ký', async ({ page }) => {
  const state = await fixtures(page, { role: 'organizer' })
  await page.goto(base)
  await expect(page.getByText('Đăng ký tham gia dành cho tài khoản Tình nguyện viên.', { exact: true })).toBeVisible()
  await expect(page.locator('.va-participation .primary')).toHaveCount(0)
  expect(state.participationGets).toBe(0)
})
