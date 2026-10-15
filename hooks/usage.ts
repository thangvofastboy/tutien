// hooks/usage.ts — gửi số token mỗi lượt lên server (spec 3). Hàng đợi lưu trong $.store.
import { callServer, countTokens } from './api'
import { pushQueue, flushQueue, canQueue, type Item } from './queue'
import { applyEvents, setPlayer, refreshPane } from './pane'

const QUEUE = 'tutien.queue'
const REFRESH_MS = 60_000 // làm mới nhiệm vụ ngày, Tâm Ma, bảng xếp hạng tối đa mỗi phút một lần

// Mọi thao tác trên hàng đợi chạy nối tiếp: subagent song song bắn turn.complete cùng lúc,
// đọc-sửa-ghi hàng đợi chồng nhau thì mất lượt.
let chain: Promise<unknown> = Promise.resolve()
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job)
  chain = run.catch(() => undefined)
  return run
}
let lastRefresh = 0

async function flush($: any): Promise<void> {
  const q = ((await $.store.get(QUEUE)) as Item[] | undefined) ?? []
  if (q.length === 0) return
  const events: string[] = []
  let latest: any = null
  const quiet = (await $.store.get('tutien.effects')) === 'off' // tắt hiệu ứng thì không gặp Tâm Ma (spec 27.1)
  const left = await flushQueue(q, async it => {
    const r = await callServer<{ events?: string[]; player?: any }>($, '/usage', { turnId: it.turnId, tokens: it.tokens, quiet })
    if (r.ok && r.data?.events) events.push(...r.data.events)
    if (r.ok && r.data?.player) latest = r.data.player
    return { ok: r.ok, status: r.status, upgrade: r.upgrade }
  })
  if (latest) await setPlayer($, latest)
  await applyEvents($, events)
  await $.store.set(QUEUE, left)
  if (left.length > 0 && (await callServer($, '/me').catch(() => ({ upgrade: false }))).upgrade) {
    await $.ui.toast('Server chưa nhận phiên bản mod này: chạy /tutien update. Nếu đã mới nhất, EXP được giữ trong hàng đợi đến khi admin đăng ký phiên bản.')
  }
}

// Ghi lượt vào hàng đợi rồi gửi (gọi nền từ turn.complete trong register.ts, không chặn lượt).
export function recordTurn($: any, turnId: string, usage: unknown, now = Date.now()): Promise<void> {
  const tokens = countTokens(usage as any)
  if (tokens <= 0 || !turnId) return Promise.resolve()
  return serial(async () => {
    if (!canQueue(await $.store.get('tutien.key'))) return
    const q = ((await $.store.get(QUEUE)) as Item[] | undefined) ?? []
    await $.store.set(QUEUE, pushQueue(q, { turnId, tokens }))
    await flush($)
    if (now - lastRefresh >= REFRESH_MS) {
      lastRefresh = now
      await refreshPane($)
    }
  })
}

export function flushUsage($: any): Promise<void> {
  return serial(() => flush($))
}
