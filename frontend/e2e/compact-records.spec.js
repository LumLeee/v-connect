import { test, expect } from '@playwright/test'

test('Danh sách tài khoản gọn, xem đúng chi tiết và đóng trở lại danh sách', async ({ page }) => {
  await page.route('**/api/v1/auth/me/', route => route.fulfill({ json: { user: { id: 'admin', role: 'admin', full_name: 'Quản trị viên' } } }))
  await page.route('**/api/v1/auth/profile/', route => route.fulfill({ json: { profile: { role: 'admin', full_name: 'Quản trị viên' } } }))
  await page.route('**/api/v1/notifications/unread-count/', route => route.fulfill({ json: { count: 0 } }))
  await page.route('**/api/v1/admin/accounts/?**', route => route.fulfill({ json: { count: 2, results: [
    { id: 'a', full_name: 'Người thứ nhất', email: 'first@example.invalid', role: 'volunteer', is_active: true },
    { id: 'b', full_name: 'Người thứ hai', email: 'second@example.invalid', role: 'organizer', is_active: false },
  ] } }))
  await page.goto('/quan-tri/tai-khoan')
  const row = page.locator('.ad-account-row').filter({ hasText: 'Người thứ hai' })
  await expect(row).toBeVisible()
  await expect(page.getByText('Email hoặc username: second@example.invalid', { exact: true })).toHaveCount(0)
  await row.locator('h2').click()
  const dialog = page.getByRole('dialog', { name: 'Người thứ hai', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('second@example.invalid')
  await expect(dialog).not.toContainText('first@example.invalid')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  const content = 'Nội dung phản hồi đầy đủ cần được xem riêng, không kéo dài dòng danh sách.'
  await page.route('**/api/v1/admin/feedback/?**', route => route.fulfill({ json: { count: 1, results: [
    { id: 'feedback', volunteer_name: 'Người phản hồi', activity_title: 'Hoạt động mẫu', rating: 5,
      content, created_at: '2026-11-01T01:00:00Z', is_hidden: false },
  ] } }))
  await page.goto('/quan-tri/phan-hoi')
  await expect(page.getByText(content, { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
  await expect(page.getByRole('dialog').getByText(content, { exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ẩn phản hồi', exact: true })).toBeVisible()
})
