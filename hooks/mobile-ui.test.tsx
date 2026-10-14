import { expect, mock, test } from 'claude-code/testing'
import { newPlayer } from './rules'

const RUN = (args: string) => ({ command: 'tutien', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as any
const reply = (status: number, body: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(body) } }) as any
const mount = ($: any, requestId: string) =>
  $.ui.mount({ plugin: 'tutien', surface: 'mobile', component: 'Pane', requestId, props: { title: 'Tu Tiên Ký', bodyColumns: 40 } } as any)

test('app điện thoại: wizard chọn bằng nút, đặt tên bằng /tutien ten', async ($, on) => {
  mock.store(on)
  const ui = await mount($, 'tu-tien-start')
  await ui.press({ key: 'next' })
  await ui.press({ key: 'cls:Kiếm Tu' })
  await ui.press({ key: 'gender:Nam' })
  expect(await ui.find({ type: 'Text', text: /\/tutien ten/ })).toBeDefined()
  const r = await $.command.run(RUN('ten ThangVo'))
  expect(r.text).toContain('Đã đặt đạo hiệu ThangVo')
  expect(await ui.find({ type: 'Button', key: 'persona:none' })).toBeDefined()
  await ui.unmount()
})

test('app điện thoại: Cài đặt dùng nút; pane nhân vật vẽ bằng Svg', async ($, on) => {
  mock.store(on)
  on('http.fetch', async ($: any, e: any) =>
    String(e.url).includes('/register') ? reply(200, { key: 'k' }) : reply(200, { player: { ...newPlayer('Ma Tu', 'Nữ'), realm: 3 } }))
  on('fs.read', async () => ({ value: { base64: 'iVBORw0KGgo=' } }) as any)
  const set = await mount($, 'tu-tien-settings')
  await set.press({ key: 'tutien.panelbg:ink' })
  expect(await set.find({ type: 'Button', key: 'tutien.panelbg:ink' })).toBeDefined()
  await set.unmount()
  expect((await $.command.run(RUN('ten ai'))).text).toContain('Chỉ dùng được')
  await $.command.run(RUN('register ThangVo "Ma Tu" Nữ'))
  const pane = await mount($, 'tu-tien')
  expect(await pane.find({ type: 'Svg' })).toBeDefined()
  await pane.unmount()
})
