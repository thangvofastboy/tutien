import { expect, mock, test } from 'claude-code/testing'

test('pane /tutien start vẽ được trên terminal và chuyển từ câu chuyện sang chọn lớp', async ($) => {
  const ui = await $.ui.mount({ plugin: 'tutien', surface: 'terminal', component: 'Pane', requestId: 'tu-tien-start', props: { title: 'Tu Tiên Ký', bodyColumns: 80 } } as any)
  expect(await ui.find({ type: 'Text', text: /Bước 1\/7/ })).toBeDefined()
  await ui.press({ key: 'next' })
  expect(await ui.find({ type: 'Text', text: /Chọn lớp nhân vật/ })).toBeDefined()
  expect(await ui.find({ type: 'Select', key: 'cls' })).toBeDefined()
  await ui.unmount()
})

test('pane Cài đặt vẽ được trên terminal với các Select', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ plugin: 'tutien', surface: 'terminal', component: 'Pane', requestId: 'tu-tien-settings', props: { title: 'Cài đặt', bodyColumns: 80 } } as any)
  expect(await ui.find({ type: 'Select', key: 'tutien.display' })).toBeDefined()
  expect(await ui.find({ type: 'Select', key: 'tutien.band' })).toBeDefined()
  expect(await ui.find({ type: 'Select', key: 'tutien.panelbg' })).toBeDefined()
  await ui.unmount()
})
