// server/src/logic.ts — nghiệp vụ server thuần, test bằng node:test. Luật lấy từ hooks/rules.ts (một nguồn).
import { applyUsage, newPlayer, effects, REALM_NAMES, type Player } from '../../hooks/rules.ts'

export const SEEN_LIMIT = 1000
export const MAX_TOKENS_PER_TURN = 5_000_000
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
  // Client-reported: clamp to the per-turn ceiling (spec 21.1); hourly and daily caps come in the anti-cheat task.
  const tokens = Math.min(MAX_TOKENS_PER_TURN, Math.max(0, Math.floor(Number(body.tokens) || 0)))
  const { p, events } = applyUsage(st.player, tokens, now, rng)
  const day = DAY_KEY(now)
  const weekTokens: Record<string, number> = {}
  const cutoff = now - 7 * DAY_MS
  for (const [k, v] of Object.entries(st.weekTokens)) {
    if (Date.parse(k) >= cutoff - DAY_MS) weekTokens[k] = v
  }
  weekTokens[day] = (weekTokens[day] ?? 0) + tokens
  const next: State = {
    ...st,
    player: p,
    seen: [...st.seen, body.turnId].slice(-SEEN_LIMIT),
    lifetimeTokens: st.lifetimeTokens + tokens,
    weekTokens,
    deaths: st.deaths + (events.includes('death') ? 1 : 0),
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

export type Row = { name: string; cls: string; gender: string; realm: number; exp: number; lifetimeTokens: number; week: number; deaths: number; artifacts: number }

export function row(st: State, now: number): Row {
  const cutoff = now - 7 * DAY_MS
  const week = Object.entries(st.weekTokens)
    .filter(([k]) => Date.parse(k) >= cutoff - DAY_MS)
    .reduce((a, [, v]) => a + v, 0)
  return {
    name: st.name, cls: st.player.cls, gender: st.player.gender, realm: st.player.realm,
    exp: st.player.exp, lifetimeTokens: st.lifetimeTokens, week, deaths: st.deaths,
    artifacts: st.player.artifacts.length,
  }
}

// Năm bảng (spec mục 16), cùng một tập người chơi.
export function boards(states: State[], now: number) {
  return sortBoards(states.map(s => row(s, now)))
}

export function sortBoards(rows: Row[]) {
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
