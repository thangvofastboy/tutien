import { expect, test } from 'claude-code/testing'
import { realmColor, REALM_COLORS, meter, gradientRuns, rankColor, EVENT_BANNERS } from './look'

test('màu cảnh giới: 3 bậc chung một màu, 11 đại cảnh giới 11 màu', () => {
  expect(realmColor(1)).toBe(realmColor(3))
  expect(realmColor(4)).not.toBe(realmColor(3))
  expect(realmColor(33)).toBe(REALM_COLORS[10])
  expect(new Set(REALM_COLORS).size).toBe(11)
})

test('thanh tiến độ mượt: luôn đủ độ rộng, 0% rỗng, 100% đầy, đi theo phần tám ô', () => {
  for (const pct of [0, 1, 7, 35, 50, 99, 100]) {
    const m = meter(pct, 10)
    expect([...m.filled].length + m.rest.length).toBe(10)
  }
  expect(meter(0).filled).toBe('')
  expect(meter(100).filled).toBe('█'.repeat(10))
  expect(meter(35).filled).toBe('███▌')
})

test('dải màu tiêu đề: mỗi ký tự một màu, giữ nguyên chữ', () => {
  const r = gradientRuns('◆ Tu Tiên')
  expect(r.map(x => x.ch).join('')).toBe('◆ Tu Tiên')
  expect(new Set(r.map(x => x.color)).size).toBeGreaterThan(2)
})

test('hạng 1-3 có màu vàng bạc đồng; băng rôn sự kiện viết hoa chữ cái đầu', () => {
  expect(rankColor(1)).toBeDefined()
  expect(rankColor(4)).toBeUndefined()
  for (const b of Object.values(EVENT_BANNERS)) {
    const words = b.text.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/)
    for (const w of words) expect(w[0]).toBe(w[0].toUpperCase())
  }
})

import { stepDots } from './look'

test('chấm tiến trình wizard: ● đã qua, ◉ hiện tại, ○ chưa tới', () => {
  expect(stepDots(0, 3)).toBe('◉ ○ ○')
  expect(stepDots(2, 4)).toBe('● ● ◉ ○')
})

import { blend } from './look'

test('blend trộn hai màu theo tỉ lệ, kẹp trong 0..1', () => {
  expect(blend('#000000', '#ffffff', 0)).toBe('#000000')
  expect(blend('#000000', '#ffffff', 1)).toBe('#ffffff')
  expect(blend('#000000', '#ff0000', 0.5)).toBe('#800000')
  expect(blend('#102030', '#102030', 2)).toBe('#102030')
})
