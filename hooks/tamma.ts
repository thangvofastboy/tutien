// hooks/tamma.ts — tâm ma hiện hình và hình phạt xua đuổi thất bại (spec mục 27, 28)
import { need, type Player } from './rules.ts'

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

// ---- Một bước Tâm Ma cho mỗi lượt gửi token (server gọi; spec 27.1, 27.3) ----
const HOUR = 3_600_000
export const TAMMA_WINDOW_MS = 2 * HOUR
export const LINH_THACH_REWARD = 5
export const MIN_EXORCISM = 10_000 // người mới chưa có lịch sử vẫn phải góp chút token

export type Tamma = { at: number; until: number; need: number; got: number }
export type TammaState = { active?: Tamma; log?: number[]; wins?: number; linhThach?: number; tribFailAt?: number }

// Thêm 5% khi vừa trượt thiên phạt trong 24 giờ và chưa vào thiên phạt mới.
export function appearChance(p: Player, now: number, tribFailAt?: number): number {
  if (!p.trib && tribFailAt !== undefined && now - tribFailAt < DAY) return 0.05
  return tammaChance(p, now)
}

// Ngoài thiên phạt: 1 lần mỗi 6 giờ, 3 lần mỗi ngày. Trong thiên phạt: 1 lần mỗi 2 giờ, 6 lần mỗi ngày.
export function tammaCapped(log: number[], inTrib: boolean, now: number): boolean {
  const gap = inTrib ? 2 * HOUR : 6 * HOUR
  const day = log.filter(t => now - t < DAY)
  return day.length >= (inTrib ? 6 : 3) || day.some(t => now - t < gap)
}

export function tammaStep(
  p0: Player & { lastPenaltyAt?: number }, t0: TammaState, tokens: number, now: number, rng: () => number,
  dailyAvg: number, quiet: boolean,
): { p: Player & { lastPenaltyAt?: number }; t: TammaState; events: string[] } {
  let p = p0
  let t: TammaState = { ...t0 }
  const events: string[] = []
  if (t.active) {
    if (now > t.active.until) {
      p = applyFailedExorcism(p, now)
      t.active = undefined
      events.push('tamma-failed')
    } else if (t.active.got + tokens >= t.active.need) {
      t = { ...t, active: undefined, wins: (t.wins ?? 0) + 1, linhThach: (t.linhThach ?? 0) + LINH_THACH_REWARD }
      events.push('tamma-defeated')
    } else {
      t.active = { ...t.active, got: t.active.got + tokens }
    }
  }
  const log = (t.log ?? []).filter(x => now - x < DAY)
  if (!t.active && events.length === 0 && !quiet && p.realm < 33 && !tammaCapped(log, !!p.trib, now)
    && rng() < appearChance(p, now, t.tribFailAt)) {
    t.active = { at: now, until: now + TAMMA_WINDOW_MS, need: Math.max(MIN_EXORCISM, exorcismRequired(dailyAvg)), got: 0 }
    log.push(now)
    events.push('tamma')
  }
  return { p, t: { ...t, log }, events }
}
