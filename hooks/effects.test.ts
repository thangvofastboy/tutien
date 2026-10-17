import { expect, test } from 'claude-code/testing'
import { typeStep, auraFrame, tribEffect } from './effects'

test('chạy chữ: tăng dần từng ký tự, dừng lâu hơn sau dấu chấm', () => {
  expect(typeStep('abc', 1, false)).toEqual({ shown: 'a', next: 25 })
  expect(typeStep('a.', 2, false)).toEqual({ shown: 'a.', next: 400 })
  expect(typeStep('a,', 2, false)).toEqual({ shown: 'a,', next: 150 })
})

test('giảm chuyển động: hiện hết ngay', () => {
  expect(typeStep('abcdef', 2, true)).toEqual({ shown: 'abcdef', next: 0 })
})

test('hào quang: 3 khung quay vòng 1 → 2 → 3 → 1', () => {
  expect([auraFrame(0), auraFrame(1), auraFrame(2), auraFrame(3)]).toEqual([1, 2, 3, 1])
})

test('hiệu ứng thiên phạt theo sự kiện', () => {
  expect(tribEffect('tribulation-started')).toEqual({ kind: 'lightning', ms: 4000 })
  expect(tribEffect('breakthrough')).toEqual({ kind: 'gold', ms: 1500 })
  expect(tribEffect('tribulation-failed')).toEqual({ kind: 'rain', ms: 3000 })
  expect(tribEffect('death')).toEqual({ kind: 'red', ms: 1000 })
  expect(tribEffect('artifact')).toEqual({ kind: 'treasure', ms: 1500 })
})

import { overlayFrame, effectActive } from './effects'

test('khung hiệu ứng: khác nhau theo loại và đổi theo nhịp', () => {
  expect(overlayFrame('lightning', 0)).not.toBe(overlayFrame('lightning', 1))
  expect(overlayFrame('lightning', 0)).not.toBe(overlayFrame('gold', 0))
  expect(overlayFrame('rain', 2)).toContain('ˇ')
  expect(overlayFrame('gold', 0).length).toBeGreaterThan(0)
  expect(overlayFrame('gold', 0)).toContain('Đột Phá')
  for (const k of ['lightning', 'gold', 'rain', 'red'] as const) {
    for (let t = 0; t < 4; t++) expect(/[\u4e00-\u9fff]/.test(overlayFrame(k, t))).toBe(false)
  }
  expect(overlayFrame('red', 5).length).toBeGreaterThan(0)
})

test('hiệu ứng đã hết hạn không vẽ', () => {
  expect(effectActive({ kind: 'gold', until: 100 }, 99)).toBe(true)
  expect(effectActive({ kind: 'gold', until: 100 }, 100)).toBe(false)
  expect(effectActive(null, 0)).toBe(false)
})
