import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/nha-to-chuc/hoat-dong'
const user = { id: 'editor-ui-owner', full_name: 'Nhà tổ chức kiểm tra', email: 'editor@example.invalid', role: 'organizer' }
const original = { id: 'editor-ui-activity', title: 'Ngày cộng đồng', description: 'Cùng chia sẻ kỹ năng với cộng đồng.', address: 'Huế',
  starts_at: '2020-10-10T01:00:00Z', ends_at: '2020-10-10T05:00:00Z', capacity: 12, approved_count: 2,
  required_skills: [], skill_details: [], timeline: [], status: 'draft', organizer_name: user.full_name, cover_url: null }

async function mockEditor(page) {
  const state = { activity: { ...original }, writes: [], failure: null }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'editor-ui-csrf' }
    else if (url.pathname.endsWith('/auth/logout/')) return route.fulfill({ status: 500, json: {} })
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/skills/')) data = { count: 1, results: [{ id: 'communication', name: 'Giao tiếp' }], previous: null, next: null }
    else if (url.pathname.endsWith('/reports/overview/')) data = { activities: { draft: 1 }, metrics: { pending: 0 } }
    else if (url.pathname.endsWith('/organizer/activities/') || url.pathname.endsWith(`/activities/${original.id}/`)) {
      if (['POST', 'PATCH'].includes(request.method())) {
        if (state.failure) return route.fulfill({ status: state.failure.status || 400, json: state.failure.body })
        const payload = request.postDataJSON()
        state.writes.push({ method: request.method(), payload })
        state.activity = { ...state.activity, ...payload }
        data = state.activity
      } else data = url.pathname.endsWith(`/activities/${original.id}/`) ? state.activity : { count: 0, results: [], next: null, previous: null }
    } else throw new Error(`Unexpected editor request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function answerDialog(page, accept, action) {
  const received = page.waitForEvent('dialog')
  page.once('dialog', dialog => accept ? dialog.accept() : dialog.dismiss())
  await action()
  const dialog = await received
  expect(dialog.message()).toContain('chưa lưu')
}

test('Biểu mẫu có thanh lưu cố định, lỗi dẫn đến trường và lưu lại được sau lỗi', async ({ page }, info) => {
  const state = await mockEditor(page)
  await page.goto(`${base}/tao`)
  const toolbar = page.locator('.om-editor-savebar')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(toolbar.getByRole('button', { name: 'Lưu bản nháp', exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await toolbar.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
  const summary = page.locator('.om-editor-errors')
  await expect(summary).toBeFocused()
  await expect(summary.locator('li')).toHaveCount(6)
  await summary.getByRole('link', { name: /^Tên hoạt động:/ }).click()
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toBeFocused()
  expect(state.writes).toHaveLength(0)
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Hướng dẫn kỹ năng số')
  await page.getByLabel('Mô tả hoạt động', { exact: true }).fill('Hỗ trợ người lớn tuổi sử dụng điện thoại.')
  await page.getByLabel('Địa chỉ hoạt động', { exact: true }).fill('Đà Nẵng')
  await page.getByLabel('Ngày hoạt động', { exact: true }).fill('2030-11-21')
  await page.getByLabel('Thời gian bắt đầu', { exact: true }).fill('14:00')
  await page.getByLabel('Thời gian kết thúc', { exact: true }).fill('13:00')
  await toolbar.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
  await summary.getByRole('link', { name: /^Thời gian kết thúc:/ }).click()
  await expect(page.getByLabel('Thời gian kết thúc', { exact: true })).toBeFocused()
  await page.getByLabel('Thời gian kết thúc', { exact: true }).fill('17:00')
  await page.getByRole('button', { name: 'Thêm mốc chương trình', exact: true }).click()
  await page.getByLabel('Tên mốc 1', { exact: true }).fill('Đón tiếp')
  await page.getByLabel('Kết thúc mốc 1', { exact: true }).fill('18:00')
  await toolbar.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
  await summary.getByRole('link', { name: /^Kết thúc mốc 1:/ }).click()
  await expect(page.getByLabel('Kết thúc mốc 1', { exact: true })).toBeFocused()
  await page.getByLabel('Kết thúc mốc 1', { exact: true }).fill('14:30')
  state.failure = { body: { error: { details: { capacity: ['Không thể nhỏ hơn số người đã duyệt.'], timeline: [{ title: ['Tên mốc chưa hợp lệ.'] }] } } } }
  await toolbar.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
  await expect(summary).toBeFocused()
  await summary.getByRole('link', { name: /^Tên mốc 1:/ }).click()
  await expect(page.getByLabel('Tên mốc 1', { exact: true })).toBeFocused()
  await page.getByLabel('Tên mốc 1', { exact: true }).fill('Đón tiếp người tham gia')
  state.failure = { status: 500, body: {} }
  await toolbar.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
  await expect(summary).toContainText('Máy chủ gặp lỗi')
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue('Hướng dẫn kỹ năng số')
  await mkdir(process.env.E2E_ARTIFACT_DIR || '../tmp/stage2-editor-preview', { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR || '../tmp/stage2-editor-preview', `${info.project.name}-editor-errors.png`), fullPage: true })
  state.failure = null
  page.on('dialog', () => { throw new Error('Lưu thành công không được hỏi bỏ thay đổi') })
  await toolbar.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
  await expect(page).toHaveURL(`${base}/${original.id}`)
  expect(state.writes[0].payload.starts_at).toBe('2030-11-21T07:00:00.000Z')
  expect(state.writes[0].payload.timeline[0].ends_at).toBe('2030-11-21T07:30:00.000Z')
})

test('Cảnh báo liên kết, Back/Forward và tải lại chỉ khi có thay đổi chưa lưu', async ({ page }) => {
  await mockEditor(page)
  await page.goto(base)
  await page.getByRole('link', { name: 'Tạo hoạt động', exact: true }).click()
  const title = page.getByLabel('Tên hoạt động', { exact: true })
  await title.fill('Nội dung chưa lưu')
  await answerDialog(page, false, () => page.locator('.om-editor-savebar').getByRole('link', { name: 'Quay lại' }).click())
  await expect(title).toHaveValue('Nội dung chưa lưu')
  await answerDialog(page, false, () => page.evaluate(() => history.back()))
  await expect(page).toHaveURL(`${base}/tao`)
  await expect(title).toHaveValue('Nội dung chưa lưu')
  await expect.poll(() => page.evaluate(() => location.pathname)).toBe(`${base}/tao`)
  const unload = page.waitForEvent('dialog')
  page.once('dialog', dialog => dialog.dismiss())
  await page.evaluate(() => location.reload())
  expect((await unload).type()).toBe('beforeunload')
  await expect(title).toHaveValue('Nội dung chưa lưu')
  await answerDialog(page, true, () => page.evaluate(() => history.back()))
  await expect(page).toHaveURL(base)
  await page.evaluate(() => history.forward())
  await expect(title).toHaveValue('')
  await page.locator('.om-editor-savebar').getByRole('link', { name: 'Quay lại' }).click()
  await expect(page).toHaveURL(base)
  await page.evaluate(() => history.back())
  await expect(title).toBeVisible()
  await title.fill('Giữ nội dung khi bấm Forward')
  await answerDialog(page, false, () => page.evaluate(() => history.forward()))
  await expect(page).toHaveURL(`${base}/tao`)
  await expect(title).toHaveValue('Giữ nội dung khi bấm Forward')
  await title.fill('')
  await expect(page.locator('.om-editor-savebar')).not.toContainText('Có thay đổi chưa lưu')
  page.on('dialog', () => { throw new Error('Dữ liệu đã hoàn nguyên không được cảnh báo') })
  await page.evaluate(() => history.forward())
  await expect(page).toHaveURL(base)
})

test('Chỉnh sửa giữ lịch cũ, theo dõi kỹ năng và bảo vệ nội dung khi đăng xuất lỗi', async ({ page }) => {
  const state = await mockEditor(page)
  await page.goto(`${base}/${original.id}/sua`)
  await expect(page.locator('.om-editor-savebar')).toContainText('Chưa có thay đổi')
  await page.getByLabel('Giao tiếp', { exact: true }).check()
  await expect(page.locator('.om-editor-savebar')).toContainText('Có thay đổi chưa lưu')
  if (await page.locator('.workspace-menu-toggle').getAttribute('aria-expanded') === 'false') await page.locator('.workspace-menu-toggle').click()
  await answerDialog(page, false, () => page.getByRole('button', { name: 'Đăng xuất', exact: true }).click())
  await expect(page).toHaveURL(`${base}/${original.id}/sua`)
  await answerDialog(page, true, () => page.getByRole('button', { name: 'Đăng xuất', exact: true }).click())
  await expect(page.getByRole('alert').filter({ hasText: 'Máy chủ gặp lỗi' })).toBeVisible()
  await answerDialog(page, false, () => page.getByRole('button', { name: 'Đăng xuất', exact: true }).click())
  if (page.viewportSize().width <= 1050) await page.keyboard.press('Escape')
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Tên đã chỉnh sửa')
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(page).toHaveURL(`${base}/${original.id}`)
  expect(state.writes[0].method).toBe('PATCH')
  expect(state.writes[0].payload).not.toHaveProperty('starts_at')
  expect(state.writes[0].payload).not.toHaveProperty('ends_at')
  expect(state.writes[0].payload.required_skills).toEqual(['communication'])
})
