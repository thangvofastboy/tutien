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
  expect(tribEffect('artifact')).toBe(null)
})
