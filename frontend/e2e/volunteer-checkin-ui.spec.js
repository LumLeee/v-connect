import { test, expect } from '@playwright/test'
import QRCode from 'qrcode'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const id = '12345678-1234-1234-1234-123456789012'
const base = `/hoat-dong/${id}/check-in`
const token = 'a'.repeat(64)
const payload = `vconnect:checkin:${id}:${token}`
const instant = new Date('2030-11-21T08:00:00Z')
const attendance = { confirmed_at: '2030-11-21T07:55:00Z', confirmed_by_name: 'Người kiểm tra', method: 'code' }

async function mockCheckin(page, { guest = false } = {}) {
  const state = { failGet: false, failPost: false, delayPost: 0, gets: 0, posts: [], entry: {
    id: 'entry-checkin', status: 'approved', attendance: null,
    activity: { id, title: 'Cùng chuẩn bị bữa ăn cộng đồng', status: 'published', starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z', time_checks_disabled: false },
  } }
  page.on('pageerror', error => { throw error })
  await page.clock.setFixedTime(instant)
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: guest ? null : { id: 'checkin-volunteer', full_name: 'Người kiểm tra', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'mock-token' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/participation/')) {
      state.gets += 1
      if (state.failGet) return route.abort()
      data = { participation: state.entry }
    } else if (url.pathname.endsWith('/check-in/')) {
      const body = route.request().postDataJSON()
      state.posts.push(body)
      if (state.delayPost) await new Promise(resolve => setTimeout(resolve, state.delayPost))
      if (state.failPost) return route.fulfill({ status: 400, json: { detail: 'Mã không hợp lệ hoặc đã hết hạn.' } })
      data = { ...attendance, method: body.token ? 'qr' : 'code' }
    } else throw new Error(`Unexpected check-in request: ${route.request().method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function assertNoOverflow(page) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
}

test('Điểm danh: hai cách riêng, bàn phím, mã tám chữ số, thử lại lỗi và giữ xác nhận sau làm mới', async ({ page }, info) => {
  const state = await mockCheckin(page)
  await page.goto(base)
  const qr = page.getByRole('tab', { name: 'Quét QR', exact: true })
  const code = page.getByRole('tab', { name: 'Nhập mã', exact: true })
  await expect(qr).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Mã check-in (8 chữ số)')).toHaveCount(0)
  await expect(page.locator('.image-paste-zone')).toHaveCount(0)
  await qr.focus(); await page.keyboard.press('ArrowRight')
  await expect(code).toBeFocused(); await expect(code).toHaveAttribute('aria-selected', 'true')
  const input = page.getByLabel('Mã check-in (8 chữ số)')
  const submit = page.getByRole('button', { name: 'Xác nhận check-in', exact: true })
  await expect(input).toHaveJSProperty('tagName', 'INPUT')
  await page.getByText('Mã check-in (8 chữ số)', { exact: true }).click()
  await expect(input).toBeFocused()
  expect(await page.locator('.vci-form [id]').evaluateAll(nodes => new Set(nodes.map(node => node.id)).size === nodes.length)).toBe(true)
  await input.fill('12a34')
  await expect(input).toHaveValue('1234'); await expect(submit).toBeDisabled()
  await input.fill('1234 567890')
  await expect(input).toHaveValue('12345678')
  state.failPost = true
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('Mã không hợp lệ hoặc đã hết hạn.')
  expect(state.posts).toEqual([{ code: '12345678' }])
  await input.fill('87654321')
  await expect(page.getByRole('alert')).toHaveCount(0)
  state.failPost = false; state.delayPost = 300
  await assertNoOverflow(page)
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage3-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-checkin-code.png`), fullPage: true })
  await submit.click()
  await expect(page.getByRole('button', { name: 'Đang xử lý…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(code).toBeDisabled()
  await expect(page.locator('.vci-success')).toBeVisible()
  await expect(page.locator('.vci-success')).toContainText(state.entry.activity.title)
  await expect(page.locator('.vci-success time')).toHaveText('5 phút trước')
  await expect(page.locator('.vci-success time')).toHaveAttribute('datetime', attendance.confirmed_at)
  await expect(page.locator('.vci-success time')).toHaveAttribute('aria-label', /2030/)
  await expect(page.getByRole('link', { name: 'Xem lịch sử hoạt động', exact: true })).toHaveAttribute('href', '/tinh-nguyen-vien/lich-su')
  await expect(page.getByRole('button', { name: 'Xác nhận check-in', exact: true })).toHaveCount(0)
  const getsBeforeRefresh = state.gets
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets).toBeGreaterThan(getsBeforeRefresh)
  await expect(page.locator('.vci-success')).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
  expect(state.posts).toEqual([{ code: '12345678' }, { code: '87654321' }])
  await assertNoOverflow(page)
})

test('Điểm danh: ảnh QR đúng hoạt động, xác nhận thủ công và xóa token khi đổi cách', async ({ page }, info) => {
  const state = await mockCheckin(page)
  await page.goto(base)
  const file = page.getByLabel('Chọn ảnh QR', { exact: true })
  const submit = page.getByRole('button', { name: 'Xác nhận check-in', exact: true })
  await file.setInputFiles({ name: 'wrong.png', mimeType: 'image/png', buffer: await QRCode.toBuffer(`vconnect:checkin:99999999-1234-1234-1234-123456789012:${token}`) })
  await expect(page.getByRole('alert')).toContainText('QR không hợp lệ hoặc thuộc hoạt động khác')
  await expect(submit).toBeDisabled()
  await file.setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: await QRCode.toBuffer(payload) })
  await expect(page.locator('.vci-qr-ready')).toBeVisible()
  expect(state.posts).toHaveLength(0)
  await expect(submit).toBeEnabled()
  await assertNoOverflow(page)
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage3-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-checkin-qr.png`), fullPage: true })
  await page.getByRole('tab', { name: 'Nhập mã', exact: true }).click()
  await expect(page.getByLabel('Mã check-in (8 chữ số)')).toHaveValue('')
  await page.getByRole('tab', { name: 'Quét QR', exact: true }).click()
  await expect(page.locator('.vci-qr-ready')).toHaveCount(0)
  await expect(submit).toBeDisabled()
  await file.setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: await QRCode.toBuffer(payload) })
  await expect(page.locator('.vci-qr-ready')).toBeVisible()
  await submit.click()
  await expect(page.locator('.vci-success')).toContainText('Quét QR')
  expect(state.posts).toEqual([{ token }])
  await page.screenshot({ path: path.join(output, `${info.project.name}-checkin-success.png`), fullPage: true })
})

test('Điểm danh: dán QR bằng clipboard và Ctrl+V, xử lý ảnh lỗi rồi thử lại', async ({ page }) => {
  const state = await mockCheckin(page)
  const image = (await QRCode.toBuffer(payload)).toString('base64')
  await page.goto(base)
  await page.evaluate(base64 => {
    const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => [{ types: ['image/png'], getType: async () => new Blob([bytes], { type: 'image/png' }) }] } })
  }, image)
  await page.getByRole('button', { name: 'Dán ảnh QR', exact: true }).click()
  await expect(page.locator('.vci-qr-ready')).toBeVisible()
  expect(state.posts).toHaveLength(0)
  await page.getByLabel('Chọn ảnh QR', { exact: true }).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a qr image') })
  await expect(page.getByRole('alert')).toContainText('Không đọc được QR trong ảnh')
  await expect(page.locator('.vci-qr-ready')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xác nhận check-in', exact: true })).toBeDisabled()
  await page.getByRole('group', { name: 'Ảnh mã QR', exact: true }).evaluate((node, base64) => {
    const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }))
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }))
  }, image)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.vci-qr-ready')).toBeVisible()
  expect(state.posts).toHaveLength(0)
})

test('Điểm danh: camera bị từ chối vẫn nhập mã được; đổi cách đóng camera và xóa lỗi', async ({ page }) => {
  await mockCheckin(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Denied', 'NotAllowedError') } })
  })
  await page.goto(base)
  await page.getByRole('button', { name: 'Mở camera quét QR', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không mở được camera')
  await expect(page.getByLabel('Chọn ảnh QR', { exact: true })).toBeDisabled()
  await page.getByRole('tab', { name: 'Nhập mã', exact: true }).click()
  await expect(page.getByLabel('Camera quét QR', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('Mã check-in (8 chữ số)').fill('12345678')
  await page.getByRole('button', { name: 'Xác nhận check-in', exact: true }).click()
  await expect(page.locator('.vci-success')).toContainText('Nhập mã')
})

test('Điểm danh: trạng thái đơn, hoạt động và ranh giới giờ mở gồm thời điểm kết thúc', async ({ page }) => {
  const state = await mockCheckin(page)
  state.entry.status = 'pending'
  await page.goto(base)
  await expect(page.getByText('Bạn cần có đăng ký được duyệt để check-in.', { exact: true })).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
  state.entry.status = 'approved'; state.entry.activity.status = 'cancelled'
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByText('Hoạt động không còn mở check-in.', { exact: true })).toBeVisible()
  state.entry.activity.status = 'published'
  await page.clock.setFixedTime(new Date('2030-11-21T06:59:59Z'))
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByText('Chưa đến thời gian điểm danh.', { exact: true })).toBeVisible()
  for (const at of ['2030-11-21T07:00:00Z', '2030-11-21T10:00:00Z']) {
    await page.clock.setFixedTime(new Date(at)); await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await expect(page.getByRole('tablist', { name: 'Cách điểm danh', exact: true })).toBeVisible()
  }
  await page.clock.setFixedTime(new Date('2030-11-21T10:00:00.001Z'))
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByText('Đã hết thời gian điểm danh.', { exact: true })).toBeVisible()
  state.entry.activity.time_checks_disabled = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('tablist')).toBeVisible()
  expect(state.posts).toHaveLength(0)
})

test('Điểm danh: thử lại tải lỗi, chưa đăng ký và bằng chứng có mặt vẫn hiện sau hủy', async ({ page }) => {
  const state = await mockCheckin(page)
  state.failGet = true
  await page.goto(base)
  await expect(page.locator('.volunteer-checkin').getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failGet = false
  await page.locator('.volunteer-checkin').getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('tablist')).toBeVisible()
  const entry = state.entry
  state.entry = null
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByText('Bạn chưa đăng ký hoạt động này.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xem hoạt động', exact: true })).toHaveAttribute('href', `/hoat-dong/${id}`)
  state.entry = { ...entry, attendance, activity: { ...entry.activity, status: 'cancelled' } }
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.vci-success')).toContainText('Hoạt động đã bị hủy sau khi ghi nhận có mặt.')
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await assertNoOverflow(page)
})

test('Điểm danh: yêu cầu đăng nhập trước khi đọc thông tin tham gia', async ({ page }) => {
  const state = await mockCheckin(page, { guest: true })
  await page.goto(base)
  await expect(page).toHaveURL(/\/dang-nhap$/)
  expect(state.gets).toBe(0)
})
