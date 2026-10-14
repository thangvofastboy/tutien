import { expect, test } from 'claude-code/testing'
import { parseDescribe, parseAutoUpdate } from './version'

test('describe trả về tag đã trim; rỗng nếu lỗi', () => {
  expect(parseDescribe('v1.2.0\n')).toBe('v1.2.0')
  expect(parseDescribe('')).toBe('')
})

test('autoupdate chỉ bật khi người chơi gõ on', () => {
  expect(parseAutoUpdate('on')).toBe('on')
  expect(parseAutoUpdate('off')).toBe('off')
  expect(parseAutoUpdate('bật')).toBe(null)
  expect(parseAutoUpdate('')).toBe(null)
})
