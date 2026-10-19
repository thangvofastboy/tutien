// server/src/extras.ts — tính năng mở rộng của một người chơi (spec 18, 20, 21.4, 24, 25). Hàm thuần, test bằng node:test.
import { effects, type Player, type Artifact, type Extra } from '../../hooks/rules.ts'
import { vnDay, holidayOn, holidayTarget } from '../../hooks/holidays.ts'

const DAY = 86_400_000
export const HISTORY_DAYS = 90
export const QUEST_TOKENS = 500_000
export const QUEST_REWARD_EVERY = 10
export const BICANH_DAILY = 1_000_000
export const GIFT_RATE = 0.02
export const GIFT_DAILY_CAP = 20_000
export const BEQUAN_MAX_DAYS = 14
export const BEQUAN_PER_QUARTER = 2
export const TOCTU_COOLDOWN = 14 * DAY
export const RECONCILE_SLACK = 0.1

export type Day = { t: number; e: number; q?: boolean; ev?: Record<string, number> }
export type Pill = 'ho-the' | 'toc-tu' | 'thong-thien'
export type Extras = {
  history?: Record<string, Day>
  quest?: { done: number }
  badges?: string[]
  bicanh?: { month: string; status: 'joined' | 'done' | 'failed' }
  holidays?: Record<string, { got: number; done?: boolean }>
  pills?: { bag: Pill[]; hoTheMajor?: number; thongThienMajor?: number; tocTuAt?: number; active?: { tocTuUntil?: number; hoThe?: boolean; thongThien?: boolean } }
  beQuan?: { until?: number; log: number[] }
  linhThach?: number
  inventory?: string[]
  equipped?: string
  inbox?: { at: number; text: string }[]
  congrats?: number
  lastBreakthroughAt?: number
  floors?: Record<string, number>
  persona?: string
  gift?: { day: string; got: number }
  reconcile?: { day: string; local: number; server: number }[]
}

// ---------- Danh mục (thư viện, spec 25) ----------
export const BADGES: Record<string, { name: string; desc: string }> = {
  'dot-pha-dau': { name: 'Lần Đầu Đột Phá', desc: 'Vượt thiên phạt lần đầu tiên' },
  'kim-dan': { name: 'Kết Đan', desc: 'Đạt Kim Đan Sơ Kỳ' },
  'hoa-than': { name: 'Hóa Thần', desc: 'Đạt Hóa Thần Sơ Kỳ' },
  'tien-de': { name: 'Tiên Đế', desc: 'Đạt Tiên Đế Sơ Kỳ' },
  'phuong-hoang': { name: 'Phượng Hoàng', desc: 'Chết một lần và tu lại từ đầu' },
  'chuyen-can-30': { name: 'Chuyên Cần', desc: '30 ngày liên tục có tu luyện' },
  'diet-tam-ma': { name: 'Diệt Tâm Ma', desc: 'Xua đuổi Tâm Ma Trễ Deadline 10 lần' },
  'nhiem-vu-10': { name: 'Chăm Làm Nhiệm Vụ', desc: 'Hoàn thành 10 nhiệm vụ ngày' },
  'dao-tam': { name: 'Đạo Tâm Bất Diệt', desc: '100 ngày liên tục có tu luyện' },
  'vo-dich': { name: 'Luận Đạo Vô Địch', desc: 'Thắng 10 trận luận đạo' },
  'co-duyen': { name: 'Cơ Duyên Thâm Hậu', desc: 'Trải qua 10 lần kỳ ngộ' },
}
export const ARTIFACTS: Record<Artifact, { name: string; desc: string }> = {
  e: { name: 'Tụ Linh Bình', desc: '+0,5% EXP' },
  t: { name: 'Phá Kiếp Phù', desc: '−1% token thiên phạt' },
  d: { name: 'Hộ Mệnh Ngọc', desc: '−0,05% tỷ lệ tử vong' },
  E: { name: 'Tụ Linh Bình Hiếm', desc: '+1,5% EXP' },
  T: { name: 'Phá Kiếp Phù Hiếm', desc: '−2,5% token thiên phạt' },
  D: { name: 'Hộ Mệnh Ngọc Hiếm', desc: '−0,1% tỷ lệ tử vong' },
}
export const PILLS: Record<Pill, { name: string; desc: string; from: 'e' | 't' | 'd' }> = {
  'ho-the': { name: 'Đan Hộ Thể', desc: 'Lần đột phá kế tiếp chỉ chịu nửa tỷ lệ chết; 1 lần mỗi đại cảnh giới', from: 'd' },
  'toc-tu': { name: 'Đan Tốc Tu', desc: '+10% EXP trong 24 giờ; 1 lần mỗi 14 ngày', from: 'e' },
  'thong-thien': { name: 'Đan Thông Thiên', desc: '−10% token thiên phạt lần kế tiếp; 1 lần mỗi đại cảnh giới', from: 't' },
}
export const SHOP: Record<string, { name: string; price: number; buyable: boolean }> = {
  'mau-ten-vang': { name: 'Màu Tên Vàng Kim', price: 20, buyable: true },
  'mau-ten-ngoc': { name: 'Màu Tên Ngọc Bích', price: 20, buyable: true },
  'khung-may': { name: 'Khung Ảnh Mây Lành', price: 30, buyable: true },
  'danh-hieu-tieu-dao': { name: 'Danh Hiệu Tiêu Dao', price: 40, buyable: true },
  'duoi-hao-quang': { name: 'Đuôi Hào Quang', price: 50, buyable: true },
  'khung-le-hoi': { name: 'Khung Lễ Hội', price: 0, buyable: false },
}
export const ARTIFACT_PRICE = { common: 10, rare: 25 }

const major = (realm: number) => Math.floor((realm - 1) / 3)
const isRare = (a: Artifact) => a === 'E' || a === 'T' || a === 'D'

// ---------- Lịch sử 90 ngày (spec 18.6) ----------
export function recordDay(h: Record<string, Day> = {}, now: number, tokens: number, exp: number, events: string[]): Record<string, Day> {
  const key = vnDay(now)
  const d: Day = { ...(h[key] ?? { t: 0, e: 0 }) }
  d.t += tokens
  d.e += exp
  if (events.length) {
    d.ev = { ...(d.ev ?? {}) }
    for (const ev of events) d.ev[ev] = (d.ev[ev] ?? 0) + 1
  }
  const cutoff = vnDay(now - (HISTORY_DAYS - 1) * DAY)
  const out: Record<string, Day> = {}
  for (const [k, v] of Object.entries(h)) if (k >= cutoff) out[k] = v
  out[key] = d
  return out
}

export function lastDays(h: Record<string, Day> = {}, now: number, n: number): { day: string; t: number; e: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const day = vnDay(now - (n - 1 - i) * DAY)
    return { day, t: h[day]?.t ?? 0, e: h[day]?.e ?? 0 }
  })
}

export function streak(h: Record<string, Day> = {}, now: number): number {
  let n = 0
  while (n < HISTORY_DAYS && (h[vnDay(now - n * DAY)]?.t ?? 0) > 0) n++
  return n
}

// Token theo tuần lịch (thứ Hai đến Chủ nhật, UTC+7) và theo tháng.
export function weekKey(now: number): string {
  const d = new Date(now + 7 * 3_600_000)
  const dow = (d.getUTCDay() + 6) % 7 // thứ Hai = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10)
}
export function sumRange(h: Record<string, Day> = {}, from: string, toExcl: string): number {
  return Object.entries(h).filter(([k]) => k >= from && k < toExcl).reduce((a, [, v]) => a + v.t, 0)
}
export const nextDayKey = (key: string, n: number) => new Date(Date.parse(key) + n * DAY).toISOString().slice(0, 10)

// ---------- Nhiệm vụ ngày (spec 18.4) ----------
export function questStep(h: Record<string, Day>, quest: { done: number } | undefined, now: number) {
  const key = vnDay(now)
  const d = h[key]
  const q = { done: quest?.done ?? 0 }
  if (!d || d.q || d.t < QUEST_TOKENS) return { history: h, quest: q, reward: false, completed: false }
  q.done += 1
  return { history: { ...h, [key]: { ...d, q: true } }, quest: q, reward: q.done % QUEST_REWARD_EVERY === 0, completed: true }
}

// ---------- Thành tựu (spec 18.5) ----------
export function newBadges(have: string[] = [], p: Player, events: string[], h: Record<string, Day> | undefined, now: number, tammaWins: number, questDone: number): string[] {
  const got = new Set(have)
  const add: string[] = []
  const give = (id: string, cond: boolean) => { if (cond && !got.has(id)) { got.add(id); add.push(id) } }
  give('dot-pha-dau', events.includes('breakthrough'))
  give('kim-dan', p.realm >= 7)
  give('hoa-than', p.realm >= 13)
  give('tien-de', p.realm >= 31)
  give('phuong-hoang', events.includes('death'))
  give('chuyen-can-30', streak(h, now) >= 30)
  give('diet-tam-ma', tammaWins >= 10)
  give('nhiem-vu-10', questDone >= 10)
  return add
}

// ---------- Pháp bảo: thêm, đổi thành linh thạch khi đã chạm trần (spec 24.3) ----------
export function capReached(p: Player, a: Artifact): boolean {
  const m0 = effects(p)
  const kind = a.toLowerCase()
  const m1 = effects({ ...p, artifacts: [...p.artifacts, a] })
  if (kind === 'e') return m1.expMult === m0.expMult
  if (kind === 't') return m1.tribMult === m0.tribMult
  return m1.deathChance === m0.deathChance
}
export function grantArtifact(p: Player, a: Artifact, linhThach = 0): { p: Player; linhThach: number; converted: boolean } {
  if (capReached(p, a)) return { p, linhThach: linhThach + (isRare(a) ? ARTIFACT_PRICE.rare : ARTIFACT_PRICE.common), converted: true }
  return { p: { ...p, artifacts: [...p.artifacts, a] }, linhThach, converted: false }
}
export const randomArtifact = (rng: () => number, rare: boolean): Artifact => {
  const k = (['e', 't', 'd'] as const)[Math.floor(rng() * 3) % 3]
  return (rare ? k.toUpperCase() : k) as Artifact
}

// ---------- Bí cảnh hằng tháng (spec 18.7) ----------
export function bicanhJoin(b: Extras['bicanh'], p: Player, now: number): { bicanh?: Extras['bicanh']; error?: string } {
  const today = vnDay(now)
  const month = today.slice(0, 7)
  const dom = Number(today.slice(8, 10))
  if (b?.month === month) return { error: 'Đạo hữu đã ghi danh bí cảnh tháng này rồi.' }
  if (dom > 2) return { error: 'Chỉ ghi danh được vào ngày 1 và ngày 2 của tháng.' }
  if (p.trib) return { error: 'Đang thiên phạt thì không ghi danh bí cảnh được.' }
  return { bicanh: { month, status: 'joined' } }
}
// Đánh giá: ngày đã qua phải có ít nhất 1 triệu token; qua ngày 7 mà đủ thì hoàn thành.
export function bicanhStep(b: Extras['bicanh'], h: Record<string, Day> = {}, now: number): { bicanh?: Extras['bicanh']; result?: 'done' | 'failed' } {
  if (!b || b.status !== 'joined') return { bicanh: b }
  const today = vnDay(now)
  const days = [1, 2, 3, 4, 5, 6, 7].map(d => `${b.month}-${String(d).padStart(2, '0')}`)
  const past = days.filter(d => d < today)
  if (past.some(d => (h[d]?.t ?? 0) < BICANH_DAILY)) return { bicanh: { ...b, status: 'failed' }, result: 'failed' }
  if (past.length === 7) return { bicanh: { ...b, status: 'done' }, result: 'done' }
  return { bicanh: b }
}
export function bicanhProgress(b: Extras['bicanh'], h: Record<string, Day> = {}, now: number): string | null {
  if (!b) return null
  if (b.status === 'done') return `Bí cảnh ${b.month}: hoàn thành`
  if (b.status === 'failed') return `Bí cảnh ${b.month}: thất bại`
  const today = vnDay(now)
  const pct = Math.min(100, Math.floor(((h[today]?.t ?? 0) / BICANH_DAILY) * 100))
  return `Bí cảnh ${b.month}: hôm nay ${pct}%`
}

// ---------- Bí cảnh lễ hội (spec 24.2): token khi đang thiên phạt không tính ----------
export function holidayStep(hs: Extras['holidays'] = {}, now: number, tokens: number, inTrib: boolean) {
  const h = holidayOn(vnDay(now))
  if (!h || inTrib || tokens <= 0) return { holidays: hs, done: null as null | { id: string; name: string } }
  const cur = hs[h.id] ?? { got: 0 }
  if (cur.done) return { holidays: hs, done: null }
  const got = cur.got + tokens
  const done = got >= holidayTarget(h)
  return { holidays: { ...hs, [h.id]: { got, done } }, done: done ? { id: h.id, name: h.name } : null }
}

// ---------- Luyện đan (spec 18.8) ----------
export function craftPill(p: Player, pills: Extras['pills'], kind: Pill): { p?: Player; pills?: Extras['pills']; error?: string } {
  const bag = pills?.bag ?? []
  if (!Object.hasOwn(PILLS, kind)) return { error: 'Loại đan: ho-the, toc-tu, thong-thien.' } // 'constructor' không lọt
  if (bag.length >= 2) return { error: 'Túi chỉ giữ tối đa 2 viên đan.' }
  const from = PILLS[kind].from
  const idx = p.artifacts.indexOf(from) >= 0 ? p.artifacts.indexOf(from) : p.artifacts.indexOf(from.toUpperCase() as Artifact)
  if (idx < 0) return { error: `Cần một ${ARTIFACTS[from].name} để luyện ${PILLS[kind].name}.` }
  const artifacts = p.artifacts.filter((_, i) => i !== idx)
  return { p: { ...p, artifacts }, pills: { ...(pills ?? {}), bag: [...bag, kind] } }
}
export function usePill(p: Player, pills: Extras['pills'], kind: Pill, now: number): { pills?: Extras['pills']; error?: string } {
  const bag = pills?.bag ?? []
  const i = bag.indexOf(kind)
  if (i < 0) return { error: `Trong túi không có ${PILLS[kind]?.name ?? 'viên đan này'}.` }
  const a = pills?.active ?? {}
  if ((a.tocTuUntil ?? 0) > now || a.hoThe || a.thongThien) return { error: 'Đang có một viên đan còn hiệu lực.' }
  const next = { ...(pills ?? {}), bag: bag.filter((_, j) => j !== i), active: { ...a } }
  if (kind === 'ho-the') {
    if (pills?.hoTheMajor === major(p.realm)) return { error: 'Đan Hộ Thể chỉ dùng một lần mỗi đại cảnh giới.' }
    next.hoTheMajor = major(p.realm); next.active.hoThe = true
  } else if (kind === 'thong-thien') {
    if (pills?.thongThienMajor === major(p.realm)) return { error: 'Đan Thông Thiên chỉ dùng một lần mỗi đại cảnh giới.' }
    next.thongThienMajor = major(p.realm); next.active.thongThien = true
  } else {
    if (pills?.tocTuAt !== undefined && now - pills.tocTuAt < TOCTU_COOLDOWN) return { error: 'Đan Tốc Tu chỉ dùng một lần mỗi 14 ngày.' }
    next.tocTuAt = now; next.active.tocTuUntil = now + DAY
  }
  return { pills: next }
}
export function pillExtra(pills: Extras['pills'], now: number): Extra {
  const a = pills?.active ?? {}
  return { pillExp: (a.tocTuUntil ?? 0) > now ? 0.1 : 0, pillTrib: a.thongThien ? 0.1 : 0, halfDeath: !!a.hoThe }
}
// Đan một lần: Hộ Thể hết khi đột phá, Thông Thiên hết khi thiên phạt bắt đầu.
export function pillAfter(pills: Extras['pills'], events: string[]): Extras['pills'] {
  if (!pills?.active) return pills
  const active = { ...pills.active }
  if (events.includes('breakthrough')) active.hoThe = false
  if (events.includes('tribulation-started')) active.thongThien = false
  return { ...pills, active }
}

// ---------- Bế quan (spec 20.1) ----------
const quarter = (now: number) => { const d = vnDay(now); return `${d.slice(0, 4)}-${Math.floor((Number(d.slice(5, 7)) - 1) / 3)}` }
export const inBeQuan = (b: Extras['beQuan'], now: number) => (b?.until ?? 0) > now
export function beQuanStart(b: Extras['beQuan'], p: Player, days: number, now: number): { beQuan?: Extras['beQuan']; error?: string } {
  if (!Number.isInteger(days) || days < 1 || days > BEQUAN_MAX_DAYS) return { error: `Số ngày bế quan từ 1 đến ${BEQUAN_MAX_DAYS}.` }
  if (p.trib) return { error: 'Đang thiên phạt thì không bế quan được.' }
  if (inBeQuan(b, now)) return { error: 'Đạo hữu đang bế quan rồi.' }
  const log = (b?.log ?? []).filter(t => quarter(t) === quarter(now))
  if (log.length >= BEQUAN_PER_QUARTER) return { error: `Mỗi quý chỉ bế quan tối đa ${BEQUAN_PER_QUARTER} lần.` }
  return { beQuan: { until: now + days * DAY, log: [...log, now] } }
}
export const beQuanEnd = (b: Extras['beQuan'], now: number): Extras['beQuan'] => ({ log: b?.log ?? [], until: Math.min(b?.until ?? 0, now) })

// ---------- Tháp Thử Luyện (spec 20.3): tầng k ứng với bậc 3k+1 ----------
export function floorsStep(f: Record<string, number> = {}, realm: number, now: number): Record<string, number> {
  const out = { ...f }
  for (let k = 1; k <= 10; k++) if (realm >= 3 * k + 1 && out[k] === undefined) out[k] = now
  return out
}
export const topFloor = (f: Record<string, number> = {}) => Math.max(0, ...Object.keys(f).map(Number))

// ---------- Đạo lữ (spec 18.9): nhận tối đa 20.000 EXP mỗi ngày ----------
export function giftStep(g: Extras['gift'], amount: number, now: number): { gift: { day: string; got: number }; give: number } {
  const day = vnDay(now)
  const got = g?.day === day ? g.got : 0
  const give = Math.max(0, Math.min(Math.floor(amount), GIFT_DAILY_CAP - got))
  return { gift: { day, got: got + give }, give }
}

// ---------- Chợ phường thị (spec 20.2) ----------
export function sellArtifact(p: Player, lt: number, a: Artifact): { p?: Player; linhThach?: number; error?: string } {
  const i = p.artifacts.indexOf(a)
  if (!ARTIFACTS[a] || i < 0) return { error: 'Không có pháp bảo này.' }
  return { p: { ...p, artifacts: p.artifacts.filter((_, j) => j !== i) }, linhThach: lt + (isRare(a) ? ARTIFACT_PRICE.rare : ARTIFACT_PRICE.common) }
}
export function buyItem(inv: string[] = [], lt: number, id: string): { inventory?: string[]; linhThach?: number; error?: string } {
  const item = SHOP[id]
  if (!item || !item.buyable) return { error: 'Không có món này trong chợ.' }
  if (inv.includes(id)) return { error: 'Đạo hữu đã có món này.' }
  if (lt < item.price) return { error: `Cần ${item.price} linh thạch, đạo hữu đang có ${lt}.` }
  return { inventory: [...inv, id], linhThach: lt - item.price }
}

// ---------- Hộp thư (chúc mừng, lời mời, thông báo tông) ----------
// ponytail: hộp thư chỉ giữ 20 tin gần nhất, tin cũ bị cắt âm thầm. Nâng cấp: lưu theo trang khi cần đọc lại lâu hơn.
export const pushInbox = (inbox: Extras['inbox'] = [], text: string, now: number) => [...inbox, { at: now, text }].slice(-20)

// ---------- Đối chiếu transcript (spec 21.4): server cao hơn máy quá 10% thì nghi ngờ ----------
export function reconcileStep(h: Record<string, Day> = {}, r: Extras['reconcile'] = [], day: string, local: number): { reconcile: NonNullable<Extras['reconcile']>; suspicious: boolean } {
  const server = h[day]?.t ?? 0
  // ponytail: chỉ đối chiếu 30 ngày gần nhất, ngày cũ hơn không còn được kiểm tra. Nâng cấp: tăng trần khi cần soát lại lâu hơn.
  const next = [...r.filter(x => x.day !== day), { day, local, server }].slice(-30)
  return { reconcile: next, suspicious: server > local * (1 + RECONCILE_SLACK) + 50_000 }
}

// ---------- Nhật ký tuần (spec 20.3): tóm tắt từ mẫu, không gọi model ----------
export function journal(h: Record<string, Day> = {}, now: number): string[] {
  const days = lastDays(h, now, 7)
  const ev = (name: string) => days.reduce((a, d) => a + (h[d.day]?.ev?.[name] ?? 0), 0)
  const active = days.filter(d => d.t > 0).length
  const quests = days.filter(d => h[d.day]?.q).length
  const out = [`📖 Nhật Ký Tu Luyện 7 Ngày Qua`, `• Tu luyện ${active}/7 ngày, hoàn thành ${quests} nhiệm vụ ngày.`]
  if (ev('breakthrough')) out.push(`• ✨ Đột phá ${ev('breakthrough')} lần.`)
  if (ev('tribulation-started')) out.push(`• ⚡ Gặp thiên phạt ${ev('tribulation-started')} lần, thất bại ${ev('tribulation-failed')} lần.`)
  if (ev('tamma')) out.push(`• 👹 Tâm Ma hiện ${ev('tamma')} lần, bị xua đuổi ${ev('tamma-defeated')} lần.`)
  if (ev('death')) out.push(`• 💀 Đan điền vỡ ${ev('death')} lần. Phượng hoàng tái sinh!`)
  if (out.length === 2) out.push('• Một tuần yên bình. Thiên đạo gật gù.')
  return out
}
