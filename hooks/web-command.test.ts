import { expect, mock, test } from 'claude-code/testing'
const RUN = (args: string) => ({ command: 'tutien', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as any

test('/tutien web ghi trạng thái, chạy node web/server.js, rồi /tutien web stop tắt nó', async ($, on) => {
  mock.store(on)
  const writes: string[] = []
  const spawned: string[][] = []
  on('fs.write', async ($: any, e: any) => { writes.push(e.path); return { value: undefined } as any })
  on('process.spawn', async function* ($: any, e: any) {
    spawned.push([...e.argv])
    yield { stream: 'stdout', text: 'tutien-web listening 7340\n' } as any
    await new Promise(() => {})
  } as any)
  const a = await $.command.run(RUN('web'))
  expect(a.text).toContain('http://127.0.0.1:7340')
  expect(spawned[0][0]).toBe('node')
  expect(spawned[0][1].endsWith('/web/server.js')).toBe(true)
  expect(writes.some(p => p.endsWith('/web/state.json'))).toBe(true)
  expect((await $.command.run(RUN('web'))).text).toContain('đang chạy')
  expect(spawned.length).toBe(1)
  expect((await $.command.run(RUN('web stop'))).text).toBe('Đã tắt mini web.')
  expect((await $.command.run(RUN('web stop'))).text).toBe('Mini web chưa chạy.')
})
