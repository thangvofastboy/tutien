import { expect, test } from 'claude-code/testing'
import { SETTINGS, isValidSetting, withDefaults } from './settings'

test('có đủ các mục cài đặt, mỗi mục có nhãn tiếng Việt, lựa chọn và mặc định hợp lệ', () => {
  const keys = SETTINGS.map(s => s.key)
  for (const k of ['tutien.display', 'tutien.autoupdate', 'tutien.statusline', 'tutien.band', 'tutien.effects', 'tutien.persona']) {
    expect(keys.includes(k)).toBe(true)
  }
  for (const s of SETTINGS) {
    expect(s.label.length).toBeGreaterThan(0)
    expect(s.options.some(o => o.value === s.default)).toBe(true)
  }
})

test('chỉ nhận giá trị nằm trong danh sách lựa chọn', () => {
  expect(isValidSetting('tutien.display', 'raster')).toBe(true)
  expect(isValidSetting('tutien.display', 'khác')).toBe(false)
  expect(isValidSetting('khong-co', 'on')).toBe(false)
})

test('điền mặc định cho mục chưa đặt và bỏ giá trị không hợp lệ', () => {
  const v = withDefaults({ 'tutien.display': 'image', 'tutien.band': 'xyz' })
  expect(v['tutien.display']).toBe('image')
  expect(v['tutien.band']).toBe('on')
  expect(v['tutien.statusline']).toBe('on')
})
