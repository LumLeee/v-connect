import { test, expect } from '@playwright/test'

test('Bấm dòng quản lý đơn đăng ký mở đúng chức năng xét duyệt', async ({ page }) => {
  const activity = { id: 'demo', title: 'Hoạt động cần xét duyệt', status: 'published', capacity: 10, approved_count: 2, organizer_name: 'Nhà tổ chức', timeline: [] }
  await page.route('**/api/v1/auth/me/', route => route.fulfill({ json: { user: { id: 'owner', role: 'organizer', full_name: 'Nhà tổ chức' } } }))
  await page.route('**/api/v1/auth/profile/', route => route.fulfill({ json: { profile: { full_name: 'Nhà tổ chức' } } }))
  await page.route('**/api/v1/notifications/unread-count/', route => route.fulfill({ json: { count: 0 } }))
  await page.route('**/api/v1/reports/overview/', route => route.fulfill({ json: { activities: { published: 1 }, metrics: { pending: 1 } } }))
  await page.route('**/api/v1/skills/**', route => route.fulfill({ json: { results: [] } }))
  await page.route('**/api/v1/organizer/activities/?**', route => route.fulfill({ json: { count: 1, results: [activity] } }))
  await page.route('**/api/v1/organizer/activities/demo/', route => route.fulfill({ json: activity }))
  await page.route('**/api/v1/organizer/activities/demo/applicants/?**', route => route.fulfill({ json: { count: 0, results: [] } }))
  await page.goto('/nha-to-chuc/dang-ky')
  const row = page.locator('.om-activity-row')
  await row.locator('.om-capacity').click()
  await expect(page).toHaveURL(/\/nha-to-chuc\/hoat-dong\/demo\/dang-ky$/)
  await page.goto('/nha-to-chuc/dang-ky')
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/nha-to-chuc\/hoat-dong\/demo\/dang-ky$/)
})
