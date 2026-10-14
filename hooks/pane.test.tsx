import { expect, test } from 'claude-code/testing'
import { realmImage } from './pane'
import { newPlayer } from './rules'

test('đường dẫn ảnh theo lớp, giới, bậc hai chữ số', () => {
  const p = { ...newPlayer('Kiếm Tu', 'Nữ'), realm: 7 }
  expect(realmImage('/root', p, 2)).toBe('/root/assets/realms/Kiếm Tu/Nữ/07-2.png')
})
