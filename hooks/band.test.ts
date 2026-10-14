import { expect, test } from 'claude-code/testing'
import { bandLines } from './band'
import { newPlayer } from './rules'

test('khung chữ nhỏ: 2 dòng, mỗi dòng không quá 40 ký tự', () => {
  const p = { ...newPlayer('Kiếm Tu', 'Nam'), exp: 100 }
  const lines = bandLines('ThangVo', p, 0)
  expect(lines.length).toBe(2)
  expect(lines.every(l => l.length <= 40)).toBe(true)
  expect(lines[0]).toContain('ThangVo')
  expect(lines[0]).toContain('Kiếm Tu')
})

test('dòng 2: tiến độ bậc theo phần trăm; đang thiên phạt thì hiện thời gian còn lại', () => {
  const p = { ...newPlayer('Thể Tu', 'Nữ'), exp: 0 }
  expect(bandLines('a', p, 0)[1]).toContain('0%')
  const trib = { ...p, trib: { startedAt: 0, deadline: 2 * 86_400_000, required: 1000, earned: 0 } }
  expect(bandLines('a', trib, 0)[1]).toContain('2 ngày')
})

test('chưa có nhân vật: khung hiện gợi ý ghi danh', () => {
  expect(bandLines('a', undefined, 0)).toEqual(['Chưa ghi danh.', '/tutien register <tên> <lớp> <giới>'])
})
