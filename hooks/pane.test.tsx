import { expect, test } from 'claude-code/testing'
import { realmImage } from './pane'
import { newPlayer } from './rules'

test('đường dẫn ảnh theo lớp, giới, bậc hai chữ số', () => {
  const p = { ...newPlayer('Kiếm Tu', 'Nữ'), realm: 7 }
  expect(realmImage('/root', p)).toBe('/root/assets/realms/Kiếm Tu/Nữ/07.png')
})

import { realmCells, displayMode, CELL_COLS, CELL_ROWS } from './pane'

test('đường dẫn file ô theo bậc, và kích thước ô 48×24', () => {
  const p = { ...newPlayer('Kiếm Tu', 'Nam'), realm: 3 }
  expect(realmCells('/root', p)).toBe('/root/assets/cells/Kiếm Tu/Nam/03.b64')
  expect(CELL_COLS).toBe(48)
  expect(CELL_ROWS).toBe(24)
})

test('chế độ hiển thị mặc định là raster; chỉ nhận image, raster, text', () => {
  expect(displayMode(undefined)).toBe('raster')
  expect(displayMode('image')).toBe('image')
  expect(displayMode('text')).toBe('text')
  expect(displayMode('khác')).toBe('raster')
})
