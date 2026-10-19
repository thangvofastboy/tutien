import { expect, mock, test } from 'claude-code/testing'
import { newPlayer } from './rules'

const RUN = (args: string) => ({ command: 'tutien', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as any
const reply = (status: number, body: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(body) } }) as any
const run = (exitCode: number, stdout: string, stderr = '') =>
  ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } }) as any

const words = new Uint32Array(48 * 24 * 3)
for (let i = 0; i < 48 * 24; i++) words.set([0x2580, 0xff8800, 0x01000000], i * 3)
const CELLS = btoa(String.fromCharCode(...new Uint8Array(words.buffer)))
const AVATAR = 'iVBORw0KGgoAVATAR' // khác ảnh bậc để biết nguồn nào thắng
const REALM = 'iVBORw0KGgoREALM'
const pane = ($: any, surface: string) =>
  $.ui.mount({ plugin: 'tutien', surface, component: 'Pane', requestId: 'tu-tien', props: { title: 'Tu tiên', bodyColumns: 80 } } as any)

async function withPlayer($: any, on: any, proc: (e: any) => any, file = REALM) {
  mock.store(on)
  on('process.run', async (_$: any, e: any) => proc(e))
  on('http.fetch', async () => reply(200, { player: { ...newPlayer('Kiếm Tu', 'Nam'), realm: 7 }, key: 'k' }))
  on('fs.read', async () => ({ value: { base64: file } }) as any)
  await $.command.run(RUN('register ThangVo "Kiếm Tu" Nam'))
}

test('/tutien hinh ảnh jpg, có ~ và nháy đơn: qua avatar.py, terminal Ô màu vẽ ô của ảnh, Desktop vẽ Svg', async ($, on) => {
  const argv: string[][] = []
  await withPlayer($, on, e => {
    argv.push(e.argv)
    return e.argv[1]?.endsWith('avatar.py') ? run(0, JSON.stringify({ png: AVATAR, cells: CELLS, file: '/home/u/Ảnh/mèo.jpg' })) : run(1, '')
  })
  expect((await $.command.run(RUN("hinh '~/Ảnh/mèo.jpg'"))).text).toContain('Đã đặt ảnh')
  expect(argv.find(a => a[1]?.endsWith('avatar.py'))?.[2]).toBe('~/Ảnh/mèo.jpg')

  const term = await pane($, 'terminal')
  expect((await term.find({ type: 'Raster', key: 'realm' }))?.props.cells).toBe(CELLS)
  await term.unmount()
  const desk = await pane($, 'desktop')
  expect(String((await desk.find({ type: 'Svg' }))?.props.source)).toContain(AVATAR)
  await desk.unmount()
})

test('cỡ ảnh Nhỏ: terminal Raster 24×12, Desktop Svg 96px', async ($, on) => {
  await withPlayer($, on, e => (e.argv[1]?.endsWith('avatar.py') ? run(0, JSON.stringify({ png: AVATAR, cells: CELLS, file: '/a.png' })) : run(1, '')))
  await $.command.run(RUN('hinh /a.png'))
  const set = await $.ui.mount({ plugin: 'tutien', surface: 'mobile', component: 'Pane', requestId: 'tu-tien-settings', props: { title: 'Cài đặt', bodyColumns: 80 } } as any)
  await set.press({ key: 'tutien.artsize:nho' })
  await set.unmount()

  const term = await pane($, 'terminal')
  const r = await term.find({ type: 'Raster', key: 'realm' })
  expect(r?.props).toMatchObject({ columns: 24, rows: 12 })
  expect(atob(r?.props.cells).length).toBe(24 * 12 * 12)
  await term.unmount()
  const desk = await pane($, 'desktop')
  expect((await desk.find({ type: 'Svg' }))?.props).toMatchObject({ width: 96, height: 96 })
  await desk.unmount()
})

test('/tutien hinh: thiếu Pillow với ảnh không phải PNG thì báo cài Pillow, không đổi ảnh', async ($, on) => {
  await withPlayer($, on, () => run(1, '', "ModuleNotFoundError: No module named 'PIL'"), '/9j/4AAQ') // JPEG
  expect((await $.command.run(RUN('hinh a.jpg'))).text).toContain('pip install pillow')
})

// Server không phản hồi (mất mạng, chậm): pane vẫn phải hiện nhân vật đã lưu từ lần trước.
const offline = (on: any) => {
  on('http.fetch', async () => reply(503, {}))
  on('process.run', async () => run(1, ''))
  on('fs.read', async () => ({ value: '' }) as any)
  on('command.register', async () => ({ value: undefined }) as any)
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }) as any)
}

test('session mới / /clear: nạp nhân vật đã lưu thay vì báo Chưa ghi danh', async ($, on) => {
  mock.store(on, { 'tutien.name': 'ThangVo', 'tutien.key': 'k', 'tutien.player': { ...newPlayer('Kiếm Tu', 'Nam'), realm: 7 } })
  offline(on)
  await $.session.start({ cwd: '/tmp' } as any)
  const ui = await pane($, 'desktop')
  expect(await ui.find({ type: 'Text', text: /Chưa ghi danh|Đang tải/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Kiếm Tu/ })).toBeDefined()
  await ui.unmount()
})

test('đã ghi danh nhưng chưa có nhân vật lưu: báo Đang tải, không bảo ghi danh lại', async ($, on) => {
  mock.store(on, { 'tutien.name': 'ThangVo', 'tutien.key': 'k' })
  offline(on)
  await $.session.start({ cwd: '/tmp' } as any)
  const ui = await pane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /Đang tải nhân vật/ })).toBeDefined()
  await ui.unmount()
})

test('/tutien pane mở panel nhân vật; /tutien panel (tên cũ) vẫn chạy', async ($, on) => {
  mock.store(on)
  const opened: string[] = []
  on('ui.open', async (_$: any, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } as any })
  expect((await $.command.run(RUN('pane'))).text).toContain('Đã mở panel')
  expect((await $.command.run(RUN('panel'))).text).toContain('Đã mở panel')
  expect(opened.length).toBe(2)
})

test('lệnh có token đầu trong nháy ("hinh" xoa): phần sau lệnh vẫn đúng', async ($, on) => {
  mock.store(on)
  expect((await $.command.run(RUN('"hinh" xoa'))).text).toContain('Đã bỏ ảnh')
})
