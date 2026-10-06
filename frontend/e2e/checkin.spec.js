import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data = {}) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function account(request, role) {
  expect((await post(request, '/api/v1/auth/register/', { email: `qr.${randomUUID()}@example.invalid`, role,
    full_name: role === 'organizer' ? 'Nhà tổ chức QR' : 'Tình nguyện viên QR',
    password: 'River-Community-493!', password_confirm: 'River-Community-493!' })).status()).toBe(201)
}
async function setTime(page, instant) {
  await page.context().setExtraHTTPHeaders({ 'X-E2E-Time': new Date(instant).toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY })
  await page.clock.setFixedTime(new Date(instant))
}
async function setup(page, context) {
  await account(page.request, 'organizer')
  await account(context.request, 'volunteer')
  const start = Date.now() + 3600000
  const response = await post(page.request, '/api/v1/organizer/activities/', { title: 'Ngày hội QR', description: 'Cùng tham gia',
    address: 'Huế', capacity: 10, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 7200000).toISOString() })
  expect(response.status()).toBe(201)
  const activity = await response.json()
  await post(page.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' })
  const registration = await (await post(context.request, `/api/v1/activities/${activity.id}/participation/`)).json()
  expect((await post(page.request, `/api/v1/organizer/activities/${activity.id}/applicants/${registration.participation.id}/review/`, { status: 'approved' })).status()).toBe(200)
  return { id: activity.id, start, entryId: registration.participation.id }
}

test('Tạo, thay thế, thu hồi QR; đọc QR thật từ ảnh và check-in một lần', async ({ page, browser }, info) => {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    const { id, start, entryId } = await setup(page, context)
    const volunteer = await context.newPage()
    for (const target of [page, volunteer]) {
      target.on('pageerror', error => { throw error })
      await setTime(target, start + 60000)
    }
    await page.goto(`/nha-to-chuc/hoat-dong/${id}/diem-danh`)
    await page.getByRole('button', { name: 'Tạo mã mới', exact: true }).click()
    const image = page.getByAltText('QR check-in hoạt động')
    await expect(image).toBeVisible()
    const oldCode = await page.getByTestId('attendance-code').innerText()
    await page.getByRole('button', { name: 'Tạo mã mới', exact: true }).click()
    await expect(page.getByTestId('attendance-code')).not.toHaveText(oldCode)
    await expect(image).toBeVisible()
    const qrImage = await image.getAttribute('src')
    await volunteer.goto(`/hoat-dong/${id}`)
    await volunteer.getByRole('link', { name: 'Check-in bằng QR hoặc mã' }).click()
    await volunteer.getByLabel('Mã check-in (8 chữ số)').fill(oldCode)
    await volunteer.getByRole('button', { name: 'Xác nhận check-in', exact: true }).click()
    await expect(volunteer.getByRole('alert')).toContainText('Mã không hợp lệ')
    await volunteer.getByLabel('Chọn ảnh QR').setInputFiles({ name: 'checkin.png', mimeType: 'image/png', buffer: Buffer.from(qrImage.split(',')[1], 'base64') })
    await expect(volunteer.getByText('Đã nhận QR của hoạt động. Bấm xác nhận để check-in.')).toBeVisible()
    // Decode the same QR through a real video stream backed by a canvas, without
    // accessing any physical camera on the machine running the test.
    await volunteer.getByRole('button', { name: 'Dùng mã nhập thay thế' }).click()
    await volunteer.evaluate(imageData => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 640
        const context = canvas.getContext('2d')
        const image = new Image()
        image.src = imageData
        await image.decode()
        const draw = () => { context.fillStyle = 'white'; context.fillRect(0, 0, 640, 640); context.drawImage(image, 160, 160, 320, 320) }
        draw()
        const timer = setInterval(draw, 100)
        const stream = canvas.captureStream(10)
        window.checkinCameraTracks = stream.getTracks()
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track)
          track.stop = () => { clearInterval(timer); stop() }
        }
        return stream
      } })
    }, qrImage)
    await volunteer.getByRole('button', { name: 'Mở camera quét QR' }).click()
    await expect(volunteer.getByText('Đã nhận QR của hoạt động. Bấm xác nhận để check-in.')).toBeVisible()
    await expect.poll(() => volunteer.evaluate(() => window.checkinCameraTracks?.every(track => track.readyState === 'ended'))).toBe(true)
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-checkin-organizer.png`), fullPage: true })
    await volunteer.getByRole('button', { name: 'Xác nhận check-in', exact: true }).click()
    await expect(volunteer.getByRole('status')).toContainText('Bạn đã check-in thành công.')
    await expect(volunteer.getByText('Hình thức: Quét QR')).toBeVisible()
    await volunteer.evaluate(() => window.scrollTo(0, 0))
    await volunteer.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-checkin-volunteer.png`), fullPage: true })
    for (const width of [320, 390, 768, 1280]) {
      for (const target of [page, volunteer]) {
        await target.setViewportSize({ width, height: 900 })
        expect(await target.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
      }
    }
    const manual = await post(page.request, `/api/v1/organizer/activities/${id}/attendance/${entryId}/`)
    expect(manual.status()).toBe(200)
    expect((await manual.json()).method).toBe('qr')
    await page.getByRole('button', { name: 'Thu hồi mã', exact: true }).click()
    await expect(image).toHaveCount(0)
    await volunteer.reload()
    await expect(volunteer.getByRole('button', { name: 'Xác nhận check-in', exact: true })).toHaveCount(0)
    await expect(volunteer.getByText('Hình thức: Quét QR')).toBeVisible()
  } finally { await context.close() }
})

test('Camera không khả dụng, mã hết hạn và check-in bằng mã dự phòng', async ({ page, browser }, info) => {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    const { id, start } = await setup(page, context)
    const volunteer = await context.newPage()
    await volunteer.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Denied', 'NotAllowedError') } })
    })
    for (const target of [page, volunteer]) await setTime(target, start + 60000)
    await page.goto(`/nha-to-chuc/hoat-dong/${id}/diem-danh`)
    await page.getByRole('button', { name: 'Tạo mã mới', exact: true }).click()
    const code = page.getByTestId('attendance-code')
    await expect(code).toBeVisible()
    const expiredCode = await code.innerText()
    await volunteer.goto(`/hoat-dong/${id}/check-in`)
    await volunteer.getByRole('button', { name: 'Mở camera quét QR' }).click()
    await expect(volunteer.getByRole('alert')).toContainText('Không mở được camera')
    await volunteer.getByRole('button', { name: 'Tắt camera' }).click()
    await setTime(volunteer, start + 7 * 60000)
    await volunteer.getByLabel('Mã check-in (8 chữ số)').fill(expiredCode)
    await volunteer.getByRole('button', { name: 'Xác nhận check-in', exact: true }).click()
    await expect(volunteer.getByRole('alert')).toContainText('đã hết hạn')
    await setTime(page, start + 7 * 60000)
    await page.getByRole('button', { name: 'Tạo mã mới', exact: true }).click()
    await expect(code).not.toHaveText(expiredCode)
    await volunteer.getByLabel('Mã check-in (8 chữ số)').fill(await code.innerText())
    for (const width of [320, 390, 768, 1280]) {
      await volunteer.setViewportSize({ width, height: 900 })
      expect(await volunteer.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    }
    await volunteer.setViewportSize(info.project.use.viewport)
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await volunteer.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-checkin-code-form.png`), fullPage: true })
    await volunteer.getByRole('button', { name: 'Xác nhận check-in', exact: true }).click()
    await expect(volunteer.getByText('Hình thức: Nhập mã')).toBeVisible()
    await page.getByRole('button', { name: 'Cập nhật danh sách điểm danh' }).click()
    await expect(page.getByText('Hình thức: Nhập mã')).toBeVisible()
  } finally { await context.close() }
})
