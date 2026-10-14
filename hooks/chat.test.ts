import { expect, test } from 'claude-code/testing'
import { greeting, greetingLines, eventLines } from './chat'
import { applyEvents } from './pane'
import { newPlayer } from './rules'

test('lời chào theo giờ', () => {
  expect(greeting(8)).toBe('Chào buổi sáng')
  expect(greeting(12)).toBe('Chào buổi trưa')
  expect(greeting(15)).toBe('Chào buổi chiều')
  expect(greeting(20)).toBe('Chào buổi tối')
  expect(greeting(2)).toContain('Khuya')
})

test('lời chào mở phiên: 4 dòng, có tên, trạng thái, mẹo, thiên cơ', () => {
  const lines = greetingLines('ThangVo', newPlayer('Kiếm Tu', 'Nam'), new Date(2026, 9, 15, 9))
  expect(lines.length).toBe(4)
  expect(lines[0]).toBe('🙏 Chào buổi sáng, ThangVo')
  expect(lines[1]).toContain('Luyện Khí Sơ Kỳ')
  expect(lines[2].startsWith('💡 Mẹo: ')).toBe(true)
  expect(lines[3].startsWith('🔮 Thiên Cơ Hôm Nay: ')).toBe(true)
})

test('sự kiện có dòng chat, chữ hiệu ứng viết hoa đầu mỗi từ; sự kiện lạ thì không', () => {
  expect(eventLines('breakthrough', 0)[0]).toContain('Đột Phá Thành Công')
  expect(eventLines('tamma', 0).length).toBe(2)
  expect(eventLines('khong-co', 0)).toEqual([])
})

test('applyEvents ghi dòng vào khung chat; tắt trong cài đặt thì không ghi', async () => {
  const logs: string[] = []
  const fake = (chat: string) => ({
    store: { get: async (k: string) => (k === 'tutien.chatlines' ? chat : k === 'tutien.effects' ? 'off' : undefined) },
    ui: { log: (t: string) => logs.push(t) },
  })
  await applyEvents(fake('on') as any, ['tribulation-started', 'tamma'])
  expect(logs.length).toBe(2)
  expect(logs[1]).toContain('Tâm Ma Trễ Deadline Xuất Hiện')
  await applyEvents(fake('off') as any, ['breakthrough'])
  expect(logs.length).toBe(2)
})
