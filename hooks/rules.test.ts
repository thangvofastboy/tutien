import { expect, test } from 'claude-code/testing'
import { applyUsage, newPlayer, need, trib, effects, settle, windowMs, DAY_MS, REALM_COUNT } from './rules'

const never = () => 0.99
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] }

test('1.000 token = 1 EXP (lớp không có bonus EXP)', () => {
  let { p } = applyUsage(newPlayer('Thể Tu', 'Nam'), 999, 0, never)
  expect(p.exp).toBe(0)
  ;({ p } = applyUsage(p, 1, 0, never))
  expect(p.exp).toBe(1)
})

test('Kiếm Tu +3% EXP', () => {
  const { p } = applyUsage(newPlayer('Kiếm Tu', 'Nam'), 10_000, 0, never)
  expect(p.exp).toBe(10)
})

test('đạt ngưỡng → thiên phạt với token và cửa sổ đúng', () => {
  const start = { ...newPlayer('Thể Tu', 'Nam'), exp: need(1) - 1 }
  const { p, events } = applyUsage(start, 1000, 5, never)
  expect(events).toEqual(['tribulation-started'])
  expect(p.trib?.required).toBe(trib(1))
  expect(p.trib?.deadline).toBe(5 + windowMs(1, 'Thể Tu'))
})

test('Trận Pháp Sư cửa sổ +12 giờ', () => {
  expect(windowMs(1, 'Trận Pháp Sư') - windowMs(1, 'Thể Tu')).toBe(12 * 3_600_000)
})

test('Đan Sư token thiên phạt −5%', () => {
  const start = { ...newPlayer('Đan Sư', 'Nam'), exp: need(1) - 1 }
  const { p } = applyUsage(start, 1000, 0, never)
  expect(p.trib!.required).toBe(Math.round(trib(1) * 0.95))
})

test('vượt thiên phạt → lên bậc, EXP 0', () => {
  const start = { ...newPlayer('Thể Tu', 'Nam'), exp: need(1), trib: { startedAt: 0, deadline: 999, required: 100, earned: 99 } }
  const { p, events } = applyUsage(start, 1, 10, never)
  expect(p.realm).toBe(2)
  expect(p.exp).toBe(0)
  expect(events).toEqual(['breakthrough'])
})

test('tử vong khi rng < tỷ lệ, mất pháp bảo', () => {
  const start = { ...newPlayer('Thể Tu', 'Nam'), realm: 5, artifacts: ['e' as const], trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  const { p, events } = applyUsage(start, 1, 10, () => 0)
  expect(p.realm).toBe(1)
  expect(p.artifacts.length).toBe(0)
  expect(events).toEqual(['breakthrough', 'death'])
})

test('Phù Tu tử vong 1,75%: rng 0,018 không chết', () => {
  const start = { ...newPlayer('Phù Tu', 'Nam'), realm: 5, trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  const { p } = applyUsage(start, 1, 10, () => 0.018)
  expect(p.realm).toBe(6)
})

test('quá hạn → EXP về 0 (Luyện Khí Sư giữ 15%), giữ bậc, đánh dấu trượt', () => {
  const start = { ...newPlayer('Luyện Khí Sư', 'Nam'), realm: 3, exp: need(3), trib: { startedAt: 0, deadline: 100, required: 500, earned: 100 } }
  const late = settle(start, 100)
  expect(late.events).toEqual(['tribulation-failed'])
  expect(late.p.exp).toBe(Math.floor(need(3) * 0.15))
  expect(late.p.failedLast).toBe(true)
})

test('pháp bảo rơi khi lên đại cảnh giới mới (bậc 3 → 4), không rơi khi lên tiểu kỳ', () => {
  const to4 = { ...newPlayer('Thể Tu', 'Nam'), realm: 3, trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  expect(applyUsage(to4, 1, 1, seq(0.5, 0.1, 0)).p.artifacts.length).toBe(1)
  const to3 = { ...newPlayer('Thể Tu', 'Nam'), realm: 2, trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  expect(applyUsage(to3, 1, 1, seq(0.5, 0.1, 0)).p.artifacts.length).toBe(0)
})

test('bậc tối đa không thay đổi', () => {
  const top = { ...newPlayer('Thể Tu', 'Nam'), realm: REALM_COUNT }
  expect(applyUsage(top, 1_000_000, 0, never).events).toEqual([])
})

test('trần bonus pháp bảo EXP +1,5%', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), artifacts: Array(10).fill('e') as any }
  expect(effects(p).expMult).toBe(1.015)
})

test('ngưỡng EXP bậc 1 = 8.000 và thiên phạt bậc 1 ≈ 2.000.000', () => {
  expect(need(1)).toBe(8000)
  expect(trib(1)).toBe(2_000_000)
  expect(DAY_MS).toBe(86_400_000)
})
