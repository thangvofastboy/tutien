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

import { versionFromManifest } from './version'

test('bản cài từ marketplace (không có git): lấy phiên bản từ plugin.json, dạng v<số>', () => {
  expect(versionFromManifest('{"name":"tutien","version":"0.1.0"}')).toBe('v0.1.0')
  expect(versionFromManifest('{"name":"tutien"}')).toBe('')
  expect(versionFromManifest('không phải json')).toBe('')
})
