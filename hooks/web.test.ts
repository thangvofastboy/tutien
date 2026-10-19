import { expect, test } from 'claude-code/testing'
import { webState } from './web'
import { newPlayer } from './rules'

test('trạng thái mini web: đường dẫn ảnh theo bậc, có phần trăm, không có khóa bí mật', () => {
  const p = { ...newPlayer('Kiếm Tu', 'Nam'), realm: 7 }
  const s: any = webState('ThangVo', p, 0)
  expect(s.image).toBe('assets/realms/Kiếm Tu/Nam/07.png')
  expect(s.icon).toBe('🌿')
  expect(typeof s.percent).toBe('number')
  expect(JSON.stringify(s).includes('key')).toBe(false)
  expect(webState('a', undefined, 0)).toEqual({ registered: false, board: [] })
  expect(s.avatar).toBe(null)
  expect((webState('ThangVo', p, 0, [], '12-abc') as any).avatar).toBe('12-abc')
})
