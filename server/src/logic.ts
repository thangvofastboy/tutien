// server/src/logic.ts — nghiệp vụ server thuần, test bằng node:test. Luật lấy từ hooks/rules.ts (một nguồn).
import { tammaStep, LINH_THACH_REWARD, type TammaState } from '../../hooks/tamma.ts'
import { applyUsage, newPlayer, effects, need, settle, REALM_NAMES, TOKENS_PER_EXP, type Player, type Extra } from '../../hooks/rules.ts'
import {
  recordDay, questStep, newBadges, grantArtifact, randomArtifact, bicanhStep, holidayStep, pillExtra, pillAfter,
  inBeQuan, floorsStep, pushInbox, topFloor, weekKey, sumRange, nextDayKey, lastDays, journal, streak, bicanhProgress,
  QUEST_TOKENS, PILLS, BADGES, giftStep, type Extras,
} from './extras.ts'
import { vnDay, holidayOn, holidayTarget } from '../../hooks/holidays.ts'

export const SEEN_LIMIT = 1000
export const MAX_TOKENS_PER_TURN = 5_000_000
export const MAX_TOKENS_PER_HOUR = 10_000_000
export const MAX_TOKENS_PER_DAY = 40_000_000
export const FLAG_AT = 10 // từ 10 điểm nghi ngờ: ẩn khỏi bảng, không lên bậc (spec 21.2)
const HOUR_KEY = (now: number) => new Date(now).toISOString().slice(0, 13)
export const validTurnId = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(id)
export const DAY_MS = 86_400_000
export const DAY_KEY = (now: number) => new Date(now).toISOString().slice(0, 10)

export type State = {
  name: string
  keyHash: string
  player: Player
  seen: string[]
  lifetimeTokens: number
  weekTokens: Record<string, number>
  deaths: number
  resets: number
  hourTokens?: Record<string, number>
  suspicion?: number
  recent?: number[]
  lastAt?: number
  tamma?: TammaState
  devices?: string[] // khóa của các máy đã liên kết (băm SHA-256)
  link?: { codeHash: string; until: number; tries: number }
  renamedAt?: number
  renaming?: number // khóa đổi tên tới thời điểm này; trong lúc khóa, DO từ chối mọi lượt ghi
  accountHash?: string // tài khoản Claude của chủ nhân vật (băm); chỉ máy cùng tài khoản được liên kết
} & Extras

export function register(name: string, cls: string, gender: string, keyHash: string): State {
  return {
    name, keyHash, player: newPlayer(cls, gender), seen: [],
    lifetimeTokens: 0, weekTokens: {}, deaths: 0, resets: 0,
  }
}

export function handleUsage(
  st: State, body: { turnId: string; tokens: number; quiet?: boolean; ctx?: Extra }, now: number, rng: () => number,
): { state: State; events: string[]; duplicate: boolean; invalid?: boolean; gainedExp?: number } {
  if (!validTurnId(body.turnId)) return { state: st, events: [], duplicate: false, invalid: true }
  if (st.seen.includes(body.turnId)) return { state: st, events: [], duplicate: true }
  const raw = Math.max(0, Math.floor(Number(body.tokens) || 0))

  // Điểm nghi ngờ (spec 21.2). Giảm 3 điểm cho mỗi ngày trôi qua, để lỗi nhất thời không đánh dấu vĩnh viễn.
  const days = st.lastAt === undefined ? 0 : Math.floor((now - st.lastAt) / DAY_MS)
  let suspicion = Math.max(0, (st.suspicion ?? 0) - 3 * days)
  if (raw > MAX_TOKENS_PER_TURN) suspicion += 3
  const recent = [...(st.recent ?? []), raw].slice(-5)
  if (recent.length === 5 && recent.every(v => v === raw) && raw > 0) suspicion += 2
  if (st.lastAt !== undefined && now - st.lastAt < 50) suspicion += 1

  // Trần (spec 21.1): lượt vượt 5 triệu bị từ chối cả lượt; trần giờ và ngày chỉ cộng phần còn trống.
  const hour = HOUR_KEY(now)
  const day = DAY_KEY(now)
  const hourUsed = st.hourTokens?.[hour] ?? 0
  const dayUsed = st.weekTokens[day] ?? 0
  const tokens = raw > MAX_TOKENS_PER_TURN ? 0 : Math.max(0, Math.min(raw, MAX_TOKENS_PER_HOUR - hourUsed, MAX_TOKENS_PER_DAY - dayUsed))

  // Bị đánh dấu từ trước khi đang thiên phạt: dừng đồng hồ thiên phạt chờ admin xét (không bị trừ thời gian).
  const wasFlagged = (st.suspicion ?? 0) >= FLAG_AT
  let p0 = st.player
  if (wasFlagged && p0.trib && st.lastAt !== undefined) p0 = { ...p0, trib: { ...p0.trib, deadline: p0.trib.deadline + (now - st.lastAt) } }

  // Bonus ngoài (tông, đồng hành, sự kiện; do Worker tính) và đan dược. Bế quan: không nhận EXP, không thiên phạt.
  const x: Extra = { ...(body.ctx ?? {}), ...pillExtra(st.pills, now) }
  const closed = inBeQuan(st.beQuan, now)
  let { p, events }: { p: Player; events: string[] } = closed ? { p: p0, events: [] } : applyUsage(p0, tokens, now, rng, x)
  // Bị đánh dấu: EXP vẫn tính nhưng không vào thiên phạt, không lên bậc.
  if (suspicion >= FLAG_AT && (p.realm !== st.player.realm || (p.trib && !st.player.trib))) {
    p = { ...st.player, exp: Math.min(need(st.player.realm) - 1, st.player.exp + Math.floor(tokens / 1000)) }
    events = []
  }

  // Tâm Ma Trễ Deadline (spec 27): xuất hiện, xua đuổi, hình phạt. Người bị đánh dấu không gặp tâm ma.
  let tamma = st.tamma
  if (suspicion < FLAG_AT && !closed) {
    const past = Object.values(st.weekTokens)
    const dailyAvg = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0
    const tribFailAt = events.includes('tribulation-failed') ? now : st.tamma?.tribFailAt
    const tm = tammaStep(p, { ...st.tamma, tribFailAt }, tokens, now, rng, dailyAvg, body.quiet === true)
    p = tm.p
    tamma = tm.t
    events = [...events, ...tm.events]
  }

  const weekTokens: Record<string, number> = {}
  const cutoff = now - 7 * DAY_MS
  for (const [k, v] of Object.entries(st.weekTokens)) {
    if (Date.parse(k) > cutoff) weekTokens[k] = v
  }
  weekTokens[day] = dayUsed + tokens

  // EXP nhận được trong lượt (cho lịch sử và đạo lữ): chỉ khi đang tu thường, không thiên phạt, không bế quan.
  const gainedExp = closed || st.player.trib ? 0 : Math.floor((tokens * effects(st.player, x).expMult) / TOKENS_PER_EXP)

  // Mở rộng (spec 18, 20, 24): đan, tháp, nhiệm vụ ngày, bí cảnh, lễ hội, thành tựu, lịch sử.
  let ex: Extras = { pills: pillAfter(st.pills, events), floors: floorsStep(st.floors, p.realm, now) }
  let linhThach = (st.linhThach ?? 0) + (events.includes('tamma-defeated') ? LINH_THACH_REWARD : 0)
  let inbox = st.inbox
  const give = (rare: boolean, why: string) => {
    const g = grantArtifact(p, randomArtifact(rng, rare), linhThach)
    p = g.p
    linhThach = g.linhThach
    events.push(g.converted ? 'artifact-converted' : 'artifact')
    inbox = pushInbox(inbox, g.converted ? `🎁 ${why}: pháp bảo đã chạm trần, đổi thành linh thạch.` : `🎁 ${why}: nhận một pháp bảo${rare ? ' hiếm' : ''}.`, now)
  }
  if (events.includes('breakthrough')) ex.lastBreakthroughAt = now
  let history = recordDay(st.history, now, tokens, gainedExp, events)
  const q = questStep(history, st.quest, now)
  history = q.history
  ex.quest = q.quest
  if (q.completed) events.push('quest-done')
  if (q.reward) give(false, 'Hoàn thành 10 nhiệm vụ ngày')
  const b = bicanhStep(st.bicanh, history, now)
  ex.bicanh = b.bicanh
  if (b.result === 'done') { events.push('bicanh-done'); give(true, 'Bí cảnh tháng') }
  if (b.result === 'failed') events.push('bicanh-failed')
  const hol = holidayStep(st.holidays, now, tokens, !!st.player.trib)
  ex.holidays = hol.holidays
  let inventory = st.inventory
  if (hol.done) {
    events.push('holiday-done')
    give(true, `Bí cảnh lễ hội ${hol.done.name}`)
    if (!(inventory ?? []).includes('khung-le-hoi')) inventory = [...(inventory ?? []), 'khung-le-hoi']
  }
  const badges = newBadges(st.badges, p, events, history, now, tamma?.wins ?? 0, ex.quest?.done ?? 0)
  for (const id of badges) { events.push(`badge:${id}`); inbox = pushInbox(inbox, `🏅 Thành tựu mới: ${BADGES[id].name}`, now) }

  const next: State = {
    ...st,
    ...ex,
    history,
    badges: [...(st.badges ?? []), ...badges],
    linhThach,
    inventory,
    inbox,
    player: p,
    seen: [...st.seen, body.turnId].slice(-SEEN_LIMIT),
    lifetimeTokens: st.lifetimeTokens + tokens,
    weekTokens,
    hourTokens: { [hour]: hourUsed + tokens },
    deaths: st.deaths + (events.includes('death') ? 1 : 0),
    suspicion,
    recent,
    lastAt: now,
    tamma,
  }
  return { state: next, events, duplicate: false, gainedExp }
}

// Quà của đạo lữ (spec 18.9): chỉ khi đang tu thường. Bế quan, thiên phạt hoặc bị đánh dấu thì không nhận,
// nên quà không bao giờ kết thúc một thiên phạt (không có lượt tung tử vong) và không vượt cổng nghi ngờ.
export function handleGift(st: State, amount: number, now: number, rng: () => number): { state: State; given: number } {
  if ((st.suspicion ?? 0) >= FLAG_AT || inBeQuan(st.beQuan, now) || st.player.trib) return { state: st, given: 0 }
  const g = giftStep(st.gift, amount, now)
  if (g.give <= 0) return { state: st, given: 0 }
  const r = applyUsage(st.player, g.give * TOKENS_PER_EXP, now, rng, pillExtra(st.pills, now))
  return { state: { ...st, player: r.p, gift: g.gift, pills: pillAfter(st.pills, r.events) }, given: g.give }
}

// Đổi tên (một request trong DO cũ, nên không có hai lần đổi chạy song song): kiểm tra hạn 7 ngày rồi khóa 60 giây.
export const RENAME_COOLDOWN = 7 * DAY_MS
export function renameLock(st: State, now: number): { state: State; error?: string } {
  if (st.renaming !== undefined && st.renaming > now) return { state: st, error: 'Đang đổi tên, thử lại sau một phút.' }
  if (st.renamedAt !== undefined && now - st.renamedAt < RENAME_COOLDOWN) return { state: st, error: 'Mỗi 7 ngày chỉ đổi tên một lần.' }
  return { state: { ...st, renaming: now + 60_000 } }
}

export function handleReset(st: State, cls: string, gender: string): State {
  return {
    ...st,
    player: newPlayer(cls, gender),
    resets: st.resets + 1,
    pills: { bag: [], active: {} }, // reset làm mất đan đang giữ (spec 18.8)
  }
}

export type Row = {
  name: string; cls: string; gender: string; realm: number; exp: number; pct: number; lifetimeTokens: number; week: number; deaths: number; artifacts: number; flagged?: boolean
  // Mở rộng (spec 18, 20, 25): tuần lịch, tháng, tháp, hoạt động gần nhất, hồ sơ công khai.
  wk?: number; lwk?: number; mo?: number; lmo?: number; floor?: number; floorAt?: number; lastAt?: number; lastBreakthroughAt?: number
  badges?: string[]; persona?: string; equipped?: string; trib?: { pctTrib: number; deadline: number }
}

// Trạng thái đã xử lý thiên phạt quá hạn tại thời điểm đọc (GET /me, bảng xếp hạng).
export function settleState(st: State, now: number): State {
  if ((st.suspicion ?? 0) >= FLAG_AT) return st // đồng hồ thiên phạt đang dừng chờ admin
  return { ...st, player: settle(st.player, now).p }
}

export function row(st0: State, now: number): Row {
  const st = settleState(st0, now)
  const cutoff = now - 7 * DAY_MS
  const week = Object.entries(st.weekTokens)
    .filter(([k]) => Date.parse(k) > cutoff)
    .reduce((a, [, v]) => a + v, 0)
  return {
    name: st.name, cls: st.player.cls, gender: st.player.gender, realm: st.player.realm,
    exp: st.player.exp, pct: st.player.realm >= 33 ? 100 : Math.min(100, Math.floor((st.player.exp / need(st.player.realm)) * 100)),
    lifetimeTokens: st.lifetimeTokens, week, deaths: st.deaths,
    artifacts: st.player.artifacts.length,
    flagged: (st.suspicion ?? 0) >= FLAG_AT,
    ...calendar(st, now),
    floor: topFloor(st.floors),
    floorAt: st.floors?.[topFloor(st.floors)],
    lastAt: st.lastAt,
    lastBreakthroughAt: st.lastBreakthroughAt,
    badges: st.badges ?? [],
    persona: st.persona,
    equipped: st.equipped,
    trib: st.player.trib ? { pctTrib: Math.min(100, Math.floor((st.player.trib.earned / st.player.trib.required) * 100)), deadline: st.player.trib.deadline } : undefined,
  }
}

// Token theo tuần lịch và tháng (UTC+7) từ lịch sử 90 ngày.
export function calendar(st: State, now: number) {
  const wk0 = weekKey(now)
  const lwk0 = nextDayKey(wk0, -7)
  const today = vnDay(now)
  const mo0 = `${today.slice(0, 7)}-01`
  const prevMonth = new Date(Date.parse(mo0) - 86_400_000).toISOString().slice(0, 7) + '-01'
  return {
    wk: sumRange(st.history, wk0, nextDayKey(wk0, 7)),
    lwk: sumRange(st.history, lwk0, wk0),
    mo: sumRange(st.history, mo0, '9999'),
    lmo: sumRange(st.history, prevMonth, mo0),
  }
}

// Năm bảng (spec mục 16), cùng một tập người chơi.
export function boards(states: State[], now: number) {
  return sortBoards(states.map(s => row(s, now)))
}

export function sortBoards(all: Row[]) {
  const rows = all.filter(r => !r.flagged) // người bị đánh dấu bị ẩn khỏi mọi bảng
  const by = (cmp: (a: Row, b: Row) => number) => [...rows].sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name))
  return {
    tuVi: by((a, b) => b.realm - a.realm || b.exp - a.exp),
    chamChi: by((a, b) => b.lifetimeTokens - a.lifetimeTokens),
    tuan: by((a, b) => b.week - a.week),
    phoenix: by((a, b) => b.deaths - a.deaths),
    phapBao: by((a, b) => b.artifacts - a.artifacts || b.realm - a.realm),
  }
}

export const realmName = (realm: number) => REALM_NAMES[realm - 1]
export { effects }

// Cổng phiên bản (spec 21.5): chỉ hai bản phát hành gần nhất được gửi lượt.
export const RELEASES_KEPT = 2
export function versionAllowed(releases: string[], version: string): boolean {
  return version !== '' && releases.slice(0, RELEASES_KEPT).includes(version)
}
export function addRelease(releases: string[], tag: string): string[] {
  return [tag, ...releases.filter(t => t !== tag)].slice(0, RELEASES_KEPT)
}

// Bảng công khai (spec 19.6, 16): hạng, tên, lớp, bậc và một điểm không lộ số liệu thô.
// Tu vi: phần trăm tiến độ. Chăm chỉ và Tuần này: phần trăm so với người đứng đầu. Phượng hoàng và Pháp bảo: số nhỏ.
export type PublicRow = { rank: number; name: string; cls: string; realm: number; score: number }
export function publicBoard(rows: Row[], board: string, _now: number): PublicRow[] {
  const top = (k: (r: Row) => number) => Math.max(1, ...rows.map(k))
  const score = (r: Row): number => {
    switch (board) {
      case 'tu-vi': return r.pct
      case 'chamchi': return Math.floor((r.lifetimeTokens / top(x => x.lifetimeTokens)) * 100)
      case 'tuan': return Math.floor((r.week / top(x => x.week)) * 100)
      case 'phoenix': return r.deaths
      case 'phapbao': return r.artifacts
      default: return 0
    }
  }
  return rows.map((r, i) => ({ rank: i + 1, name: r.name, cls: r.cls, realm: r.realm, score: score(r) }))
}

// Khóa tạm khi sai khóa nhiều (spec 21.3): từ 20 lần sai trong cùng một giờ.
export const FAIL_LIMIT = 20
export function recordFail(st: State & { fails?: Record<string, number> }, now: number) {
  const h = HOUR_KEY(now)
  return { ...st, fails: { [h]: (st.fails?.[h] ?? 0) + 1 } }
}
export function isLocked(st: State & { fails?: Record<string, number> }, now: number): boolean {
  return (st.fails?.[HOUR_KEY(now)] ?? 0) >= FAIL_LIMIT
}

// Quyết định xác thực: khóa đúng luôn qua, để người khác không khóa được tài khoản bằng cách gửi khóa sai.
// Khi đã sai nhiều trong giờ, các lần sai tiếp theo nhận 'locked' (429) thay vì 'fail'.
export function verifyDecision(st: State & { fails?: Record<string, number> }, keyMatches: boolean, now: number): 'ok' | 'locked' | 'fail' {
  if (keyMatches) return 'ok'
  return isLocked(st, now) ? 'locked' : 'fail'
}

// ---------- Trạng thái mở rộng cho /tutien status, pane và web (không lộ số token thô) ----------
export function statusOf(st: State, now: number) {
  const today = vnDay(now)
  const h = st.history ?? {}
  const hol = holidayOn(today)
  const a = st.pills?.active ?? {}
  return {
    quest: { pct: Math.min(100, Math.floor(((h[today]?.t ?? 0) / QUEST_TOKENS) * 100)), done: st.quest?.done ?? 0 },
    bicanh: bicanhProgress(st.bicanh, h, now),
    holiday: hol ? { name: hol.name, pct: Math.min(100, Math.floor(((st.holidays?.[hol.id]?.got ?? 0) / holidayTarget(hol)) * 100)), done: !!st.holidays?.[hol.id]?.done } : null,
    pills: { bag: (st.pills?.bag ?? []).map(k => PILLS[k].name), active: [a.hoThe && 'Đan Hộ Thể', a.thongThien && 'Đan Thông Thiên', (a.tocTuUntil ?? 0) > now && 'Đan Tốc Tu'].filter(Boolean) },
    beQuanUntil: inBeQuan(st.beQuan, now) ? st.beQuan!.until : null,
    linhThach: st.linhThach ?? 0,
    inventory: st.inventory ?? [],
    equipped: st.equipped ?? null,
    badges: st.badges ?? [],
    artifacts: st.player.artifacts,
    floor: topFloor(st.floors),
    streak: streak(h, now),
    tamma: st.tamma?.active && now <= st.tamma.active.until ? { pct: Math.min(100, Math.floor((st.tamma.active.got / st.tamma.active.need) * 100)), until: st.tamma.active.until } : null,
    tammaWins: st.tamma?.wins ?? 0,
    congrats: st.congrats ?? 0,
    inbox: st.inbox ?? [],
    devices: 1 + (st.devices?.length ?? 0),
  }
}

export function historyOf(st: State, now: number) {
  const days = lastDays(st.history, now, 14)
  const top = Math.max(1, ...days.map(d => d.t))
  return { days: days.map(d => ({ day: d.day, pct: Math.round((d.t / top) * 100) })), journal: journal(st.history, now) }
}
