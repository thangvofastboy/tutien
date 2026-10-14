import { expect, test } from 'claude-code/testing'
import { percentExp, timeLeft, barColor, statusText } from './display'
import { newPlayer, need } from './rules'

test('phần trăm EXP của bậc hiện tại', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: Math.floor(need(1) / 2) }
  expect(percentExp(p)).toBe(50)
})

test('thời gian còn lại: ngày và giờ, hoặc phút', () => {
  expect(timeLeft(0, (2 * 24 + 5) * 3_600_000)).toBe('2 ngày 5 giờ')
  expect(timeLeft(0, 45 * 60_000)).toBe('45 phút')
  expect(timeLeft(0, 0)).toBe('hết giờ')
})

test('màu theo trạng thái: đang tu xanh, thiên phạt dưới 12 giờ vàng, dưới 1 giờ đỏ', () => {
  const base = newPlayer('Thể Tu', 'Nam')
  expect(barColor(base, 0)).toBe('jade')
  const trib = (deadline: number) => ({ ...base, trib: { startedAt: 0, deadline, required: 1, earned: 0 } })
  expect(barColor(trib(10 * 3_600_000), 0)).toBe('gold')
  expect(barColor(trib(30 * 60_000), 0)).toBe('danger')
})

test('dòng trạng thái không chứa số EXP thô hay số token', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: 1234, trib: { startedAt: 0, deadline: 3 * 86_400_000, required: 9_999_999, earned: 1_234_567 } }
  const text = statusText(p, 0)
  expect(text.includes('1234')).toBe(false)
  expect(text.includes('9.999.999')).toBe(false)
  expect(text.includes('%')).toBe(true)
})
