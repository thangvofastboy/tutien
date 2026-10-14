import { expect, mock, test } from 'claude-code/testing'

test('khung chữ nhỏ phía trên ô nhập vẽ được, chưa ghi danh thì mời ghi danh', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ plugin: 'tutien', surface: 'terminal', component: 'AbovePrompt', requestId: 'tu-tien-band', props: { bodyColumns: 80 } } as any)
  expect(await ui.find({ type: 'Text', text: /Chưa ghi danh/ })).toBeDefined()
  await ui.unmount()
})
