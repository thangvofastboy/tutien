import { expect, test } from 'claude-code/testing'
import { tammaChance, exorcismRequired, applyFailedExorcism } from './tamma'
import { newPlayer, need } from './rules'

test('xác suất theo trạng thái', () => {
  const base = newPlayer('Thể Tu', 'Nam')
  expect(tammaChance(base, 0)).toBe(0.02)
  const inTrib = { ...base, trib: { startedAt: 0, deadline: 100, required: 1, earned: 0 } }
  expect(tammaChance(inTrib, 50)).toBe(0.10)
  expect(tammaChance(inTrib, 90)).toBe(0.20)
})

test('ngưỡng xua đuổi = 90% token trung bình 2 giờ', () => {
  expect(exorcismRequired(12_000_000)).toBe(Math.round((0.9 * 12_000_000) / 12))
})

test('thất bại khi đang thiên phạt: mất 2% token đã góp, không mất EXP', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: need(1), trib: { startedAt: 0, deadline: 100, required: 1000, earned: 500 } }
  const out = applyFailedExorcism(p, 10)
  expect(out.trib!.earned).toBe(500 - Math.round(500 * 0.02))
  expect(out.exp).toBe(need(1))
})

test('thất bại khi không thiên phạt: mất 0,5% ngưỡng EXP', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: 5000 }
  const out = applyFailedExorcism(p, 10)
  expect(out.exp).toBe(5000 - Math.round(need(1) * 0.005))
})

test('tối đa một hình phạt mỗi ngày', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: 5000 }
  const once = applyFailedExorcism(p, 10)
  const twice = applyFailedExorcism(once, 20)
  expect(twice.exp).toBe(once.exp)
})
