import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function login(request, identifier, password = process.env.E2E_ATTENDANCE_PASSWORD) {
  expect((await post(request, '/api/v1/auth/login/', { identifier, password })).status()).toBe(200)
}
async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Nhà tổ chức xem và in tổng kết theo điểm; không còn giao diện chứng nhận', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  await login(page.request, process.env.E2E_ATTENDANCE_ORGANIZER)
  const entry = (await (await page.request.get(`/api/v1/organizer/activities/${activity}/contributions/`)).json()).results[0]
  expect((await post(page.request, `/api/v1/organizer/activities/${activity}/contributions/${entry.id}/`, {
    score: 8, revision: entry.contribution?.revision || 0, reason: 'Chấm điểm cho tổng kết',
  })).status()).toBe(200)
  await page.goto(`/bao-cao/hoat-dong/${activity}`)
  await expect(page.getByRole('link', { name: /chứng nhận/i })).toHaveCount(0)
  await page.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true }).click()
  await expect(page.locator('.summary-metrics')).toContainText('8 điểm')
  await expect(page.locator('.summary-sheet')).not.toContainText('Chứng nhận')
  await capture(page, info, 'summary-document')
  await page.evaluate(() => { window.print = () => { window.__printed = true } })
  await page.getByRole('button', { name: 'In / Lưu PDF', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true)
  const pdfDir = path.resolve(process.env.E2E_ARTIFACT_DIR, '../pdfs')
  await mkdir(pdfDir, { recursive: true })
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.od-sidebar')).toBeHidden()
  await page.pdf({ path: path.join(pdfDir, `${info.project.name}-summary.pdf`), preferCSSPageSize: true, printBackground: true })
  await page.emulateMedia({ media: 'screen' })
  const guest = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    expect((await guest.request.get(`/api/v1/reports/activities/${activity}/summary-document/`)).status()).toBe(401)
    expect((await guest.request.get('/api/v1/certificates/')).status()).toBe(404)
    const visitor = await guest.newPage()
    await visitor.goto('/tra-cuu-chung-nhan/00000000-0000-4000-8000-000000000000')
    await expect(visitor.getByRole('heading', { name: 'Trang này chưa có ở đây.', exact: true })).toBeVisible()
  } finally { await guest.close() }
})

test('Admin đọc tổng kết; Tình nguyện viên không có quyền quản lý mẫu', async ({ page }, info) => {
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  await login(page.request, process.env.E2E_ADMIN_USERNAME, process.env.E2E_ADMIN_PASSWORD)
  await page.goto(`/bao-cao/hoat-dong/${activity}/tong-ket`)
  await expect(page.getByRole('heading', { name: 'BÁO CÁO TỔNG KẾT HOẠT ĐỘNG', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /chứng nhận/i })).toHaveCount(0)
  expect((await post(page.request, '/api/v1/auth/logout/', {})).status()).toBe(200)
  await login(page.request, process.env.E2E_ATTENDANCE_VOLUNTEER)
  expect((await page.request.get(`/api/v1/reports/activities/${activity}/summary-document/`)).status()).toBe(403)
  await page.goto('/tinh-nguyen-vien')
  await expect(page.getByRole('link', { name: /chứng nhận/i })).toHaveCount(0)
  await page.goto('/tinh-nguyen-vien/chung-nhan')
  await expect(page.getByRole('heading', { name: 'Trang này chưa có ở đây.', exact: true })).toBeVisible()
})
