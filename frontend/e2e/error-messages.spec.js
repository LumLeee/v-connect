import { test, expect } from '@playwright/test'
import { apiErrorMessage } from '../src/api/errorMessages.js'

test('Lỗi trường và mốc chương trình giữ tên trường, thứ tự và nội dung cụ thể', () => {
  const message = apiErrorMessage(400, { error: { message: 'Dữ liệu gửi lên không hợp lệ.', details: {
    capacity: ['Số lượng phải lớn hơn hoặc bằng 1.'],
    timeline: [{}, { ends_at: ['Thời gian kết thúc phải sau thời gian bắt đầu.'] }],
    organizer: { website: ['Nhập địa chỉ website hợp lệ.'] },
  } } })
  expect(message).toContain('Số lượng người cần tuyển: Số lượng phải lớn hơn hoặc bằng 1.')
  expect(message).toContain('Mốc chương trình · Mục 2 · Thời gian kết thúc: Thời gian kết thúc phải sau thời gian bắt đầu.')
  expect(message).toContain('Hồ sơ Nhà tổ chức · Website: Nhập địa chỉ website hợp lệ.')
  expect(message).not.toContain('[object Object]')
})

test('Lỗi nghiệp vụ giữ nguyên lý do; lỗi hệ thống không lộ thông tin nội bộ', () => {
  expect(apiErrorMessage(400, { error: { details: { detail: 'Hoạt động đã đủ số lượng người được duyệt.' } } }))
    .toBe('Hoạt động đã đủ số lượng người được duyệt.')
  expect(apiErrorMessage(500, { error: { details: { detail: 'SQL password=secret' } } })).not.toContain('secret')
  expect(apiErrorMessage(413)).toContain('Tệp tải lên quá lớn')
})

test('Giao diện hiển thị lý do bị từ chối trong hộp thoại', async ({ page }) => {
  await page.route('**/api/v1/auth/profile/', route => route.fulfill({ json: { profile: { full_name: 'Nhà tổ chức', role: 'organizer' } } }))
  await page.route('**/api/v1/notifications/unread-count/', route => route.fulfill({ json: { count: 0 } }))
  await page.route('**/api/v1/organizer/activities/*/status/', route => route.fulfill({
    status: 400, contentType: 'application/json', body: JSON.stringify({ error: {
      message: 'Dữ liệu gửi lên không hợp lệ.', details: { detail: 'Hoạt động đã đủ số lượng người được duyệt.' },
    } }),
  }))
  await page.route('**/api/v1/auth/csrf/', route => route.fulfill({ json: { csrfToken: 'test' } }))
  await page.route('**/api/v1/auth/me/', route => route.fulfill({ json: { user: { id: 'organizer', role: 'organizer', full_name: 'Nhà tổ chức' } } }))
  await page.route('**/api/v1/organizer/activities/demo/', route => route.fulfill({ json: {
    id: 'demo', title: 'Hoạt động thử', status: 'draft', organizer_name: 'Nhà tổ chức',
    starts_at: '2030-01-01T01:00:00Z', ends_at: '2030-01-01T02:00:00Z', capacity: 10, approved_count: 0, timeline: [],
  } }))
  await page.goto('/nha-to-chuc/hoat-dong/demo')
  await page.getByRole('button', { name: 'Công khai hoạt động', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Hoạt động đã đủ số lượng người được duyệt.')
  await expect(dialog).toBeVisible()
})
