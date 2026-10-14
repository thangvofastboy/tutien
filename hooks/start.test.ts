import { expect, test } from 'claude-code/testing'
import { STEPS, initWizard, advance, validName } from './start'

test('các bước theo thứ tự: câu chuyện → lớp → giới → tên → tính cách → hiển thị → xác nhận', () => {
  expect(STEPS).toEqual(['story', 'class', 'gender', 'name', 'persona', 'display', 'confirm'])
})

test('tên đạo hiệu: 1–24 ký tự chữ, số, gạch dưới hoặc gạch ngang', () => {
  expect(validName('ThangVo')).toBe(true)
  expect(validName('Thắng_Võ-1')).toBe(true)
  expect(validName('')).toBe(false)
  expect(validName('có khoảng trắng')).toBe(false)
  expect(validName('x'.repeat(25))).toBe(false)
})

test('đi qua đủ các bước với dữ liệu hợp lệ', () => {
  let w = initWizard()
  w = advance(w, null).w                 // story → class
  w = advance(w, 'Kiếm Tu').w
  w = advance(w, 'Nữ').w
  w = advance(w, 'ThangVo').w
  w = advance(w, 'lam-loi').w
  w = advance(w, 'raster').w
  expect(STEPS[w.step]).toBe('confirm')
  expect(w).toMatchObject({ cls: 'Kiếm Tu', gender: 'Nữ', name: 'ThangVo', persona: 'lam-loi', display: 'raster' })
})

test('giá trị không hợp lệ: giữ nguyên bước và báo lỗi', () => {
  let w = advance(initWizard(), null).w
  const bad = advance(w, 'Thần Tiên')
  expect(bad.w.step).toBe(w.step)
  expect(bad.error!.length).toBeGreaterThan(0)
  w = advance(advance(w, 'Ma Tu').w, 'Nam').w
  const badName = advance(w, 'tên có khoảng trắng')
  expect(STEPS[badName.w.step]).toBe('name')
  expect(badName.error!.length).toBeGreaterThan(0)
})
