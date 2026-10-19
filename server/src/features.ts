// server/src/features.ts — linh căn, kỳ ngộ, luận đạo, chuỗi ngày, công pháp. Hàm thuần, test bằng node:test.
import { applyUsage, need, TOKENS_PER_EXP, type Player, type Extra } from '../../hooks/rules.ts'
import { grantArtifact, randomArtifact, pushInbox, streak, type Extras, type Day, type Pill } from './extras.ts'
import { vnDay } from '../../hooks/holidays.ts'
import { cpEffects, type CongPhap } from './congphap.ts'

const DAY = 86_400_000

export type Features = {
  linhCan?: LinhCan
  kyNgo?: { id: string; at: number }
  kyNgoDay?: { day: string; n: number }
  kyNgoTotal?: number
  luanDao?: { day: string; n: number; wins: number; losses: number }
  streakClaimed?: number[]
  streakRun?: { day: string; n: number } // chuỗi ngày đếm liên tục (lịch sử chỉ giữ 90 ngày nên không đếm tới mốc 100)
  congPhap?: CongPhap
  teamWeek?: string // tuần đã báo Thiên Kiếp Đồng Tâm
  expBank?: number // EXP gộp vào lúc đang thiên phạt, cộng dần sau mỗi lần độ kiếp xong
}
type St = { player: Player; linhThach?: number; inbox?: Extras['inbox']; pills?: Extras['pills']; history?: Record<string, Day>; badges?: string[] } & Features

// ---------- Linh căn (ngũ hành theo phong cách code) ----------
export type LinhCan = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho'
export const LINH_CAN: Record<LinhCan, { name: string; icon: string; desc: string; bonus: Extra }> = {
  kim: { name: 'Kim Linh Căn', icon: '🗡️', desc: 'Kiếm tu của code: +0,5% EXP', bonus: { exp: 0.005 } },
  thuy: { name: 'Thủy Linh Căn', icon: '💧', desc: 'Dữ liệu chảy như suối: −1% token thiên phạt', bonus: { trib: 0.01 } },
  hoa: { name: 'Hỏa Linh Căn', icon: '🔥', desc: 'Terminal rực lửa: kỳ ngộ đến thường hơn', bonus: {} },
  tho: { name: 'Thổ Linh Căn', icon: '⛰️', desc: 'Test vững như núi: −0,05% tỷ lệ tử vong', bonus: { death: 0.0005 } },
  moc: { name: 'Mộc Linh Căn', icon: '🌿', desc: 'Tài liệu xanh tươi: linh thạch kỳ ngộ ×1,5', bonus: {} },
}
export const isLinhCan = (v: unknown): v is LinhCan => typeof v === 'string' && v in LINH_CAN
// Ngũ hành tương khắc: kim khắc mộc, mộc khắc thổ, thổ khắc thủy, thủy khắc hỏa, hỏa khắc kim.
export const KHAC: Record<LinhCan, LinhCan> = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' }

// ---------- Công pháp: cây riêng của từng lớp, xem congphap.ts ----------
export { congPhapOf, learn, resetCongPhap, treeView, RESET_COST } from './congphap.ts'

// Bonus của linh căn và công pháp cho một lượt (Worker cộng vào ctx).
export function featureExtra(st: St): Extra {
  const lc = st.linhCan ? LINH_CAN[st.linhCan].bonus : {}
  const cp = cpEffects(st)
  return { exp: lc.exp, trib: lc.trib, death: lc.death, pillExp: cp.exp, pillTrib: cp.trib, deathCut: cp.death }
}

// ---------- Kỳ ngộ ----------
type Outcome = { w: number; kind: 'exp' | 'lt' | 'artifact' | 'pill' | 'lose-lt' | 'nothing'; n?: number; text: string }
type Choice = { label: string; outcomes: Outcome[] }
export const KY_NGO: Record<string, { title: string; desc: string; a: Choice; b: Choice }> = {
  'linh-thao': {
    title: '🌱 Linh Thảo Bên Đường', desc: 'Một cây linh thảo phát sáng mọc cạnh file node_modules nặng 2GB.',
    a: { label: '🍵 Hái về nấu trà', outcomes: [
      { w: 6, kind: 'exp', n: 3000, text: 'Trà ngon bá cháy, tu vi tăng vọt!' },
      { w: 3, kind: 'nothing', text: 'Trà đắng như code review thứ Sáu. Không có gì xảy ra.' },
      { w: 1, kind: 'lose-lt', n: 3, text: 'Đau bụng cả buổi, tốn 3 linh thạch mua thuốc.' }] },
    b: { label: '💰 Mang ra chợ bán', outcomes: [
      { w: 7, kind: 'lt', n: 8, text: 'Thương lái trả giá hời!' },
      { w: 3, kind: 'lt', n: 2, text: 'Bị ép giá như freelancer mùa thấp điểm.' }] },
  },
  'tien-boi': {
    title: '👴 Tiền Bối Bí Ẩn', desc: 'Một lão già râu bạc hỏi: "Ngươi có biết thoát Vim không?"',
    a: { label: '⌨️ Gõ :wq thật tự tin', outcomes: [
      { w: 6, kind: 'artifact', text: 'Tiền bối gật gù, tặng một pháp bảo!' },
      { w: 4, kind: 'exp', n: 2000, text: 'Tiền bối truyền cho một ít công lực.' }] },
    b: { label: '🏃 Giả vờ không nghe', outcomes: [
      { w: 5, kind: 'nothing', text: 'Thoát được, nhưng lương tâm hơi cắn rứt.' },
      { w: 5, kind: 'lt', n: 5, text: 'Chạy vội làm rơi... của người khác. +5 linh thạch.' }] },
  },
  'ao-canh': {
    title: '🌀 Ảo Cảnh Merge Conflict', desc: 'Đạo hữu lạc vào ảo cảnh đầy <<<<<<< HEAD và >>>>>>> main.',
    a: { label: '🧘 Bình tâm resolve từng dòng', outcomes: [
      { w: 7, kind: 'exp', n: 4000, text: 'Đạo tâm kiên định, phá ảo cảnh, tu vi đại tiến!' },
      { w: 3, kind: 'exp', n: 1000, text: 'Resolve xong nhưng test đỏ. Vẫn học được chút ít.' }] },
    b: { label: '💥 git push --force', outcomes: [
      { w: 4, kind: 'lt', n: 12, text: 'Liều ăn nhiều! Ảo cảnh sụp đổ để lại linh thạch.' },
      { w: 6, kind: 'lose-lt', n: 5, text: 'Đồng môn nổi giận, phạt 5 linh thạch.' }] },
  },
  'dan-lo': {
    title: '⚗️ Đan Lô Bỏ Hoang', desc: 'Một lò luyện đan còn ấm, bên trong có gì đó lục cục.',
    a: { label: '🔥 Thổi lửa luyện tiếp', outcomes: [
      { w: 5, kind: 'pill', text: 'Ra lò một viên đan dược thơm phức!' },
      { w: 5, kind: 'lose-lt', n: 4, text: 'Nổ lò! Tóc dựng ngược, mất 4 linh thạch tiền bồi thường.' }] },
    b: { label: '🔍 Mở nắp xem trước', outcomes: [
      { w: 6, kind: 'lt', n: 6, text: 'Bên trong là linh thạch người trước để quên.' },
      { w: 4, kind: 'nothing', text: 'Một con mèo nhảy ra. Nó nhìn đạo hữu đầy khinh bỉ.' }] },
  },
  'thien-thu': {
    title: '📜 Thiên Thư Rơi Từ Trời', desc: 'Một cuốn sách rơi trúng đầu: "Clean Code — Bản Tu Tiên".',
    a: { label: '📖 Đọc hết trong một đêm', outcomes: [
      { w: 8, kind: 'exp', n: 3500, text: 'Ngộ ra chân lý: hàm nên ngắn hơn 20 dòng!' },
      { w: 2, kind: 'nothing', text: 'Ngủ gật ở chương 2. Chuyện thường.' }] },
    b: { label: '🪑 Kê chân bàn', outcomes: [
      { w: 10, kind: 'lt', n: 4, text: 'Bàn hết cập kênh, tâm trạng tốt, nhặt được 4 linh thạch dưới gầm.' }] },
  },
  'yeu-thu': {
    title: '🐉 Yêu Thú Bug Production', desc: 'Một con yêu thú hình con bug khổng lồ chặn đường lúc 2 giờ sáng.',
    a: { label: '⚔️ Rút kiếm hotfix', outcomes: [
      { w: 5, kind: 'artifact', text: 'Chém bay yêu thú, nhặt được pháp bảo!' },
      { w: 3, kind: 'exp', n: 2500, text: 'Hotfix thành công, sếp khen một câu.' },
      { w: 2, kind: 'lose-lt', n: 6, text: 'Hotfix sinh ra hai bug mới. Mất 6 linh thạch đền rollback.' }] },
    b: { label: '🛌 Để mai tính', outcomes: [
      { w: 6, kind: 'nothing', text: 'Sáng mai bug tự biến mất. Không ai hiểu vì sao.' },
      { w: 4, kind: 'lose-lt', n: 2, text: 'Bị gọi dậy lúc 3 giờ. Mất 2 linh thạch tiền cà phê.' }] },
  },
}
export const KY_NGO_CHANCE = 0.03
export const KY_NGO_PER_DAY = 3
export const KY_NGO_MIN_TOKENS = 20_000
export const KY_NGO_TTL = DAY

export function kyNgoChance(st: St): number {
  return KY_NGO_CHANCE + (st.linhCan === 'hoa' ? 0.02 : 0) + cpEffects(st).kyngo
}
// Sau một lượt: có thể gặp kỳ ngộ (không chồng lên kỳ ngộ đang chờ, tối đa 3 lần mỗi ngày).
export function maybeKyNgo(st: St, tokens: number, now: number, rng: () => number): { kyNgo?: Features['kyNgo']; kyNgoDay?: Features['kyNgoDay']; hit: boolean } {
  const day = vnDay(now)
  const today = st.kyNgoDay?.day === day ? st.kyNgoDay.n : 0
  const pending = st.kyNgo && now - st.kyNgo.at < KY_NGO_TTL
  if (pending || tokens < KY_NGO_MIN_TOKENS || today >= KY_NGO_PER_DAY || rng() >= kyNgoChance(st)) {
    return { kyNgo: pending ? st.kyNgo : undefined, kyNgoDay: st.kyNgoDay, hit: false }
  }
  const ids = Object.keys(KY_NGO)
  return { kyNgo: { id: ids[Math.floor(rng() * ids.length) % ids.length], at: now }, kyNgoDay: { day, n: today + 1 }, hit: true }
}
export function kyNgoView(st: Features, now: number) {
  if (!st.kyNgo || now - st.kyNgo.at >= KY_NGO_TTL) return null
  const k = KY_NGO[st.kyNgo.id]
  return k ? { id: st.kyNgo.id, title: k.title, desc: k.desc, a: k.a.label, b: k.b.label, until: st.kyNgo.at + KY_NGO_TTL } : null
}
const pick = <T extends { w: number }>(list: T[], r: number): T => {
  let x = r * list.reduce((a, o) => a + o.w, 0)
  for (const o of list) { x -= o.w; if (x < 0) return o }
  return list[list.length - 1]
}
// Chọn hướng a hoặc b: tung kết quả, áp phần thưởng. EXP đi qua luật như token thường (có thể khởi động thiên phạt).
export function resolveKyNgo(st: St, choice: string, now: number, rng: () => number): { state?: Partial<St>; events?: string[]; error?: string; text?: string } {
  const v = kyNgoView(st, now)
  if (!v) return { error: '🍃 Không có kỳ ngộ nào đang chờ. Cứ tu tiếp, duyên sẽ tới.' }
  if (choice !== 'a' && choice !== 'b') return { error: 'Chọn a hoặc b: /tutien ky-ngo a|b' }
  const k = KY_NGO[v.id]
  const c = choice === 'a' ? k.a : k.b
  const o = pick(c.outcomes, rng())
  let p = st.player
  let lt = st.linhThach ?? 0
  let pills = st.pills
  const events: string[] = []
  let gain = ''
  const cpLt = cpEffects(st).lt
  const ltBonus = (n: number) => Math.round(n * (st.linhCan === 'moc' ? 1.5 : 1)) + cpLt
  switch (o.kind) {
    case 'exp': {
      if (p.trib) { lt += 5; gain = '+5 linh thạch (đang thiên phạt nên EXP hóa thành linh thạch)'; break }
      const r = applyUsage(p, (o.n ?? 0) * TOKENS_PER_EXP, now, () => 0.99)
      p = r.p
      events.push(...r.events)
      gain = `+${o.n} EXP`
      break
    }
    case 'lt': { const n = ltBonus(o.n ?? 0); lt += n; gain = `+${n} linh thạch`; break }
    case 'artifact': {
      const g = grantArtifact(p, randomArtifact(rng, false), lt)
      p = g.p; lt = g.linhThach
      gain = g.converted ? '+linh thạch (pháp bảo đã chạm trần)' : '+1 pháp bảo'
      events.push(g.converted ? 'artifact-converted' : 'artifact')
      break
    }
    case 'pill': {
      const kinds: Pill[] = ['ho-the', 'toc-tu', 'thong-thien']
      pills = { ...(pills ?? { bag: [] }), bag: [...(pills?.bag ?? []), kinds[Math.floor(rng() * 3) % 3]] }
      gain = '+1 đan dược'
      break
    }
    case 'lose-lt': { const n = Math.min(lt, o.n ?? 0); lt -= n; gain = n ? `−${n} linh thạch` : 'túi rỗng nên không mất gì 😅'; break }
    case 'nothing': gain = 'không được gì, nhưng có thêm một câu chuyện để kể'
  }
  if (o.kind !== 'lose-lt' && o.kind !== 'nothing' && o.kind !== 'lt' && cpLt) { lt += cpLt; gain += ` · 📖 công pháp +${cpLt} linh thạch` }
  const total = (st.kyNgoTotal ?? 0) + 1
  let badges = st.badges ?? []
  if (total >= 10 && !badges.includes('co-duyen')) { badges = [...badges, 'co-duyen']; events.push('badge:co-duyen') }
  const text = `${k.title}\n➡️ ${c.label}\n🎲 ${o.text}\n🎁 ${gain}`
  return { state: { player: p, linhThach: lt, pills, badges, kyNgo: undefined, kyNgoTotal: total, inbox: pushInbox(st.inbox, `${k.title}: ${o.text}`, now) }, events: ['ky-ngo-done', ...events], text }
}

// ---------- Chuỗi ngày tu luyện ----------
export const STREAK_REWARDS: { days: number; kind: 'lt' | 'artifact' | 'rare' | 'badge'; n?: number; label: string }[] = [
  { days: 3, kind: 'lt', n: 5, label: '🔥 3 ngày liên tục: +5 linh thạch' },
  { days: 7, kind: 'artifact', label: '🔥🔥 7 ngày liên tục: +1 pháp bảo' },
  { days: 14, kind: 'lt', n: 20, label: '🔥🔥 14 ngày liên tục: +20 linh thạch' },
  { days: 30, kind: 'rare', label: '🔥🔥🔥 30 ngày liên tục: +1 pháp bảo hiếm' },
  { days: 100, kind: 'badge', label: '☄️ 100 ngày liên tục: danh hiệu Đạo Tâm Bất Diệt' },
]
// Chuỗi ngày hôm nay: lịch sử chỉ giữ HISTORY_DAYS ngày, nên nối tiếp bộ đếm đã lưu khi hôm qua còn trong chuỗi.
export function streakDays(st: St, now: number): number {
  // Hôm nay chưa tu lượt nào: chuỗi vẫn còn nếu hôm qua có, tính đến hôm qua thay vì báo 0 mỗi sáng.
  const at = (st.history?.[vnDay(now)]?.t ?? 0) > 0 ? now : now - DAY
  const fromHist = streak(st.history, at)
  if (!fromHist) return 0
  const run = st.streakRun
  if (run?.day === vnDay(at)) return Math.max(run.n, fromHist)
  if (run?.day === vnDay(at - DAY)) return Math.max(run.n + 1, fromHist)
  return fromHist
}
export function streakStep(st: St, now: number, rng: () => number): { state: Partial<St>; events: string[] } {
  const n = streakDays(st, now)
  // Đứt chuỗi thì mốc đã nhận được mở lại cho chuỗi mới.
  let claimed = (st.streakClaimed ?? []).filter(d => d <= n)
  let p = st.player
  let lt = st.linhThach ?? 0
  let inbox = st.inbox
  let badges = st.badges ?? []
  const events: string[] = []
  for (const r of STREAK_REWARDS) {
    if (n < r.days || claimed.includes(r.days)) continue
    claimed = [...claimed, r.days]
    if (r.kind === 'lt') lt += r.n ?? 0
    if (r.kind === 'artifact' || r.kind === 'rare') { const g = grantArtifact(p, randomArtifact(rng, r.kind === 'rare'), lt); p = g.p; lt = g.linhThach }
    if (r.kind === 'badge' && !badges.includes('dao-tam')) badges = [...badges, 'dao-tam']
    inbox = pushInbox(inbox, r.label, now)
    events.push(`streak:${r.days}`)
  }
  return { state: { streakClaimed: claimed, streakRun: n ? { day: vnDay(now), n } : undefined, player: p, linhThach: lt, inbox, badges }, events }
}

// ---------- Luận đạo ----------
export const LUAN_DAO_PER_DAY = 3
export const LUAN_DAO_WIN = 5
export const LUAN_DAO_TEACH = 2
export type Fighter = { name: string; realm: number; artifacts: number; linhCan?: LinhCan; duel?: number }
const power = (f: Fighter) => f.realm * 10 + f.artifacts * 3 + (f.duel ?? 0)
const MOVES = [
  '%s tung chiêu "Ctrl+Z Thần Công", thời gian quay ngược ba giây!',
  '%s niệm chú "It works on my machine", khiên vô hình hiện ra.',
  '%s ném ra một PR 3.000 dòng, đối thủ hoa mắt chóng mặt.',
  '%s dùng "Stack Overflow Chưởng", copy-paste như vũ bão.',
  '%s triệu hồi "Rubber Duck Thần Thú", vịt vàng kêu quạc quạc.',
  '%s bật chế độ "Dark Mode Ma Công", cả chiến trường tối sầm.',
  '%s rút "Regex Kiếm", không ai hiểu chiêu này, kể cả người tung.',
]
export function duel(a: Fighter, b: Fighter, rng: () => number): { win: boolean; log: string[] } {
  const roll = () => Math.floor(rng() * 31)
  let pa = power(a) + roll()
  let pb = power(b) + roll()
  const log: string[] = [`⚔️ Luận Đạo: ${a.name} (bậc ${a.realm}) ⚡ ${b.name} (bậc ${b.realm})`]
  if (a.linhCan && b.linhCan && KHAC[a.linhCan] === b.linhCan) { pa += 8; log.push(`${LINH_CAN[a.linhCan].icon} ${LINH_CAN[a.linhCan].name} khắc ${LINH_CAN[b.linhCan].name}! ${a.name} chiếm thượng phong.`) }
  if (a.linhCan && b.linhCan && KHAC[b.linhCan] === a.linhCan) { pb += 8; log.push(`${LINH_CAN[b.linhCan].icon} ${LINH_CAN[b.linhCan].name} khắc ${LINH_CAN[a.linhCan].name}! ${b.name} chiếm thượng phong.`) }
  const move = (who: string) => `💫 ${MOVES[Math.floor(rng() * MOVES.length) % MOVES.length].replace('%s', who)}`
  log.push(move(a.name), move(b.name))
  const win = pa >= pb
  log.push(win ? `🏆 ${a.name} thắng! ${b.name} chắp tay: "Bội phục, bội phục."` : `🥀 ${b.name} thắng! ${a.name} lặng lẽ về động phủ đọc lại docs.`)
  return { win, log }
}
export function duelCount(st: Features, now: number): { day: string; n: number; wins: number; losses: number } {
  const day = vnDay(now)
  return st.luanDao?.day === day ? st.luanDao : { day, n: 0, wins: st.luanDao?.wins ?? 0, losses: st.luanDao?.losses ?? 0 }
}

// ---------- Kho EXP (gộp nhân vật lúc đang thiên phạt) ----------
// Khi không thiên phạt: rót kho vào bậc hiện tại tới trần; đủ trần thì thiên phạt bắt đầu như thường.
// Mỗi bậc vẫn phải độ kiếp, nên kho chỉ rót tiếp sau khi đột phá xong.
export function releaseBank(p: Player, bank: number, now: number, x: Extra = {}): { p: Player; bank: number; events: string[] } {
  if (bank <= 0 || p.trib) return { p, bank, events: [] }
  const take = Math.min(bank, Math.max(0, need(p.realm) - p.exp))
  if (take <= 0) return { p, bank, events: [] }
  const r = applyUsage({ ...p, exp: p.exp + take }, 0, now, () => 0.99, x)
  return { p: r.p, bank: bank - take, events: r.events }
}
