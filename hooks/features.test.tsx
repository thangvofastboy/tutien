import { expect, mock, test } from 'claude-code/testing'
import { classify, dominant, trackTool, linhCanLines, streakLines, cardSvg, lineColor, congPhapLines, warLines, kyNgoLines, storyPrompt } from './features'
import { newPlayer } from './rules'

const RUN = (args: string) => ({ command: 'tutien', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as any
const reply = (status: number, body: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(body) } }) as any

test('linh căn: phân loại theo đuôi file, file test, lệnh shell', () => {
  expect(classify('Edit', { file_path: '/a/src/app.ts' })).toBe('kim')
  expect(classify('Write', { file_path: '/a/model.py' })).toBe('thuy')
  expect(classify('Edit', { file_path: '/a/src/app.test.ts' })).toBe('tho')
  expect(classify('Edit', { file_path: '/a/README.md' })).toBe('moc')
  expect(classify('Bash', { command: 'ls' })).toBe('hoa')
  expect(classify('Read', { file_path: '/a/app.ts' })).toBe(null)
  expect(dominant({ kim: 5 })).toBe(null) // chưa đủ 20 lần
  expect(dominant({ kim: 15, thuy: 6 })).toBe('kim')
})

test('linh căn: đủ việc thì báo server và lưu', async () => {
  const vals: Record<string, unknown> = { 'tutien.name': 'ThangVo', 'tutien.key': 'k' }
  const sent: any[] = []
  const logs: string[] = []
  const fake = {
    store: { get: async (k: string) => vals[k], set: async (k: string, v: unknown) => { vals[k] = v } },
    http: { fetch: async (_u: string, init: any) => { sent.push(JSON.parse(init.body)); return { status: 200, ok: true, headers: {}, text: '{}' } } },
    ui: { log: (t: string) => logs.push(t) },
  }
  for (let i = 0; i < 20; i++) await trackTool(fake, 'Edit', { file_path: `/p/f${i}.py` })
  expect(vals['tutien.linhCan']).toBe('thuy')
  expect(sent.some(b => b.linhCan === 'thuy')).toBe(true)
  expect(logs[0]).toMatch(/Thủy Linh Căn/)
})

test('chữ của các lệnh: linh căn, chuỗi ngày, công pháp, tông chiến, kỳ ngộ', () => {
  expect(linhCanLines({ kim: 30 }, 'kim').join('\n')).toMatch(/Kim Linh Căn.*\n.*EXP/)
  expect(linhCanLines({}, null)[0]).toMatch(/chưa thức tỉnh/)
  const s = streakLines(8).join('\n')
  expect(s).toMatch(/8 ngày/)
  expect(s).toMatch(/✅ +7 ngày/)
  expect(s).toMatch(/⬜ +14 ngày/)
  expect(congPhapLines({ points: 2, learned: [{ id: 'kiem-y', n: 1 }] }).join('\n')).toMatch(/Kiếm Ý Tâm Pháp ★☆☆/)
  expect(warLines({ war: { standings: [{ rank: 1, name: 'Thanh Vân', members: 3, pct: 100 }], lastWinner: 'Thanh Vân' }, teamWeek: { pct: 50, done: false } }).join('\n')).toMatch(/Linh Mạch tuần này thuộc về Thanh Vân/)
  expect(kyNgoLines(null)[0]).toMatch(/Không có kỳ ngộ/)
  expect(storyPrompt('A', newPlayer('Kiếm Tu', 'Nam'), { streak: 3 }, [], null)).toMatch(/chuỗi 3 ngày/)
})

test('màu dòng theo icon đầu dòng', () => {
  expect(lineColor('🏆 thắng')).toBe('#ffd54f')
  expect(lineColor('⚔️ đánh')).toBe('#ff7b72')
  expect(lineColor('chữ thường')).toBeUndefined()
})

test('thẻ khoe: SVG có tên, cảnh giới, ảnh nhúng, thoát ký tự lạ', () => {
  const svg = cardSvg({ name: 'A<b>', p: { ...newPlayer('Kiếm Tu', 'Nam'), realm: 7 }, png: 'QUJD', linhCan: 'kim', streak: 5, badges: 2, linhThach: 9, tong: null, title: null })
  expect(svg).toContain('A&lt;b&gt;')
  expect(svg).toContain('Kim Đan Sơ Kỳ')
  expect(svg).toContain('data:image/png;base64,QUJD')
  expect(svg).toContain('Kim Linh Căn')
})

test('panel: kỳ ngộ hiện thẻ có hai nút, bấm nút thì chọn và hiện kết quả', async ($, on) => {
  mock.store(on)
  const calls: string[] = []
  on('http.fetch', async (_$: any, e: any) => {
    const url = String(e.url)
    calls.push(url)
    if (url.includes('/register')) return reply(200, { key: 'k' })
    if (url.includes('/leaderboard')) return reply(200, { rows: [] })
    if (url.includes('/ky-ngo')) return reply(200, { text: '🌱 Linh Thảo\n🎁 +8 linh thạch', events: ['ky-ngo-done'], player: newPlayer('Kiếm Tu', 'Nam') })
    return reply(200, { player: newPlayer('Kiếm Tu', 'Nam'), status: { quest: { pct: 1 }, streak: 4, linhCan: { id: 'kim', name: 'Kim Linh Căn', icon: '🗡️' }, congPhap: { points: 2, learned: [] }, kyNgo: { id: 'linh-thao', title: '🌱 Linh Thảo Bên Đường', desc: 'Cây phát sáng', a: '🍵 Hái', b: '💰 Bán' } }, social: {} })
  })
  on('fs.read', async () => ({ value: { base64: 'iVBORw0KGgo=' } }) as any)
  await $.command.run(RUN('register ThangVo "Kiếm Tu" Nam'))
  const ui = await $.ui.mount({ plugin: 'tutien', surface: 'desktop', component: 'Pane', requestId: 'tu-tien', props: { title: 'Tu tiên', bodyColumns: 80 } } as any)
  expect(await ui.find({ type: 'Text', text: /Linh Thảo Bên Đường/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🔥 4 ngày/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Kim Linh Căn/ })).toBeDefined()
  await ui.press({ key: 'kyngo:b' })
  let gain: any
  for (let i = 0; i < 100 && !gain; i++) { await new Promise(r => setTimeout(r, 10)); gain = await ui.find({ type: 'Text', text: /\+8 linh thạch/ }) }
  expect(calls.some(u => u.includes('/ky-ngo'))).toBe(true)
  expect(gain?.props.color).toBe('#f2cc60')
  await ui.unmount()
})

test('lệnh mới trả lời có icon; lệnh lạ vẫn ra trợ giúp có mục mới', async ($, on) => {
  mock.store(on)
  on('http.fetch', async (_$: any, e: any) => String(e.url).includes('/register') ? reply(200, { key: 'k' })
    : reply(200, { player: newPlayer('Ma Tu', 'Nữ'), status: { streak: 0, congPhap: { points: 0, learned: [] } }, social: { master: null, disciples: [], invites: [{ from: 'Be', kind: 'su-do' }] } }))
  on('fs.read', async () => ({ value: { base64: 'iVBORw0KGgo=' } }) as any)
  await $.command.run(RUN('register A "Ma Tu" Nữ'))
  expect((await $.command.run(RUN('chuoi'))).text).toMatch(/🧊 Chuỗi tu luyện: 0 ngày/)
  expect((await $.command.run(RUN('su-do'))).text).toMatch(/nhan-do Be/)
  expect((await $.command.run(RUN('linh-can'))).text).toMatch(/chưa thức tỉnh/)
  expect((await $.command.run(RUN('khong-co-lenh'))).text).toMatch(/luan-dao/)
})
