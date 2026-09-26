import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const password = 'River-Community-493!'
const vietnamInput = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T')

async function register(page, role, email) {
  await page.goto('/dang-ky')
  await page.getByLabel('Họ và tên', { exact: true }).fill(role === 'organizer' ? 'Tổ chức xuyên suốt' : 'Tình nguyện viên xuyên suốt')
  await page.getByRole('radio', { name: role === 'organizer' ? 'Nhà tổ chức' : 'Tình nguyện viên', exact: true }).check()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page).toHaveURL(role === 'organizer' ? /\/nha-to-chuc$/ : /\/tinh-nguyen-vien$/)
  await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ', exact: true }).click()
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678')
  if (role === 'organizer') await page.getByLabel('Tên tổ chức', { exact: true }).fill('Nhóm Xanh Xuyên Suốt')
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
}

async function setTime(page, instant) {
  await page.context().setExtraHTTPHeaders({ 'X-E2E-Time': new Date(instant).toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY })
  await page.clock.setFixedTime(new Date(instant))
}

test('Toàn bộ luồng chính qua giao diện với Guest, Volunteer, Organizer và Admin', async ({ page, browser }, info) => {
  test.setTimeout(120_000)
  page.on('pageerror', error => { throw error })
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })))
  try {
    const [volunteer, guest, admin] = await Promise.all(contexts.map(context => context.newPage()))
    for (const target of [volunteer, guest, admin]) target.on('pageerror', error => { throw error })
    const volunteerEmail = `flow.volunteer.${randomUUID()}@example.invalid`
    await register(page, 'organizer', `flow.organizer.${randomUUID()}@example.invalid`)
    const title = `Luồng cộng đồng ${randomUUID()}`
    const start = Math.floor(Date.now() / 60000) * 60000 + 3600000
    const end = start + 3600000
    await page.goto('/nha-to-chuc/hoat-dong/tao')
    await page.getByLabel('Tên hoạt động', { exact: true }).fill(title)
    await page.getByLabel('Mô tả hoạt động', { exact: true }).fill('Cùng chăm sóc cây xanh tại công viên.')
    await page.getByLabel('Địa chỉ hoạt động', { exact: true }).fill('Công viên Huế')
    await page.getByLabel('Thời gian bắt đầu', { exact: true }).fill(vietnamInput(start))
    await page.getByLabel('Thời gian kết thúc', { exact: true }).fill(vietnamInput(end))
    await page.getByLabel('Số lượng người cần tuyển', { exact: true }).fill('1')
    await page.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const id = new URL(page.url()).pathname.split('/').at(-1)
    await page.getByRole('button', { name: 'Công khai hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Hoàn thành hoạt động', exact: true })).toBeDisabled()
    await guest.goto(`/hoat-dong/${id}`)
    await expect(guest.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(guest.getByText('bằng tài khoản Tình nguyện viên để đăng ký tham gia.', { exact: false })).toBeVisible()
    await register(volunteer, 'volunteer', volunteerEmail)
    await volunteer.goto(`/hoat-dong/${id}`)
    await volunteer.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click()
    await expect(volunteer.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Chờ duyệt')
    await page.getByRole('link', { name: 'Xem danh sách đăng ký', exact: true }).click()
    await page.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận xét duyệt', exact: true }).click()
    await expect(page.getByText('Đã cập nhật kết quả xét duyệt.', { exact: true })).toBeVisible()
    await volunteer.reload()
    await expect(volunteer.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Được duyệt')

    await setTime(page, start + 60000)
    await setTime(volunteer, start + 60000)
    await page.goto(`/nha-to-chuc/hoat-dong/${id}/diem-danh`)
    await page.getByRole('button', { name: 'Ghi nhận có mặt', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận có mặt', exact: true }).click()
    await expect(page.getByText('Đã xác nhận có mặt', { exact: true })).toBeVisible()
    await volunteer.goto('/tinh-nguyen-vien/lich-su')
    await expect(volunteer.getByText('Đã xác nhận có mặt', { exact: true })).toBeVisible()

    await setTime(page, end + 60000)
    await setTime(volunteer, end + 60000)
    await page.goto(`/nha-to-chuc/hoat-dong/${id}`)
    await page.getByRole('button', { name: 'Hoàn thành hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.locator('.activity-status')).toHaveText('Hoàn thành')
    await volunteer.reload()
    await volunteer.getByRole('link', { name: 'Gửi hoặc xem phản hồi của tôi', exact: true }).click()
    await volunteer.getByLabel('Điểm đánh giá (1–5)', { exact: true }).fill('5')
    const feedback = `Hoạt động thiết thực ${info.project.name} ${id}`
    await volunteer.getByLabel('Nội dung phản hồi', { exact: true }).fill(feedback)
    await volunteer.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
    await expect(volunteer.getByText('Bạn đã gửi phản hồi cho hoạt động này.', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Xem kết quả hoạt động', exact: true }).click()
    await expect(page.getByText('1 phản hồi hợp lệ. Điểm trung bình: 5/5. Phản hồi bị ẩn không được tính.', { exact: true })).toBeVisible()
    await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: 'Đã tham gia (hoàn thành)', exact: true }) }).locator('.lead')).toHaveText('1')

    await admin.goto('/dang-nhap')
    await admin.getByLabel('Email hoặc username Admin', { exact: true }).fill(process.env.E2E_ADMIN_USERNAME)
    await admin.getByLabel('Mật khẩu', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD)
    await admin.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await admin.getByRole('link', { name: 'Quản lý phản hồi', exact: true }).click()
    await admin.locator('article').filter({ hasText: feedback }).getByRole('button', { name: 'Ẩn phản hồi', exact: true }).click()
    await admin.getByLabel('Lý do ẩn phản hồi', { exact: true }).fill('Kiểm tra quy trình xử lý phản hồi.')
    await admin.getByRole('button', { name: 'Xác nhận ẩn phản hồi', exact: true }).click()
    await expect(admin.getByText('Đã ẩn phản hồi và lưu thông tin xử lý.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('0 phản hồi hợp lệ. Điểm trung bình: Chưa có đánh giá. Phản hồi bị ẩn không được tính.', { exact: true })).toBeVisible()
    await volunteer.goto('/bao-cao')
    await expect(volunteer.locator('article').filter({ has: volunteer.getByRole('heading', { name: 'Đã tham gia (hoàn thành)', exact: true }) }).locator('.lead')).toHaveText('1')
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-core-flow-result.png`), fullPage: true })
  } finally { for (const context of contexts) await context.close() }
})

test('Mất kết nối có thể thử lại; thay bộ lọc không giữ dữ liệu cũ khi đang tải', async ({ page }) => {
  await page.route('**/api/v1/activities/?**', route => route.abort())
  await page.goto('/hoat-dong')
  await expect(page.getByText('Không kết nối được máy chủ. Vui lòng thử lại.', { exact: true })).toBeVisible()
  await page.unroute('**/api/v1/activities/?**')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.activity-card').first()).toBeVisible()
  let release
  const gate = new Promise(resolve => { release = resolve })
  const term = `empty-${randomUUID()}`
  await page.route(`**/api/v1/activities/?*search=${term}*`, async route => { await gate; await route.continue() })
  try {
    await page.getByLabel('Tìm theo tên hoạt động', { exact: true }).fill(term)
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
    await expect(page.getByText('Đang tải dữ liệu…', { exact: true })).toBeVisible()
    await expect(page.locator('.activity-card')).toHaveCount(0)
  } finally { release() }
  await expect(page.getByText('Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.', { exact: true })).toBeVisible()
})
