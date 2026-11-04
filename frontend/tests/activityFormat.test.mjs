import assert from 'node:assert/strict'
import test from 'node:test'
import { activityTime } from '../src/api/activityFormat.js'

const now = '2026-11-04T10:00:00Z'

test('past times today use elapsed minutes and hours', () => {
  assert.equal(activityTime('2026-11-04T09:55:00Z', now), '5 phút trước')
  assert.equal(activityTime('2026-11-04T08:00:00Z', now), '2 giờ trước')
  assert.equal(activityTime('2026-11-04T09:59:10Z', now), 'Vừa xong')
  assert.equal(activityTime(now, now), 'Vừa xong')
})

test('future times today use remaining minutes and hours', () => {
  assert.equal(activityTime('2026-11-04T10:05:00Z', now), '5 phút nữa')
  assert.equal(activityTime('2026-11-04T12:00:00Z', now), '2 giờ nữa')
  assert.equal(activityTime('2026-11-04T10:00:20Z', now), 'Trong giây lát')
})

test('minute and hour boundaries change units correctly', () => {
  assert.equal(activityTime('2026-11-04T09:59:00Z', now), '1 phút trước')
  assert.equal(activityTime('2026-11-04T09:00:01Z', now), '59 phút trước')
  assert.equal(activityTime('2026-11-04T09:00:00Z', now), '1 giờ trước')
})

test('crossing midnight in Vietnam keeps the full date even within five minutes', () => {
  assert.equal(activityTime('2026-11-04T16:58:00Z', '2026-11-04T17:03:00Z'), '23:58 4 thg 11, 2026')
  assert.equal(activityTime('2026-11-04T17:02:00Z', '2026-11-04T16:58:00Z'), '00:02 5 thg 11, 2026')
})

test('different UTC dates can still be the same calendar day in Vietnam', () => {
  assert.equal(activityTime('2026-11-05T00:00:00Z', '2026-11-04T23:00:00Z'), '1 giờ nữa')
})

test('dates outside today retain their full date and time', () => {
  assert.equal(activityTime('2026-11-03T10:00:00Z', now), '17:00 3 thg 11, 2026')
  assert.equal(activityTime('2026-11-05T10:00:00Z', now), '17:00 5 thg 11, 2026')
  assert.equal(activityTime('2025-11-04T10:00:00Z', now), '17:00 4 thg 11, 2025')
})
