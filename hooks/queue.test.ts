import { expect, test } from 'claude-code/testing'
import { pushQueue, flushQueue, QUEUE_LIMIT, type Item } from './queue'
import { countTokens } from './api'

const item = (id: string): Item => ({ turnId: id, tokens: 1000 })

test('countTokens: thiếu usage là 0; cache read không tính', () => {
  expect(countTokens(undefined)).toBe(0)
  expect(countTokens({ input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 2 } as any)).toBe(17)
})

test('pushQueue giới hạn 500 và bỏ lượt cũ nhất', () => {
  let q: Item[] = []
  for (let i = 0; i < QUEUE_LIMIT + 3; i++) q = pushQueue(q, item(`t${i}`))
  expect(q.length).toBe(QUEUE_LIMIT)
  expect(q[0].turnId).toBe('t3')
})

test('flush: lỗi mạng giữ lại; 2xx xóa; 4xx cố định bỏ; 426 giữ lại chờ cập nhật', async () => {
  const q = [item('ok'), item('net'), item('bad'), item('old')]
  const results: Record<string, { ok: boolean; status: number; upgrade?: boolean }> = {
    ok: { ok: true, status: 200 },
    net: { ok: false, status: 0 },
    bad: { ok: false, status: 400 },
    old: { ok: false, status: 426, upgrade: true },
  }
  const left = await flushQueue(q, async it => results[it.turnId])
  expect(left.map(i => i.turnId)).toEqual(['net', 'old'])
})
