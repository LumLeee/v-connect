import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/hoat-dong'
const skills = [{ id: 1, name: 'Giao tiếp' }, { id: 2, name: 'Công nghệ' }]

async function mockDiscovery(page, { guest = false } = {}) {
  const state = { failList: false, failSkills: false, gets: [], skillPages: [], items: Array.from({ length: 14 }, (_, index) => ({
    id: `discovery-${index}`, title: `Bếp cộng đồng ${index + 1}`, description: 'Cùng chuẩn bị bữa ăn cộng đồng.',
    organizer_name: 'Nhóm cộng đồng', status: 'published', address: 'Thanh Khê, Đà Nẵng', starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z',
    capacity: 12, approved_count: 3, required_skills: [1, 2], skill_details: skills, cover_url: null, timeline: [], time_checks_disabled: false,
  })) }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: guest ? null : { id: 'discovery-volunteer', full_name: 'Người kiểm tra', email: 'ui@example.invalid', role: 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/skills/')) {
      if (state.failSkills) return route.abort()
      const pageNo = Number(url.searchParams.get('page'))
      state.skillPages.push(pageNo)
      data = { count: 2, results: [skills[pageNo - 1]], next: pageNo === 1 ? 'next' : null, previous: pageNo === 2 ? 'previous' : null }
    } else if (url.pathname.endsWith('/participation/')) data = { participation: null }
    else if (/\/activities\/discovery-\d+\/$/.test(url.pathname)) data = state.items.find(item => url.pathname.endsWith(`/${item.id}/`))
    else if (url.pathname.endsWith('/activities/')) {
      state.gets.push(Object.fromEntries(url.searchParams))
      if (state.failList) return route.abort()
      const term = (url.searchParams.get('search') || '').toLowerCase()
      const location = (url.searchParams.get('location') || '').toLowerCase()
      const items = state.items.filter(item => item.title.toLowerCase().includes(term) && item.address.toLowerCase().includes(location) && (!url.searchParams.get('skill') || item.required_skills.includes(Number(url.searchParams.get('skill')))))
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      if (pageNo > 1 && offset >= items.length) return route.fulfill({ status: 404, json: { detail: 'Trang không tồn tại.' } })
      data = { count: items.length, results: items.slice(offset, offset + 12), next: items.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null }
    } else throw new Error(`Unexpected discovery request: ${route.request().method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function openFilters(page) {
  const panel = page.locator('.volunteer-discovery .activity-filter-panel')
  if (await panel.getAttribute('open') === null) await panel.locator('summary').click()
}

test('Khám phá: thẻ có thời gian, kỹ năng, số chỗ và mở hoạt động bằng bàn phím', async ({ page }, info) => {
  const state = await mockDiscovery(page)
  await page.clock.setFixedTime(new Date('2030-11-21T06:50:00Z'))
  await page.goto(base)
  const cards = page.locator('.discovery-card')
  await expect(cards).toHaveCount(12)
  const first = cards.first()
  await expect(first.locator('time')).toHaveText('10 phút nữa')
  await expect(first.getByLabel('Kỹ năng của hoạt động')).toHaveText('Giao tiếpCông nghệ')
  await expect(first).toContainText('Còn 9 chỗ')
  await expect(first).toContainText('3 người được duyệt')
  await expect(first.getByRole('link')).toHaveCount(1)
  await expect(first.getByRole('link', { name: 'Xem chi tiết', exact: true })).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/volunteer-stage2-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-discovery.png`), fullPage: true })
  await first.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/hoat-dong\/discovery-0$/)
  await expect(page.getByRole('heading', { name: state.items[0].title, exact: true })).toBeVisible()
})

test('Khám phá: bộ lọc áp dụng toàn bộ dữ liệu, giữ khi phân trang/làm mới và bỏ riêng từng điều kiện', async ({ page }) => {
  const state = await mockDiscovery(page)
  await page.goto(base)
  await openFilters(page)
  await expect(page.getByLabel('Kỹ năng yêu cầu', { exact: true })).toBeEnabled()
  expect([...new Set(state.skillPages)]).toEqual([1, 2])
  await page.getByLabel('Tìm theo tên hoạt động', { exact: true }).fill('  Bếp cộng đồng  ')
  await page.getByLabel('Ngày bắt đầu từ', { exact: true }).fill('2030-11-21')
  await page.getByLabel('Ngày bắt đầu đến', { exact: true }).fill('2030-11-22')
  await page.getByLabel('Địa điểm', { exact: true }).fill('  Đà Nẵng  ')
  await page.getByLabel('Kỹ năng yêu cầu', { exact: true }).selectOption('2')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  const chips = page.getByRole('group', { name: 'Bộ lọc đang áp dụng', exact: true })
  await expect(chips.getByRole('button')).toHaveCount(6)
  await expect(page.locator('.discovery-result-count')).toHaveText('14 hoạt động phù hợp với “Bếp cộng đồng”.')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.discovery-card')).toHaveCount(2)
  const previousGets = state.gets.length
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.gets.length).toBeGreaterThan(previousGets)
  await expect(page.locator('.discovery-card')).toHaveCount(2)
  expect(state.gets.at(-1)).toEqual({ page: '2', page_size: '12', search: 'Bếp cộng đồng', date_from: '2030-11-21', date_to: '2030-11-22', location: 'Đà Nẵng', skill: '2' })
  await chips.getByRole('button', { name: 'Bỏ bộ lọc Kỹ năng: Công nghệ', exact: true }).click()
  await expect(page.locator('.discovery-card')).toHaveCount(12)
  expect(state.gets.at(-1)).not.toHaveProperty('skill')
  expect(state.gets.at(-1)).toMatchObject({ page: '1', search: 'Bếp cộng đồng', date_from: '2030-11-21', date_to: '2030-11-22', location: 'Đà Nẵng' })
  await page.evaluate(() => history.back())
  await expect(page.locator('.discovery-card')).toHaveCount(2)
  await expect(chips.getByRole('button', { name: 'Bỏ bộ lọc Kỹ năng: Công nghệ', exact: true })).toBeVisible()
  await chips.getByRole('button', { name: 'Xóa tất cả bộ lọc', exact: true }).click()
  await expect(page.locator('.discovery-card')).toHaveCount(12)
  await expect(chips).toHaveCount(0)
  expect(state.gets.at(-1)).toEqual({ page: '1', page_size: '12' })
})

test('Khám phá: kiểm tra ngày, lỗi kỹ năng không mất bộ lọc và phục hồi lỗi danh sách', async ({ page }) => {
  const state = await mockDiscovery(page)
  state.failSkills = true
  await page.goto(`${base}?skill=2&page=1`)
  await openFilters(page)
  await expect(page.getByLabel('Kỹ năng yêu cầu', { exact: true })).toBeDisabled()
  await expect(page.getByText('Chưa tải được danh mục kỹ năng. Bạn vẫn có thể tìm theo tên, ngày hoặc địa điểm.', { exact: true })).toBeVisible()
  await expect(page.locator('.discovery-card')).toHaveCount(12)
  await page.getByLabel('Ngày bắt đầu từ', { exact: true }).fill('2030-11-22')
  await page.getByLabel('Ngày bắt đầu đến', { exact: true }).fill('2030-11-21')
  const beforeInvalid = state.gets.length
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.getByText('Ngày đến phải bằng hoặc sau ngày từ.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Ngày bắt đầu đến', { exact: true })).toBeFocused()
  expect(state.gets.length).toBe(beforeInvalid)
  await page.getByLabel('Ngày bắt đầu đến', { exact: true }).fill('2030-11-23')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('skill') === '2' && url.searchParams.get('date_from') === '2030-11-22' && url.searchParams.get('date_to') === '2030-11-23')
  await expect.poll(() => state.gets.at(-1)).toMatchObject({ skill: '2', date_from: '2030-11-22', date_to: '2030-11-23' })
  await expect(page.locator('.discovery-card')).toHaveCount(12)
  state.failSkills = false
  await page.locator('.discovery-skill-error').getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByLabel('Kỹ năng yêu cầu', { exact: true })).toBeEnabled()
  await expect(page.getByLabel('Kỹ năng yêu cầu', { exact: true })).toHaveValue('2')
  state.failList = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.volunteer-discovery').getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failList = false
  await page.locator('.volunteer-discovery').getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.discovery-card')).toHaveCount(12)
})

test('Khám phá: khách vẫn tìm xem được, phục hồi trang rỗng và trang vượt giới hạn', async ({ page }) => {
  const state = await mockDiscovery(page, { guest: true })
  await page.goto(`${base}?search=Bếp&page=9`)
  await expect(page.getByRole('button', { name: 'Về trang đầu', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Đăng ký của tôi', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Về trang đầu', exact: true }).click()
  await expect(page.locator('.discovery-card')).toHaveCount(12)
  expect(state.gets.at(-1)).toMatchObject({ page: '1', search: 'Bếp' })
  await openFilters(page)
  await page.getByLabel('Tìm theo tên hoạt động', { exact: true }).fill('Không tồn tại')
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
  await expect(page.getByText('Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem tất cả hoạt động', exact: true }).click()
  await expect(page.locator('.discovery-card')).toHaveCount(12)
  await page.locator('.discovery-card').first().getByRole('link').click()
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true }).first()).toBeVisible()
})
