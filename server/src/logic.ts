// server/src/logic.ts — nghiệp vụ server thuần, test bằng node:test. Luật lấy từ hooks/rules.ts (một nguồn).
import { applyUsage, newPlayer, effects, need, settle, REALM_NAMES, type Player } from '../../hooks/rules.ts'

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
}

export function register(name: string, cls: string, gender: string, keyHash: string): State {
  return {
    name, keyHash, player: newPlayer(cls, gender), seen: [],
    lifetimeTokens: 0, weekTokens: {}, deaths: 0, resets: 0,
  }
}

export function handleUsage(
  st: State, body: { turnId: string; tokens: number }, now: number, rng: () => number,
): { state: State; events: string[]; duplicate: boolean; invalid?: boolean } {
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

  // Trần mỗi lượt, mỗi giờ, mỗi ngày (spec 21.1): phần vượt không được cộng.
  const hour = HOUR_KEY(now)
  const day = DAY_KEY(now)
  const hourUsed = st.hourTokens?.[hour] ?? 0
  const dayUsed = st.weekTokens[day] ?? 0
  const tokens = Math.max(0, Math.min(raw, MAX_TOKENS_PER_TURN, MAX_TOKENS_PER_HOUR - hourUsed, MAX_TOKENS_PER_DAY - dayUsed))

  let { p, events } = applyUsage(st.player, tokens, now, rng)
  // Bị đánh dấu: EXP vẫn tính nhưng không vào thiên phạt, không lên bậc.
  if (suspicion >= FLAG_AT && (p.realm !== st.player.realm || (p.trib && !st.player.trib))) {
    p = { ...st.player, exp: Math.min(need(st.player.realm) - 1, st.player.exp + Math.floor(tokens / 1000)) }
    events = []
  }

  const weekTokens: Record<string, number> = {}
  const cutoff = now - 7 * DAY_MS
  for (const [k, v] of Object.entries(st.weekTokens)) {
    if (Date.parse(k) >= cutoff - DAY_MS) weekTokens[k] = v
  }
  weekTokens[day] = dayUsed + tokens
  const next: State = {
    ...st,
    player: p,
    seen: [...st.seen, body.turnId].slice(-SEEN_LIMIT),
    lifetimeTokens: st.lifetimeTokens + tokens,
    weekTokens,
    hourTokens: { [hour]: hourUsed + tokens },
    deaths: st.deaths + (events.includes('death') ? 1 : 0),
    suspicion,
    recent,
    lastAt: now,
  }
  return { state: next, events, duplicate: false }
}

export function handleReset(st: State, cls: string, gender: string): State {
  return {
    ...st,
    player: newPlayer(cls, gender),
    resets: st.resets + 1,
  }
}

export type Row = { name: string; cls: string; gender: string; realm: number; exp: number; pct: number; lifetimeTokens: number; week: number; deaths: number; artifacts: number; flagged?: boolean }

// Trạng thái đã xử lý thiên phạt quá hạn tại thời điểm đọc (GET /me, bảng xếp hạng).
export function settleState(st: State, now: number): State {
  return { ...st, player: settle(st.player, now).p }
}

export function row(st0: State, now: number): Row {
  const st = settleState(st0, now)
  const cutoff = now - 7 * DAY_MS
  const week = Object.entries(st.weekTokens)
    .filter(([k]) => Date.parse(k) >= cutoff - DAY_MS)
    .reduce((a, [, v]) => a + v, 0)
  return {
    name: st.name, cls: st.player.cls, gender: st.player.gender, realm: st.player.realm,
    exp: st.player.exp, pct: Math.min(100, Math.floor((st.player.exp / need(st.player.realm)) * 100)),
    lifetimeTokens: st.lifetimeTokens, week, deaths: st.deaths,
    artifacts: st.player.artifacts.length,
    flagged: (st.suspicion ?? 0) >= FLAG_AT,
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
