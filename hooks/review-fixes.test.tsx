import { expect, test } from 'claude-code/testing'
import { recordTurn } from './usage'

// $ giả: kho lưu trữ nhường lượt sau mỗi lần đọc/ghi, như store thật qua host,
// để các lượt chạy song song đan xen đúng chỗ đọc-sửa-ghi hàng đợi.
function fake$() {
  const data = new Map<string, unknown>([['tutien.name', 'ThangVo'], ['tutien.key', 'k'.repeat(40)], ['tutien.version', 'v0.1.7']])
  const tick = () => Promise.resolve()
  const sent: string[] = []
  const $ = {
    store: {
      get: async (k: string) => { await tick(); return data.get(k) },
      set: async (k: string, v: unknown) => { await tick(); data.set(k, v) },
    },
    http: {
      fetch: async (_url: string, init: any) => {
        await tick()
        sent.push(JSON.parse(init.body).turnId)
        return { ok: true, status: 200, headers: {}, text: '{}' }
      },
    },
    ui: { toast: () => undefined, log: () => undefined, status: () => undefined },
  }
  return { $, sent, data }
}

test('ba lượt kết thúc cùng lúc (subagent song song): cả ba được gửi, hàng đợi rỗng', async () => {
  const { $, sent, data } = fake$()
  await Promise.all([
    recordTurn($, 'turn-a', { input_tokens: 100, output_tokens: 1 }, 0),
    recordTurn($, 'turn-b', { input_tokens: 200, output_tokens: 1 }, 0),
    recordTurn($, 'turn-c', { input_tokens: 300, output_tokens: 1 }, 0),
  ])
  expect([...new Set(sent)].sort()).toEqual(['turn-a', 'turn-b', 'turn-c'])
  expect(data.get('tutien.queue')).toEqual([])
})
