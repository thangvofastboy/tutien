// hooks/band.ts — khung chữ nhỏ phía trên ô nhập (dải AbovePrompt): tên, lớp, bậc, tiến độ (spec 19.2).
import type { Player } from './rules'
import { REALM_NAMES } from './rules'
import { percentExp, timeLeft } from './display'

const fit = (s: string, n = 40) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const CLASS_ICON: Record<string, string> = {
  'Kiếm Tu': '🗡️', 'Đan Sư': '⚗️', 'Trận Pháp Sư': '🧭', 'Luyện Khí Sư': '🔨', 'Phù Tu': '📜', 'Thể Tu': '👊', 'Ma Tu': '👹',
}
export const classIcon = (cls: string) => CLASS_ICON[cls] ?? '✦'

export function bandLines(name: string, p: Player | undefined, now: number): string[] {
  if (!p) return ['Chưa ghi danh.', '/tutien register <tên> <lớp> <giới>']
  const top = fit(`${name} · ${p.cls}`)
  const bottom = p.trib
    ? fit(`${REALM_NAMES[p.realm - 1]} · còn ${timeLeft(now, p.trib.deadline)}`)
    : fit(`${REALM_NAMES[p.realm - 1]} · ${percentExp(p)}%`)
  return [top, bottom]
}
