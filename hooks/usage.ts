// hooks/usage.ts — gửi số token mỗi lượt lên server (spec 3). Hàng đợi lưu trong $.store.
import { callServer, countTokens } from './api'
import { pushQueue, flushQueue, type Item } from './queue'

const QUEUE = 'tutien.queue'

async function flush($: any): Promise<void> {
  const q = ((await $.store.get(QUEUE)) as Item[] | undefined) ?? []
  if (q.length === 0) return
  const left = await flushQueue(q, async it => {
    const r = await callServer($, '/usage', { turnId: it.turnId, tokens: it.tokens })
    return { ok: r.ok, status: r.status, upgrade: r.upgrade }
  })
  await $.store.set(QUEUE, left)
  if (left.length > 0 && (await callServer($, '/me').catch(() => ({ upgrade: false }))).upgrade) {
    await $.ui.toast('Bản mod đã cũ: chạy /tutien update để tiếp tục nhận EXP.')
  }
}

// Ghi lượt vào hàng đợi rồi gửi ngay (gọi từ turn.complete trong register.ts).
export async function recordTurn($: any, turnId: string, usage: unknown): Promise<void> {
  const tokens = countTokens(usage as any)
  if (tokens <= 0 || !turnId) return
  const q = ((await $.store.get(QUEUE)) as Item[] | undefined) ?? []
  await $.store.set(QUEUE, pushQueue(q, { turnId, tokens }))
  await flush($)
}

export { flush as flushUsage }
