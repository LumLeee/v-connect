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
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${name} ${width}`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Cấp, in, tra cứu, tự thu hồi khi đổi giờ và cấp lại chứng nhận', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  await login(page.request, process.env.E2E_ATTENDANCE_ORGANIZER)
  const entries = await (await page.request.get(`/api/v1/organizer/activities/${activity}/contributions/`)).json()
  const entry = entries.results[0]
  expect((await post(page.request, `/api/v1/organizer/activities/${activity}/contributions/${entry.id}/`, { minutes: 90, revision: entry.contribution?.revision || 0, reason: 'Xác nhận kiểm thử' })).status()).toBe(200)
  await page.goto(`/bao-cao/hoat-dong/${activity}/chung-nhan`)
  await page.getByRole('button', { name: 'Cấp chứng nhận', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận cấp chứng nhận', exact: true }).click()
  await expect(page.getByText('Đã cấp chứng nhận.', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Xem chứng nhận đang hiệu lực', exact: true }).click()
  await expect(page.getByRole('img', { name: 'QR tra cứu chứng nhận' })).toBeVisible()
  await expect(page.locator('.certificate-hours')).toContainText('1 giờ 30 phút')
  const id = new URL(page.url()).pathname.split('/').at(-1)
  await capture(page, info, 'certificate')
  await page.evaluate(() => { window.print = () => { window.__printed = true } })
  await page.getByRole('button', { name: 'In / Lưu PDF', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true)
  const pdfDir = path.resolve(process.env.E2E_ARTIFACT_DIR, '../pdfs')
  await mkdir(pdfDir, { recursive: true })
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.od-sidebar')).toBeHidden()
  await page.pdf({ path: path.join(pdfDir, `${info.project.name}-certificate.pdf`), preferCSSPageSize: true, printBackground: true })
  await page.emulateMedia({ media: 'screen' })
  const guestContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  const volunteerContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    const guest = await guestContext.newPage()
    await guest.goto(`/tra-cuu-chung-nhan/${id}`)
    await expect(guest.getByRole('heading', { name: 'Chứng nhận còn hiệu lực', exact: true })).toBeVisible()
    const verification = await (await guest.request.get(`/api/v1/certificates/${id}/verify/`)).json()
    expect(Object.keys(verification).sort()).toEqual(['id', 'volunteer_name', 'activity_title', 'organization_name', 'minutes', 'issued_at', 'status', 'revoked_at'].sort())
    expect((await guest.request.get(`/api/v1/certificates/${id}/`)).status()).toBe(401)
    await capture(guest, info, 'certificate-verification')
    await login(volunteerContext.request, process.env.E2E_ATTENDANCE_VOLUNTEER)
    const volunteer = await volunteerContext.newPage()
    await volunteer.goto('/tinh-nguyen-vien/chung-nhan')
    await expect(volunteer.getByRole('heading', { name: 'Chứng nhận của tôi', exact: true })).toBeVisible()
    await expect(volunteer.locator(`a[href="/chung-nhan/${id}"]`)).toBeVisible()
    await volunteer.goto(`/chung-nhan/${id}`)
    await expect(volunteer.getByRole('button', { name: 'Thu hồi chứng nhận', exact: true })).toHaveCount(0)
    await page.goto(`/bao-cao/hoat-dong/${activity}/tong-ket`)
    await expect(page.locator('.summary-metrics')).toContainText('1 giờ 30 phút')
    await capture(page, info, 'summary-document')
    await page.emulateMedia({ media: 'print' })
    await page.pdf({ path: path.join(pdfDir, `${info.project.name}-summary.pdf`), preferCSSPageSize: true, printBackground: true })
    await page.emulateMedia({ media: 'screen' })
    const current = (await (await page.request.get(`/api/v1/organizer/activities/${activity}/contributions/`)).json()).results[0]
    expect((await post(page.request, `/api/v1/organizer/activities/${activity}/contributions/${entry.id}/`, { minutes: 60, revision: current.contribution.revision, reason: 'Điều chỉnh thời gian thực tế' })).status()).toBe(200)
    await guest.getByRole('button', { name: 'Kiểm tra lại hiệu lực' }).click()
    await expect(guest.getByRole('heading', { name: 'Chứng nhận đã bị thu hồi', exact: true })).toBeVisible()
    await volunteer.reload()
    await expect(volunteer.getByRole('button', { name: 'In / Lưu PDF', exact: true })).toBeDisabled()
    expect((await post(page.request, `/api/v1/reports/activities/${activity}/certificates/`, { attendance: entry.id })).status()).toBe(201)
    const list = await (await page.request.get(`/api/v1/certificates/?activity=${activity}&status=valid`)).json()
    const replacement = list.results[0]
    expect(replacement.id).not.toBe(id)
    expect(replacement.minutes).toBe(60)
    await page.goto(`/chung-nhan/${replacement.id}`)
    await page.getByRole('button', { name: 'Thu hồi chứng nhận', exact: true }).click()
    await page.getByLabel('Lý do thu hồi', { exact: true }).fill('Thu hồi để đối chiếu lại thông tin')
    await page.getByRole('button', { name: 'Xác nhận thu hồi', exact: true }).click()
    await expect(page.getByRole('button', { name: 'In / Lưu PDF', exact: true })).toBeDisabled()
    await guest.goto('/tra-cuu-chung-nhan/00000000-0000-4000-8000-000000000000')
    await expect(guest.getByRole('alert')).toContainText('Không tìm thấy chứng nhận')
  } finally { await guestContext.close(); await volunteerContext.close() }
})

test('Admin cấp và thu hồi; danh sách xử lý lỗi mạng', async ({ page, browser }, info) => {
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  const owner = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await login(owner.request, process.env.E2E_ATTENDANCE_ORGANIZER)
    const entry = (await (await owner.request.get(`/api/v1/organizer/activities/${activity}/contributions/`)).json()).results[0]
    expect((await post(owner.request, `/api/v1/organizer/activities/${activity}/contributions/${entry.id}/`, { minutes: 60, revision: entry.contribution?.revision || 0, reason: 'Đối chiếu kiểm thử quản trị' })).status()).toBe(200)
  } finally { await owner.close() }
  await login(page.request, process.env.E2E_ADMIN_USERNAME, process.env.E2E_ADMIN_PASSWORD)
  const candidates = await (await page.request.get(`/api/v1/reports/activities/${activity}/certificate-candidates/`)).json()
  const response = await post(page.request, `/api/v1/reports/activities/${activity}/certificates/`, { attendance: candidates.results[0].id })
  expect([200, 201]).toContain(response.status())
  const certificate = await response.json()
  expect((await post(page.request, `/api/v1/certificates/${certificate.id}/revoke/`, { reason: 'Admin đối chiếu' })).status()).toBe(200)
  await page.route('**/api/v1/certificates/?*', route => route.abort())
  await page.goto('/bao-cao/chung-nhan')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await page.unroute('**/api/v1/certificates/?*')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.activity-card').first()).toBeVisible()
})
