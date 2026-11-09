import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/tinh-nguyen-vien/ghep-noi'
const explanation = 'Điểm quy tắc /100: kỹ năng tối đa 50, sở thích 20, lịch rảnh 30. Không phải xác suất được duyệt; chưa dùng AI.'
const note = 'Bổ sung kỹ năng, sở thích và lịch rảnh trong hồ sơ để cải thiện gợi ý. Không tự đăng ký hoạt động.'

async function fixtures(page) {
  await page.clock.install({ time: new Date('2026-11-05T10:00:00Z') })
  const state = { fail: false, empty: false, requests: [], entries: Array.from({ length: 13 }, (_, index) => ({
    score: 63.33,
    components: { skills: 33.33, interests: 20, availability: 10 },
    matched_skills: ['Giao tiếp', 'Công nghệ'], matched_interests: ['kết nối'], availability_percent: 33.3,
    reasons: ['Khớp 2/3 kỹ năng yêu cầu.', 'Sở thích xuất hiện trong tên hoặc mô tả: kết nối.', 'Lịch rảnh bao phủ 33.3% thời gian hoạt động.'],
    activity: { id: `vm-activity-${index}`, title: `Kết nối cộng đồng ${index + 1}`, address: 'Phòng sinh hoạt cộng đồng tại Đà Nẵng',
      starts_at: '2026-11-05T09:55:00Z', ends_at: '2026-11-05T12:00:00Z',
      skill_details: [{ id: 1, name: 'Giao tiếp' }, { id: 2, name: 'Giảng dạy' }, { id: 3, name: 'Công nghệ' }],
    },
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'volunteer-matching-ui', full_name: 'Nguyễn An', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/matching/activities/')) {
      state.requests.push(url.search)
      if (state.fail) return route.abort()
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      const entries = state.empty ? [] : state.entries
      data = { count: entries.length, results: entries.slice(offset, offset + 12), next: entries.length > offset + 12 ? 'next' : null,
        previous: pageNo > 1 ? 'previous' : null, method: 'rules_v1', explanation, note }
    } else if (/\/activities\/vm-activity-\d+\/$/.test(url.pathname)) return route.fulfill({ status: 404, json: { detail: 'Không tìm thấy hoạt động.' } })
    else throw new Error(`Unexpected volunteer matching UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Gợi ý tình nguyện viên: giải thích đúng dữ liệu, phân biệt kỹ năng và giữ nguyên quy tắc', async ({ page }) => {
  await fixtures(page)
  await page.goto(base)
  const first = page.locator('.vm-match-row').first()
  await expect(first).toContainText('63.33/100 điểm')
  await expect(first).toContainText('5 phút trước')
  await expect(first.locator('.vm-matched-skills span')).toHaveText(['Giao tiếp', 'Công nghệ'])
  await expect(first.locator('.vm-other-skills span')).toHaveText(['Giảng dạy'])
  await expect(first.getByText('Kỹ năng khớp hồ sơ', { exact: true })).toBeVisible()
  await expect(first.getByText('Kỹ năng khác của hoạt động', { exact: true })).toBeVisible()
  await expect(first.locator('.vm-matched-skills svg')).toHaveCount(2)
  const disclosure = first.locator('.vm-match-explanation')
  await expect(disclosure.locator('li').first()).not.toBeVisible()
  await disclosure.locator('summary').click()
  await expect(disclosure.locator('li')).toHaveText(['Khớp 2/3 kỹ năng yêu cầu.', 'Sở thích xuất hiện trong tên hoặc mô tả: kết nối.', 'Lịch rảnh bao phủ 33.3% thời gian hoạt động.'])
  await expect(disclosure.locator('dd')).toHaveText(['33.33/50', '20/20', '10/30'])
  await disclosure.locator('li').first().click()
  await expect(page).toHaveURL(base)
  await disclosure.locator('summary').focus(); await page.keyboard.press('Enter')
  await expect(disclosure).not.toHaveAttribute('open', '')
  await page.keyboard.press('Space')
  await expect(disclosure).toHaveAttribute('open', '')
  await expect(page).toHaveURL(base)
  await page.getByRole('button', { name: 'Quy tắc', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Quy tắc ghép nối' })
  await expect(dialog).toContainText(explanation)
  await expect(dialog).toContainText(note)
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Cập nhật hồ sơ', exact: true })).toHaveAttribute('href', '/ho-so')
  await expect(first.getByRole('link', { name: 'Xem chi tiết', exact: true })).toHaveAttribute('href', '/hoat-dong/vm-activity-0')
})

test('Gợi ý tình nguyện viên: phân trang, làm mới đúng trang và thử lại khi tải lỗi', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(base)
  await expect(page.locator('.vm-match-row')).toHaveCount(12)
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.vm-match-row')).toHaveCount(1)
  await expect(page.locator('.vm-match-row h2')).toHaveText('Kết nối cộng đồng 13')
  state.fail = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.fail = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.vm-match-row h2')).toHaveText('Kết nối cộng đồng 13')
  expect(state.requests.at(-1)).toContain('page=2')
  await page.getByRole('button', { name: 'Trang trước', exact: true }).click()
  await expect(page.locator('.vm-match-row')).toHaveCount(12)
})

test('Gợi ý tình nguyện viên: rỗng hướng dẫn khám phá, không suy đoán hồ sơ thiếu thông tin', async ({ page }) => {
  const state = await fixtures(page)
  state.empty = true
  await page.goto(base)
  await expect(page.getByRole('heading', { name: 'Chưa có gợi ý phù hợp', exact: true })).toBeVisible()
  await expect(page.locator('.vm-empty-state')).toContainText('Bổ sung kỹ năng, sở thích và lịch rảnh trong hồ sơ để cải thiện gợi ý.')
  await expect(page.locator('.vm-empty-state').getByRole('link', { name: 'Khám phá hoạt động', exact: true })).toHaveAttribute('href', '/hoat-dong')
  await expect(page.locator('.vm-match-row')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Phân trang' })).toHaveCount(0)
})

test('Gợi ý tình nguyện viên: bố cục hẹp, nút chi tiết bên trái và bàn phím mở đúng hoạt động', async ({ page }, info) => {
  await fixtures(page)
  await page.goto(base)
  const first = page.locator('.vm-match-row').first()
  await first.locator('summary').click()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `width ${width}`).toBe(true)
    if (width <= 560) {
      const rowBox = await first.boundingBox(), actionBox = await first.getByRole('link', { name: 'Xem chi tiết', exact: true }).boundingBox()
      expect(actionBox.x - rowBox.x).toBeLessThan(25)
    }
  }
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage2-preview', { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage2-preview', `${info.project.name}-volunteer-matching.png`), fullPage: true })
  await first.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/hoat-dong\/vm-activity-0$/)
})
