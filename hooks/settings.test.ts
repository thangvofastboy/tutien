import { expect, test } from 'claude-code/testing'
import { SETTINGS, PANEL_BG, THEMES, TEXT_SIZES, isValidSetting, withDefaults } from './settings'

test('có đủ các mục cài đặt, mỗi mục có nhãn tiếng Việt, lựa chọn và mặc định hợp lệ', () => {
  const keys = SETTINGS.map(s => s.key)
  for (const k of ['tutien.display', 'tutien.autoupdate', 'tutien.statusline', 'tutien.band', 'tutien.effects', 'tutien.persona', 'tutien.panelbg']) {
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
  expect(v['tutien.statusline']).toBe('off')
})

test('màu nền panel: mặc định theo terminal (không tô), các màu khác là mã hex', () => {
  expect(withDefaults({})['tutien.panelbg']).toBe('terminal')
  expect(PANEL_BG.terminal).toBeUndefined()
  expect(PANEL_BG.ink).toMatch(/^#[0-9a-f]{6}$/)
  expect(isValidSetting('tutien.panelbg', 'navy')).toBe(true)
  expect(isValidSetting('tutien.panelbg', '#ff0000')).toBe(false)
})

test('theme và cỡ chữ: mặc định là Mặc định và Vừa, mỗi lựa chọn có bảng màu hoặc bậc cỡ chữ', () => {
  const v = withDefaults({})
  expect(v['tutien.theme']).toBe('mac-dinh')
  expect(v['tutien.textsize']).toBe('vua')
  for (const o of SETTINGS.find(s => s.key === 'tutien.theme')!.options) expect(THEMES[o.value]).toBeDefined()
  for (const o of SETTINGS.find(s => s.key === 'tutien.textsize')!.options) expect(TEXT_SIZES[o.value]).toBeDefined()
  expect(isValidSetting('tutien.textsize', 'khong-lo')).toBe(false)
})
