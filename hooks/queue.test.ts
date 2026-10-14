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

test('flush: 2xx xóa; 4xx cố định bỏ; lỗi mạng hoặc 426 thì dừng và giữ phần còn lại', async () => {
  const q = [item('ok'), item('net'), item('bad'), item('old')]
  const results: Record<string, { ok: boolean; status: number; upgrade?: boolean }> = {
    ok: { ok: true, status: 200 },
    net: { ok: false, status: 0 },
    bad: { ok: false, status: 400 },
    old: { ok: false, status: 426, upgrade: true },
  }
  const left = await flushQueue(q, async it => results[it.turnId])
  // 'ok' được nhận; gặp lỗi mạng ở 'net' thì dừng và giữ nguyên phần còn lại (sửa #3)
  expect(left.map(i => i.turnId)).toEqual(['net', 'bad', 'old'])
  const left2 = await flushQueue([item('ok'), item('bad'), item('old')], async it => results[it.turnId])
  expect(left2.map(i => i.turnId)).toEqual(['old'])
})

import { canQueue } from './queue'

test('#3 flush dừng ở lỗi mạng đầu tiên (hoặc 426) và giữ phần còn lại', async () => {
  const q = [item('a'), item('b'), item('c')]
  let calls = 0
  const left = await flushQueue(q, async it => { calls++; return it.turnId === 'a' ? { ok: false, status: 0 } : { ok: true, status: 200 } })
  expect(calls).toBe(1)
  expect(left.map(i => i.turnId)).toEqual(['a', 'b', 'c'])
  let calls2 = 0
  const left2 = await flushQueue(q, async () => { calls2++; return { ok: false, status: 426, upgrade: true } })
  expect(calls2).toBe(1)
  expect(left2.length).toBe(3)
})

test('#3 chưa có khóa thì không ghi lượt vào hàng đợi', () => {
  expect(canQueue(undefined)).toBe(false)
  expect(canQueue('k')).toBe(true)
})
