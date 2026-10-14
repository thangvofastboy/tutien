import { expect, test } from 'claude-code/testing'
import { parseReset, parseRegister, formatTop, HELP } from './commands'

test('register cần tên, lớp, giới hợp lệ', () => {
  expect(parseRegister('thang Kiếm\\ Tu Nam')).toBe(null)
  expect(parseRegister('thang "Kiếm Tu" Nam')).toEqual({ name: 'thang', cls: 'Kiếm Tu', gender: 'Nam' })
  expect(parseRegister('thang Thần Tiên Nam')).toBe(null)
  expect(parseRegister('')).toBe(null)
})

test('reset không có confirm chỉ cảnh báo', () => {
  expect(parseReset('')).toEqual({ confirm: false, cls: null, gender: null })
  expect(parseReset('confirm "Đan Sư" Nữ')).toEqual({ confirm: true, cls: 'Đan Sư', gender: 'Nữ' })
  expect(parseReset('confirm "Thần" Nữ')).toEqual({ confirm: true, cls: null, gender: 'Nữ' })
})

test('bảng xếp hạng tối đa 10 dòng, không có EXP hay token', () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ rank: i + 1, name: `p${i}`, cls: 'Kiếm Tu', realm: 3, score: 40 }))
  const text = formatTop('Tu vi', rows as any, 'p12')
  const lines = text.split('\n').filter(l => /^\d+\./.test(l))
  expect(lines.length).toBe(10)
  expect(text.includes('EXP')).toBe(false)
  expect(text.includes('token')).toBe(false)
})

test('trợ giúp liệt kê các lệnh chính', () => {
  for (const cmd of ['register', 'appearance', 'reset', 'status', 'top', 'autoupdate', 'update']) {
    expect(HELP.includes(cmd)).toBe(true)
  }
})
