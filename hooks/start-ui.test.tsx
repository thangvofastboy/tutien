import { expect, mock, test } from 'claude-code/testing'

test('pane /tutien start vẽ được trên terminal và chuyển từ câu chuyện sang chọn lớp', async ($, on) => {
  // Cells 48×24 hợp lệ: mỗi ô là nửa khối trên, chữ cam trên nền mặc định.
  const words = new Uint32Array(48 * 24 * 3)
  for (let i = 0; i < 48 * 24; i++) words.set([0x2580, 0xff8800, 0x01000000], i * 3)
  const cells = btoa(String.fromCharCode(...new Uint8Array(words.buffer)))
  on('fs.read', async () => ({ value: cells }) as any)
  const ui = await $.ui.mount({ plugin: 'tutien', surface: 'terminal', component: 'Pane', requestId: 'tu-tien-start', props: { title: 'Tu Tiên Ký', bodyColumns: 80 } } as any)
  expect(await ui.find({ type: 'Text', text: /Bước 1\/7/ })).toBeDefined()
  await ui.press({ key: 'next' })
  expect(await ui.find({ type: 'Text', text: /Chọn lớp nhân vật/ })).toBeDefined()
  expect(await ui.find({ type: 'Select', key: 'cls' })).toBeDefined()
  const art = await ui.find({ type: 'Raster', key: 'art-Kiếm Tu' })
  expect(art?.props).toMatchObject({ columns: 24, rows: 12 })
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
