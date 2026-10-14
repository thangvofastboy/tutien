// server/src/social.ts — tính năng giữa nhiều người chơi (spec 18.1, 18.2, 18.9, 20.2, 20.3, 25). Hàm thuần, lưu trong RosterDO.
import type { Extra } from '../../hooks/rules.ts'
import { vnDay } from '../../hooks/holidays.ts'

const DAY = 86_400_000
export const TONG_MAX = 10
export const TONG_CREATE_REALM = 10
export const TONG_WEEKLY_PER_MEMBER = 2_000_000
export const TONG_MIN_SHARE = 400_000
export const TAN_TU_BONUS = 0.005
export const COMPANION_BONUS = 0.005
export const COMMUNITY_TARGET = 100_000_000
export const CONGRATS_WINDOW = DAY

export type Role = 'tong-chu' | 'pho-tong-chu' | 'truong-lao' | 'ho-phap' | 'chan-truyen' | 'de-tu'
export const ROLES: Record<Role, { name: string; slots: number; minRealm: number; bonus: Extra; desc: string }> = {
  'tong-chu': { name: 'Tông Chủ', slots: 1, minRealm: 10, bonus: { exp: 0.01 }, desc: '+1% EXP' },
  'pho-tong-chu': { name: 'Phó Tông Chủ', slots: 1, minRealm: 7, bonus: { exp: 0.0075 }, desc: '+0,75% EXP' },
  'truong-lao': { name: 'Trưởng Lão', slots: 2, minRealm: 7, bonus: { trib: 0.01 }, desc: '−1% token thiên phạt' },
  'ho-phap': { name: 'Hộ Pháp', slots: 2, minRealm: 4, bonus: { death: 0.0005 }, desc: '−0,05% tỷ lệ tử vong' },
  'chan-truyen': { name: 'Chân Truyền Đệ Tử', slots: 2, minRealm: 1, bonus: { exp: 0.005 }, desc: '+0,5% EXP' },
  'de-tu': { name: 'Đệ Tử', slots: 99, minRealm: 1, bonus: {}, desc: 'không có bonus' },
}

export type Tong = { name: string; owner: string; members: Record<string, Role>; createdAt: number }
export type Invite = { from: string; to: string; kind: 'ban' | 'dao-lu'; at: number }
export type Social = {
  tongs: Record<string, Tong>
  companions: Record<string, string>
  partners: Record<string, string>
  invites: Invite[]
  seasons: Record<string, string>
  seen?: string[] // các mùa server đã có người chơi
  congrats?: Record<string, number> // "người chúc>người nhận" → lần đột phá đã chúc
}
// Ảnh chụp tối thiểu của một người chơi mà các luật xã hội cần (lấy từ Row của roster).
export type Snap = { name: string; realm: number; wk: number; lwk: number; mo: number; lmo: number; lastAt?: number; lastBreakthroughAt?: number; flagged?: boolean }

export const emptySocial = (): Social => ({ tongs: {}, companions: {}, partners: {}, invites: [], seasons: {} })
const lc = (s: string) => s.toLowerCase()
export const TONG_NAME = /^[\p{L}\p{N} _-]{2,24}$/u

export function memberOf(s: Social, player: string): { tong: Tong; role: Role } | null {
  for (const t of Object.values(s.tongs)) {
    const k = Object.keys(t.members).find(m => lc(m) === lc(player))
    if (k) return { tong: t, role: t.members[k] }
  }
  return null
}

type R = { s?: Social; error?: string; text?: string }

export function tongCreate(s: Social, name: string, owner: string, ownerRealm: number): R {
  if (!TONG_NAME.test(name)) return { error: 'Tên tông 2–24 ký tự: chữ, số, khoảng trắng, gạch.' }
  if (ownerRealm < TONG_CREATE_REALM) return { error: 'Cần đạt Nguyên Anh Sơ Kỳ (bậc 10) mới lập tông được.' }
  if (memberOf(s, owner)) return { error: 'Đạo hữu đang ở trong một tông. Rời tông trước đã.' }
  if (s.tongs[lc(name)]) return { error: `Tông "${name}" đã có.` }
  const tong: Tong = { name, owner, members: { [owner]: 'tong-chu' }, createdAt: Date.now() }
  return { s: { ...s, tongs: { ...s.tongs, [lc(name)]: tong } }, text: `🏯 Đã lập tông ${name}. Đạo hữu là Tông Chủ.` }
}

export function tongJoin(s: Social, name: string, player: string): R {
  const t = s.tongs[lc(name)]
  if (!t) return { error: `Không có tông "${name}".` }
  if (memberOf(s, player)) return { error: 'Đạo hữu đang ở trong một tông. Rời tông trước đã.' }
  if (Object.keys(t.members).length >= TONG_MAX) return { error: `Tông đã đủ ${TONG_MAX} người.` }
  return { s: { ...s, tongs: { ...s.tongs, [lc(name)]: { ...t, members: { ...t.members, [player]: 'de-tu' } } } }, text: `🏯 Đã gia nhập tông ${t.name}.` }
}

export function tongLeave(s: Social, player: string): R {
  const m = memberOf(s, player)
  if (!m) return { error: 'Đạo hữu chưa ở tông nào.' }
  const members = { ...m.tong.members }
  delete members[Object.keys(members).find(k => lc(k) === lc(player))!]
  const tongs = { ...s.tongs }
  if (lc(m.tong.owner) === lc(player)) {
    if (Object.keys(members).length > 0) return { error: 'Tông Chủ không rời tông khi còn thành viên.' }
    delete tongs[lc(m.tong.name)]
    return { s: { ...s, tongs }, text: `Tông ${m.tong.name} đã giải tán.` }
  }
  tongs[lc(m.tong.name)] = { ...m.tong, members }
  return { s: { ...s, tongs }, text: `Đã rời tông ${m.tong.name}.` }
}

export function tongAppoint(s: Social, owner: string, target: string, role: Role, targetRealm: number): R {
  const m = memberOf(s, owner)
  if (!m || lc(m.tong.owner) !== lc(owner)) return { error: 'Chỉ Tông Chủ được bổ nhiệm.' }
  if (!ROLES[role] || role === 'tong-chu') return { error: 'Chức vụ: pho-tong-chu, truong-lao, ho-phap, chan-truyen, de-tu.' }
  const key = Object.keys(m.tong.members).find(k => lc(k) === lc(target))
  if (!key) return { error: `${target} không ở trong tông.` }
  if (lc(key) === lc(owner)) return { error: 'Tông Chủ giữ nguyên chức vụ.' }
  if (targetRealm < ROLES[role].minRealm) return { error: `${ROLES[role].name} cần bậc ${ROLES[role].minRealm} trở lên.` }
  const used = Object.entries(m.tong.members).filter(([k, r]) => r === role && k !== key).length
  if (used >= ROLES[role].slots) return { error: `${ROLES[role].name} đã đủ ${ROLES[role].slots} chỗ.` }
  const tong = { ...m.tong, members: { ...m.tong.members, [key]: role } }
  return { s: { ...s, tongs: { ...s.tongs, [lc(tong.name)]: tong } }, text: `Đã bổ nhiệm ${key} làm ${ROLES[role].name}.` }
}

// Nhiệm vụ tuần (spec 18.1): kết quả tuần trước quyết định bonus chức vụ tuần này.
export function tongWeek(t: Tong, snaps: Snap[]): { target: number; total: number; pct: number; lastOk: boolean; weak: string[]; members: number } {
  const ms = snaps.filter(r => Object.keys(t.members).some(k => lc(k) === lc(r.name)))
  const n = Math.max(1, Object.keys(t.members).length)
  const target = TONG_WEEKLY_PER_MEMBER * n
  const total = ms.reduce((a, r) => a + r.wk, 0)
  const lastOk = ms.reduce((a, r) => a + r.lwk, 0) >= target
  const weak = ms.filter(r => r.lwk < TONG_MIN_SHARE).map(r => r.name)
  return { target, total, pct: Math.min(100, Math.floor((total / target) * 100)), lastOk, weak, members: n }
}

// Thiên Đạo (spec 20.3): mỗi tuần thứ Bảy và Chủ nhật (UTC+7) thiên phạt nhẹ hơn 10%.
export function thienDaoEvent(now: number): { active: boolean; name: string; desc: string } {
  const dow = new Date(now + 7 * 3_600_000).getUTCDay()
  return { active: dow === 6 || dow === 0, name: 'Thiên Đạo Khoan Dung', desc: 'Thứ Bảy và Chủ nhật: thiên phạt mới cần ít hơn 10% token' }
}

// Bonus cho một lượt của `player`: tán tu, chức vụ (nếu không bị tạm dừng), đồng hành, sự kiện Thiên Đạo.
export function ctxFor(s: Social, snaps: Snap[], player: string, now: number): Extra {
  const add = (a: Extra, b: Extra): Extra => ({ exp: (a.exp ?? 0) + (b.exp ?? 0), trib: (a.trib ?? 0) + (b.trib ?? 0), death: (a.death ?? 0) + (b.death ?? 0) })
  let x: Extra = { exp: 0, trib: 0, death: 0 }
  const me = snaps.find(r => lc(r.name) === lc(player))
  const m = memberOf(s, player)
  if (!m) x = add(x, { exp: TAN_TU_BONUS })
  else {
    const w = tongWeek(m.tong, snaps)
    const role = me && me.realm >= ROLES[m.role].minRealm ? m.role : 'de-tu'
    const paused = !w.lastOk || w.weak.some(n => lc(n) === lc(player))
    // Tuần đầu của tông (chưa có tuần trước) không bị tạm dừng.
    const fresh = now - m.tong.createdAt < 7 * DAY
    if (!paused || fresh) x = add(x, ROLES[role].bonus)
  }
  const buddy = s.companions[lc(player)]
  const b = buddy ? snaps.find(r => lc(r.name) === buddy) : undefined
  if (b?.lastAt !== undefined && now - b.lastAt < DAY) x = add(x, { exp: COMPANION_BONUS })
  if (thienDaoEvent(now).active) x.eventTrib = 0.1
  return x
}

// Lời mời đồng hành / đạo lữ: mời rồi người kia chấp nhận. Mỗi người một bạn đồng hành, một đạo lữ.
export function invite(s: Social, from: string, to: string, kind: 'ban' | 'dao-lu', now: number): R {
  if (lc(from) === lc(to)) return { error: 'Không tự mời chính mình được.' }
  const map = kind === 'ban' ? s.companions : s.partners
  const label = kind === 'ban' ? 'bạn đồng hành' : 'đạo lữ'
  if (map[lc(from)]) return { error: `Đạo hữu đã có ${label}.` }
  if (map[lc(to)]) return { error: `${to} đã có ${label}.` }
  const invites = [...s.invites.filter(i => !(lc(i.from) === lc(from) && i.kind === kind)), { from, to, kind, at: now }]
  return { s: { ...s, invites }, text: `Đã gửi lời mời ${label} tới ${to}. Người đó gõ /tutien ${kind} chap-nhan ${from}.` }
}
export function accept(s: Social, me: string, from: string, kind: 'ban' | 'dao-lu'): R {
  const inv = s.invites.find(i => lc(i.from) === lc(from) && lc(i.to) === lc(me) && i.kind === kind)
  if (!inv) return { error: `Không có lời mời từ ${from}.` }
  const key = kind === 'ban' ? 'companions' : 'partners'
  const map = s[key]
  if (map[lc(me)] || map[lc(from)]) return { error: 'Một trong hai người đã có đôi rồi.' }
  const next = { ...map, [lc(me)]: lc(from), [lc(from)]: lc(me) }
  return { s: { ...s, [key]: next, invites: s.invites.filter(i => i !== inv) }, text: kind === 'ban' ? `🤝 ${from} và đạo hữu đã thành bạn đồng hành.` : `💞 ${from} và đạo hữu đã kết đạo lữ.` }
}
export function unpair(s: Social, me: string, kind: 'ban' | 'dao-lu'): R {
  const key = kind === 'ban' ? 'companions' : 'partners'
  const other = s[key][lc(me)]
  if (!other) return { error: 'Đạo hữu chưa có ai.' }
  const next = { ...s[key] }
  delete next[lc(me)]
  delete next[other]
  return { s: { ...s, [key]: next }, text: kind === 'ban' ? 'Đã hủy bạn đồng hành.' : 'Đã hủy đạo lữ. Không ai mất tài nguyên.' }
}

// Chúc mừng (spec 20.2): chỉ khi người kia vừa đột phá trong 24 giờ.
export function canCongrats(target: Snap | undefined, now: number): boolean {
  return !!target?.lastBreakthroughAt && now - target.lastBreakthroughAt < CONGRATS_WINDOW
}

// Mùa (spec 20.2): mỗi quý một mùa; người đứng đầu Tu vi cuối mùa mang danh hiệu mùa kế.
export const quarterKey = (now: number) => { const d = vnDay(now); return `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}` }
export function prevQuarter(now: number): string {
  const d = vnDay(now)
  const y = Number(d.slice(0, 4)), q = Math.floor((Number(d.slice(5, 7)) - 1) / 3)
  return q === 0 ? `${y - 1}-Q4` : `${y}-Q${q}`
}
// Ghi người thắng mùa trước vào lần đọc đầu tiên của mùa mới (xấp xỉ: bảng Tu vi lúc đó).
// Chỉ trao danh hiệu cho mùa mà server đã có người chơi.
export function seasonStep(s: Social, topName: string | undefined, now: number): Social {
  const cur = quarterKey(now)
  const seen = s.seen ?? []
  let next = seen.includes(cur) || !topName ? s : { ...s, seen: [...seen, cur].slice(-8) }
  const prev = prevQuarter(now)
  if (!next.seasons[prev] && topName && seen.includes(prev)) next = { ...next, seasons: { ...next.seasons, [prev]: topName } }
  return next
}
export const titleOf = (s: Social, player: string, now: number) =>
  lc(s.seasons[prevQuarter(now)] ?? '') === lc(player) ? `Quán Quân ${prevQuarter(now)}` : undefined

// Thử thách cộng đồng (spec 20.2) và tiến độ toàn team (spec 25).
export function community(snaps: Snap[]): { month: number; lastMonth: number; target: number; pct: number; rewardActive: boolean } {
  const month = snaps.reduce((a, r) => a + r.mo, 0)
  const lastMonth = snaps.reduce((a, r) => a + r.lmo, 0)
  return { month, lastMonth, target: COMMUNITY_TARGET, pct: Math.min(100, Math.floor((month / COMMUNITY_TARGET) * 100)), rewardActive: lastMonth >= COMMUNITY_TARGET }
}
export const teamProgress = (snaps: Snap[]) =>
  snaps.length ? Math.floor((snaps.reduce((a, r) => a + r.realm, 0) / (33 * snaps.length)) * 100) : 0

export function tongBoard(s: Social, snaps: Snap[]) {
  return Object.values(s.tongs)
    .map(t => ({ name: t.name, members: Object.keys(t.members).length, power: Object.keys(t.members).reduce((a, k) => a + (snaps.find(r => lc(r.name) === lc(k))?.realm ?? 0), 0) }))
    .sort((a, b) => b.power - a.power || a.name.localeCompare(b.name))
    .map((t, i) => ({ rank: i + 1, ...t }))
}

// Đổi tên trong mọi quan hệ xã hội.
export function renameSocial(s: Social, from: string, to: string): Social {
  const swap = (n: string) => (lc(n) === lc(from) ? to : n)
  const tongs: Social['tongs'] = {}
  for (const [k, t] of Object.entries(s.tongs)) {
    const members: Record<string, Role> = {}
    for (const [m, r] of Object.entries(t.members)) members[swap(m)] = r
    tongs[k] = { ...t, owner: swap(t.owner), members }
  }
  const remap = (m: Record<string, string>) => {
    const out: Record<string, string> = {}
    for (const [a, b] of Object.entries(m)) out[lc(swap(a))] = lc(swap(b))
    return out
  }
  return {
    ...s, tongs, companions: remap(s.companions), partners: remap(s.partners),
    invites: s.invites.map(i => ({ ...i, from: swap(i.from), to: swap(i.to) })),
    seasons: Object.fromEntries(Object.entries(s.seasons).map(([q, n]) => [q, swap(n)])),
  }
}

// Tên đã đổi đi (bia mộ): roster bỏ qua ảnh chụp trễ của DO cũ, trừ khi có người ghi danh lại tên đó.
export const acceptRow = (gone: string[], name: string, revive: boolean) => revive || !gone.includes(name.toLowerCase())

// Mỗi người chúc mừng một lần cho mỗi lần đột phá, để hộp thư không bị spam.
export function congratsOnce(s: Social, from: string, to: string, breakthroughAt: number): { s?: Social; error?: string } {
  const key = `${from.toLowerCase()}>${to.toLowerCase()}`
  if (s.congrats?.[key] === breakthroughAt) return { error: 'Đạo hữu đã chúc mừng lần đột phá này rồi.' }
  return { s: { ...s, congrats: { ...(s.congrats ?? {}), [key]: breakthroughAt } } }
}
