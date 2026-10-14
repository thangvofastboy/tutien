// hooks/tamma.ts — tâm ma hiện hình và hình phạt xua đuổi thất bại (spec mục 27, 28)
import { need, type Player } from './rules'

const DAY = 86_400_000

// Xác suất xuất hiện mỗi lượt chat: 2% bình thường, 10% đang thiên phạt, 20% khi còn dưới 25% thời gian.
export function tammaChance(p: Player, now: number): number {
  if (!p.trib) return 0.02
  const total = p.trib.deadline - p.trib.startedAt
  return p.trib.deadline - now <= 0.25 * total ? 0.2 : 0.1
}

// Ngưỡng xua đuổi: 90% lượng token trung bình trong 2 giờ của chính người chơi.
export const exorcismRequired = (dailyTokens: number) => Math.round((0.9 * dailyTokens) / 12)

// Thất bại: đang thiên phạt mất 2% token đã góp; ngoài thiên phạt mất 0,5% ngưỡng EXP. Tối đa một lần mỗi ngày.
export function applyFailedExorcism(p: Player & { lastPenaltyAt?: number }, now: number): Player & { lastPenaltyAt?: number } {
  if (p.lastPenaltyAt !== undefined && Math.floor(now / DAY) === Math.floor(p.lastPenaltyAt / DAY)) return p
  if (p.trib) {
    const lost = Math.round(p.trib.earned * 0.02)
    return { ...p, lastPenaltyAt: now, trib: { ...p.trib, earned: p.trib.earned - lost } }
  }
  return { ...p, lastPenaltyAt: now, exp: Math.max(0, p.exp - Math.round(need(p.realm) * 0.005)) }
}
