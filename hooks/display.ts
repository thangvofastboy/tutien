// hooks/display.ts — hiển thị chỉ bằng phần trăm và thời gian (spec mục 19.2, 19.6)
import { need, REALM_NAMES, type Player } from './rules'

export const percentExp = (p: Player) => (p.realm >= 33 ? 100 : Math.min(100, Math.floor((p.exp / need(p.realm)) * 100)))

export const percentTrib = (p: Player, now: number) => {
  if (!p.trib) return 0
  const t = p.trib
  return Math.min(100, Math.floor((t.earned / t.required) * 100))
}

export function timeLeft(now: number, deadline: number): string {
  const ms = deadline - now
  if (ms <= 0) return 'hết giờ'
  const h = Math.floor(ms / 3_600_000)
  if (h >= 24) return `${Math.floor(h / 24)} ngày ${h % 24} giờ`
  if (h >= 1) return `${h} giờ`
  return `${Math.max(1, Math.floor(ms / 60_000))} phút`
}

// Màu theo spec 19.2: xanh đang tu, vàng khi thiên phạt còn dưới 12 giờ, đỏ khi dưới 1 giờ.
export function barColor(p: Player, now: number): 'jade' | 'gold' | 'danger' {
  if (!p.trib) return 'jade'
  const ms = p.trib.deadline - now
  if (ms < 3_600_000) return 'danger'
  if (ms < 12 * 3_600_000) return 'gold'
  return 'jade'
}

// Icon theo trạng thái: 👑 đỉnh cảnh giới, ⚡ đang thiên phạt, 🌿 đang tu luyện.
export const stateIcon = (p: Player) => (p.realm >= 33 ? '👑' : p.trib ? '⚡' : '🌿')

// Màu chữ theo trạng thái, cùng quy tắc với thanh tiến độ.
export const toneOf = (p: Player | undefined, now: number) => {
  if (!p) return 'subtle'
  return ({ jade: 'success', gold: 'warning', danger: 'error' } as const)[barColor(p, now)]
}

export function statusText(p: Player, now: number): string {
  const name = REALM_NAMES[p.realm - 1]
  if (p.realm >= 33) return `${name} (cảnh giới tối đa)`
  if (!p.trib) return `${name}: ${percentExp(p)}% tiến độ`
  return `${name}: thiên phạt ${percentTrib(p, now)}%, còn ${timeLeft(now, p.trib.deadline)}`
}
