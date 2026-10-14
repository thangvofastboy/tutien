import { expect, mock, test } from 'claude-code/testing'
import { svgSprite } from './pane'
import { newPlayer } from './rules'

const RUN = (args: string) => ({ command: 'tutien', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as any
const reply = (status: number, body: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(body) } }) as any

// Ghi danh qua server giả để pane có nhân vật (bậc 7, Kiếm Tu Nam).
async function withPlayer($: any, on: any) {
  mock.store(on)
  on('http.fetch', async ($: any, e: any) => {
    if (String(e.url).includes('/register')) return reply(200, { key: 'k' })
    if (String(e.url).includes('/leaderboard')) return reply(200, { rows: [{ rank: 1, name: 'Top', cls: 'Ma Tu', realm: 20, score: 50 }, { rank: 9, name: 'ThangVo', cls: 'Kiếm Tu', realm: 7, score: 0 }] })
    return reply(200, { player: { ...newPlayer('Kiếm Tu', 'Nam'), realm: 7 }, status: { quest: { pct: 40 }, bicanh: null, tamma: { pct: 30 } }, social: { tong: { name: 'Thanh Vân' } } })
  })
  on('fs.read', async () => ({ value: { base64: 'iVBORw0KGgo=' } }) as any)
  await $.command.run(RUN('register ThangVo "Kiếm Tu" Nam'))
}

test('Claude Code Desktop: pane vẽ nhân vật bằng Svg (không có Raster/Image)', async ($, on) => {
  await withPlayer($, on)
  const ui = await $.ui.mount({ plugin: 'tutien', surface: 'desktop', component: 'Pane', requestId: 'tu-tien', props: { title: 'Tu tiên', bodyColumns: 80 } } as any)
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Kim Đan/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🥇 Top/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Nhiệm vụ ngày: 40%.*Thanh Vân/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Xua đuổi Tâm Ma: 30%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /9\. ThangVo/ })).toBeDefined()
  await ui.unmount()
})

test('Claude Code Desktop: wizard /tutien start và pane Cài đặt vẽ được', async ($, on) => {
  mock.store(on)
  const start = await $.ui.mount({ plugin: 'tutien', surface: 'desktop', component: 'Pane', requestId: 'tu-tien-start', props: { title: 'Tu Tiên Ký', bodyColumns: 80 } } as any)
  expect(await start.find({ type: 'Text', text: /Bước 1\/7/ })).toBeDefined()
  await start.unmount()
  const set = await $.ui.mount({ plugin: 'tutien', surface: 'desktop', component: 'Pane', requestId: 'tu-tien-settings', props: { title: 'Cài đặt', bodyColumns: 80 } } as any)
  expect(await set.find({ type: 'Select', key: 'tutien.panelbg' })).toBeDefined()
  await set.unmount()
})

test('svgSprite nhúng PNG và giữ nét pixel', () => {
  const s = svgSprite('QUJD')
  expect(s).toContain('data:image/png;base64,QUJD')
  expect(s).toContain('image-rendering:pixelated')
})
