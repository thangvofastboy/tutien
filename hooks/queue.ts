// hooks/queue.ts — hàng đợi lượt chưa gửi được (spec 3, mục "Mất mạng"). Thuần, không gọi mạng trực tiếp.
export const QUEUE_LIMIT = 500
export type Item = { turnId: string; tokens: number }
type Result = { ok: boolean; status: number; upgrade?: boolean }

export const pushQueue = (q: Item[], it: Item): Item[] => [...q, it].slice(-QUEUE_LIMIT)

// Gửi lần lượt. Dừng ngay ở lỗi mạng (status 0), 5xx hoặc 426 và giữ nguyên phần còn lại,
// để khi mất mạng không phải chờ timeout cho từng lượt. 4xx khác: bỏ (gửi lại vô ích). 2xx: đã nhận.
// Mỗi lần gửi tối đa `max` lượt; phần còn lại để lượt sau, để sau khi mất mạng lâu một lượt không phải chờ cả trăm yêu cầu.
export const FLUSH_MAX = 20
export async function flushQueue(q: Item[], send: (it: Item) => Promise<Result>, max = FLUSH_MAX): Promise<Item[]> {
  const left: Item[] = []
  for (let i = 0; i < q.length; i++) {
    if (i >= max) return [...left, ...q.slice(i)]
    const it = q[i]
    const r = await send(it).catch(() => ({ ok: false, status: 0 }) as Result)
    if (r.ok) continue
    if (r.upgrade || r.status === 0 || r.status >= 500) return [...left, ...q.slice(i)]
  }
  return left
}

// Chỉ ghi lượt khi đã ghi danh (có khóa); không tích lũy lượt trước khi đăng ký.
export const canQueue = (key: unknown) => typeof key === 'string' && key.length > 0
