// hooks/queue.ts — hàng đợi lượt chưa gửi được (spec 3, mục "Mất mạng"). Thuần, không gọi mạng trực tiếp.
export const QUEUE_LIMIT = 500
export type Item = { turnId: string; tokens: number }
type Result = { ok: boolean; status: number; upgrade?: boolean }

export const pushQueue = (q: Item[], it: Item): Item[] => [...q, it].slice(-QUEUE_LIMIT)

// Gửi lần lượt. Giữ lại: lỗi mạng (status 0), 5xx, và 426 (chờ người chơi cập nhật).
// Bỏ: 4xx còn lại (gửi lại cũng vô ích). 2xx: đã nhận.
export async function flushQueue(q: Item[], send: (it: Item) => Promise<Result>): Promise<Item[]> {
  const left: Item[] = []
  for (const it of q) {
    const r = await send(it).catch(() => ({ ok: false, status: 0 }) as Result)
    if (r.ok) continue
    if (r.upgrade || r.status === 0 || r.status >= 500) left.push(it)
  }
  return left
}
