/// <reference types="@cloudflare/workers-types" />
// Durable Object một người chơi: giữ State, áp luật qua logic.ts và extras.ts.
import { mergeStates, cumulativeExp, handleUsage, handleGift, handleReset, renameLock, row, recordFail, verifyDecision, settleState, statusOf, historyOf, type State } from './logic.ts'
import {
  bicanhJoin, craftPill, usePill, beQuanStart, beQuanEnd, sellArtifact, buyItem, SHOP, pushInbox, reconcileStep,
  type Pill,
} from './extras.ts'
import { cpEffects } from './congphap.ts'
import { resolveKyNgo, learn, resetCongPhap, duel, duelCount, isLinhCan, LUAN_DAO_PER_DAY, LUAN_DAO_WIN, type Fighter } from './features.ts'
import { CLASSES as C, GENDERS as G, type Artifact } from '../../hooks/rules.ts'

const CLASSES: readonly string[] = C
const GENDERS: readonly string[] = G
const MAX_DEVICES = 5
export const LINK_MS = 24 * 60 * 60_000
const LINK_TRIES = 5
const ABSORB_COOLDOWN = 24 * 60 * 60_000

export class PlayerDO {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as any) : {}
    const st = await this.state.storage.get<State>('st')
    const now = Date.now()
    const ok = (x: unknown) => Response.json(x)
    const bad = (error: string, status = 400) => Response.json({ error }, { status })
    const save = (next: State) => this.state.storage.put('st', next)

    if (url.pathname === '/init') {
      if (st) return bad('exists', 409)
      const { register } = await import('./logic.ts')
      await save({ ...register(body.name, body.cls, body.gender, body.keyHash), accountHash: body.accountHash || undefined })
      return ok({ ok: true })
    }
    // Đổi tên: nhận nguyên trạng thái từ DO cũ (chỉ Worker gọi).
    if (url.pathname === '/import') {
      if (st) return bad('exists', 409)
      await save({ ...(body.state as State), name: body.name, renamedAt: now, renaming: undefined })
      return ok({ ok: true })
    }
    if (!st) return bad('no player', 404)

    if (url.pathname === '/verify') {
      const match = body.keyHash === st.keyHash || (st.devices ?? []).includes(body.keyHash)
      const decision = verifyDecision(st, match, now)
      if (decision === 'ok') {
        // Nhân vật cũ chưa gắn tài khoản: gắn với tài khoản của máy đang dùng khóa đúng.
        if (!st.accountHash && body.accountHash) await save({ ...st, accountHash: body.accountHash })
        return ok({ ok: true })
      }
      if (decision === 'locked') return Response.json({ ok: false, locked: true }, { status: 429 })
      await save(recordFail(st, now))
      return Response.json({ ok: false }, { status: 401 })
    }
    // Đổi khóa: khóa mới thay mọi khóa cũ, kể cả của các máy đã liên kết.
    if (url.pathname === '/rotate' && req.method === 'POST') {
      // Mã liên kết đang chờ cũng bị hủy: người giữ khóa cũ không đổi được mã lấy khóa mới.
      await save({ ...st, keyHash: body.keyHash, devices: [], link: undefined })
      return ok({ ok: true })
    }
    // Liên kết máy: máy cũ tạo mã một lần (băm), máy mới đổi mã lấy khóa riêng.
    if (url.pathname === '/link-code') {
      await save({ ...st, link: { codeHash: body.codeHash, until: now + LINK_MS, tries: 0 } })
      return ok({ ok: true, until: now + LINK_MS })
    }
    if (url.pathname === '/link') {
      const l = st.link
      if (!l || now > l.until || l.tries >= LINK_TRIES) return bad('Mã liên kết không còn hiệu lực. Tạo mã mới bằng /tutien lien-ket.', 401)
      if (!st.accountHash || body.accountHash !== st.accountHash) return bad('Máy này đăng nhập tài khoản Claude khác với chủ nhân vật; chỉ máy cùng tài khoản mới liên kết được.', 403)
      if (body.codeHash !== l.codeHash) {
        await save({ ...st, link: { ...l, tries: l.tries + 1 } })
        return bad('Mã liên kết sai.', 401)
      }
      const devices = [...(st.devices ?? []), body.keyHash].slice(-MAX_DEVICES)
      await save({ ...st, devices, link: undefined, inbox: pushInbox(st.inbox, '🔗 Một máy mới vừa liên kết với nhân vật này.', now) })
      return ok({ ok: true, player: st.player })
    }
    if (url.pathname === '/rename-lock') {
      const r = renameLock(st, now)
      if (r.error) return bad(r.error, 409)
      await save(r.state)
      return ok({ state: r.state })
    }
    // Khóa nhân vật cũ trong lúc gộp: gộp hoặc đổi tên song song bị từ chối nên trạng thái không bị chép hai lần.
    if (url.pathname === '/merge-lock' && req.method === 'POST') {
      if (st.renaming !== undefined && st.renaming > now) return bad('Nhân vật đang đổi tên hoặc gộp, thử lại sau một phút.', 409)
      await save({ ...st, renaming: now + 60_000 })
      return ok({ state: st })
    }
    if (url.pathname === '/rename-unlock') {
      await save({ ...st, renaming: undefined })
      return ok({ ok: true })
    }
    // Đang đổi tên: chỉ cho đọc và các route của chính quá trình đổi tên.
    if (st.renaming !== undefined && st.renaming > now && req.method === 'POST' && url.pathname !== '/wipe' && url.pathname !== '/verify') {
      return bad('Nhân vật đang đổi tên, thử lại sau một phút.', 409)
    }
    // Gộp nhân vật cũ của cùng tài khoản vào nhân vật này.
    if (url.pathname === '/absorb') {
      const from = body.state as State
      if (!st.accountHash || from?.accountHash !== st.accountHash) return bad('Hai nhân vật không cùng tài khoản Claude.', 403)
      // Mỗi ngày chỉ gộp một lần: nhiều nhân vật phụ không dồn hết vào một nhân vật cùng lúc để nhân hạn mức token.
      if (st.absorbedAt !== undefined && now - st.absorbedAt < ABSORB_COOLDOWN) return bad('Mỗi ngày chỉ gộp nhân vật một lần, thử lại ngày mai.', 429)
      await save({ ...mergeStates(st, from), absorbedAt: now })
      return ok({ ok: true, gained: cumulativeExp(from.player) })
    }
    if (url.pathname === '/export') return ok({ state: st })
    if (url.pathname === '/wipe') {
      await this.state.storage.deleteAll()
      return ok({ ok: true })
    }
    if (url.pathname === '/admin-clear' && req.method === 'POST') {
      await save({ ...st, suspicion: 0 })
      return ok({ ok: true })
    }
    if (url.pathname === '/me') {
      const settled = settleState(st, now)
      if (settled.player !== st.player) await save(settled)
      return ok({ player: settled.player, row: row(settled, now), status: statusOf(settled, now) })
    }
    if (url.pathname === '/status') return ok({ player: st.player, status: statusOf(st, now) })
    if (url.pathname === '/history') return ok(historyOf(st, now))
    if (url.pathname === '/usage') {
      const out = handleUsage(st, body, now, Math.random)
      if (!out.duplicate) await save(out.state)
      return ok({ player: out.state.player, events: out.events, duplicate: out.duplicate, gainedExp: out.gainedExp ?? 0 })
    }
    // Quà của đạo lữ (chỉ Worker gọi): tối đa 20.000 EXP mỗi ngày, đi qua luật như token thường.
    if (url.pathname === '/gift') {
      const r = handleGift(st, Number(body.exp) || 0, now, Math.random)
      if (r.given > 0) await save(r.state)
      return ok({ given: r.given })
    }
    if (url.pathname === '/inbox') {
      await save({ ...st, inbox: pushInbox(st.inbox, String(body.text ?? '').slice(0, 300), now), congrats: (st.congrats ?? 0) + (body.congrats ? 1 : 0) })
      return ok({ ok: true })
    }
    if (url.pathname === '/inbox-clear') {
      await save({ ...st, inbox: [] })
      return ok({ ok: true })
    }
    if (url.pathname === '/bicanh') {
      const r = bicanhJoin(st.bicanh, st.player, now)
      if (r.error) return bad(r.error)
      await save({ ...st, bicanh: r.bicanh })
      return ok({ text: '🌀 Đã ghi danh bí cảnh tháng này. Ngày 1 đến 7, mỗi ngày tu ít nhất 1.000.000 token.' })
    }
    if (url.pathname === '/pill') {
      const kind = String(body.kind) as Pill
      if (body.action === 'craft') {
        const r = craftPill(st.player, st.pills, kind)
        if (r.error) return bad(r.error)
        await save({ ...st, player: r.p!, pills: r.pills })
        return ok({ text: '⚗️ Luyện đan thành công. Dùng /tutien uong-dan ' + kind + ' khi cần.' })
      }
      const r = usePill(st.player, st.pills, kind, now)
      if (r.error) return bad(r.error)
      await save({ ...st, pills: r.pills })
      return ok({ text: '💊 Đã uống đan. Hiệu lực bắt đầu.' })
    }
    if (url.pathname === '/bequan') {
      if (body.end) {
        await save({ ...st, beQuan: beQuanEnd(st.beQuan, now) })
        return ok({ text: '🚪 Đã xuất quan. Tu luyện tiếp thôi.' })
      }
      const r = beQuanStart(st.beQuan, st.player, Number(body.days), now)
      if (r.error) return bad(r.error)
      await save({ ...st, beQuan: r.beQuan })
      return ok({ text: `🧘 Bắt đầu bế quan ${body.days} ngày. Không nhận EXP, không gặp thiên phạt hay Tâm Ma.` })
    }
    if (url.pathname === '/shop') {
      const lt = st.linhThach ?? 0
      if (body.action === 'sell') {
        const r = sellArtifact(st.player, lt, body.id as Artifact)
        if (r.error) return bad(r.error)
        await save({ ...st, player: r.p!, linhThach: r.linhThach })
        return ok({ text: `💎 Đã đổi pháp bảo. Linh thạch: ${r.linhThach}.` })
      }
      if (body.action === 'buy') {
        const r = buyItem(st.inventory, lt, String(body.id))
        if (r.error) return bad(r.error)
        await save({ ...st, inventory: r.inventory, linhThach: r.linhThach })
        return ok({ text: `🛍️ Đã mua ${SHOP[body.id].name}. Linh thạch còn ${r.linhThach}.` })
      }
      if (body.action === 'equip') {
        if (body.id && !(st.inventory ?? []).includes(String(body.id))) return bad('Đạo hữu chưa có món này.')
        await save({ ...st, equipped: body.id ? String(body.id) : undefined })
        return ok({ text: body.id ? `✨ Đã trang bị ${SHOP[body.id]?.name ?? body.id}.` : 'Đã tháo trang bị.' })
      }
      return bad('Thao tác chợ: sell, buy, equip.')
    }
    if (url.pathname === '/profile') {
      await save({ ...st, persona: typeof body.persona === 'string' ? body.persona.slice(0, 40) : st.persona, linhCan: isLinhCan(body.linhCan) ? body.linhCan : st.linhCan })
      return ok({ ok: true })
    }
    if (url.pathname === '/ky-ngo') {
      const r = resolveKyNgo(st, String(body.choice ?? ''), now, Math.random)
      if (r.error) return bad(r.error)
      const next = { ...st, ...r.state }
      await save(next)
      return ok({ text: r.text, events: r.events, player: next.player })
    }
    if (url.pathname === '/cong-phap') {
      const r: { congPhap?: State['congPhap']; linhThach?: number; error?: string; text?: string } =
        body.action === 'tay-tuy' ? resetCongPhap(st) : learn(st, String(body.id ?? ''))
      if (r.error) return bad(r.error)
      await save({ ...st, congPhap: r.congPhap, linhThach: r.linhThach ?? st.linhThach })
      return ok({ text: r.text })
    }
    // Luận đạo (Worker gọi, đã có hồ sơ hai bên): đếm lượt, tung kết quả, thưởng người thắng nếu là mình.
    if (url.pathname === '/duel') {
      const c = duelCount(st, now)
      if (c.n >= LUAN_DAO_PER_DAY) return bad(`⏳ Hôm nay đã luận đạo ${LUAN_DAO_PER_DAY} trận rồi. Mai quay lại, kẻo đối thủ ám ảnh.`)
      const r = duel(body.a as Fighter, body.b as Fighter, Math.random)
      const gain = r.win ? LUAN_DAO_WIN + cpEffects(st).lt : 0
      const wins = c.wins + (r.win ? 1 : 0)
      let badges = st.badges ?? []
      if (wins >= 10 && !badges.includes('vo-dich')) badges = [...badges, 'vo-dich']
      await save({ ...st, badges, linhThach: (st.linhThach ?? 0) + gain, luanDao: { day: c.day, n: c.n + 1, wins, losses: c.losses + (r.win ? 0 : 1) } })
      return ok({ win: r.win, log: [...r.log, r.win ? `💎 +${gain} linh thạch` : '💎 Không mất gì, chỉ mất chút sĩ diện.'] })
    }
    if (url.pathname === '/linh-thach') {
      const delta = Math.max(0, Math.min(50, Number(body.delta) || 0))
      await save({ ...st, linhThach: (st.linhThach ?? 0) + delta, inbox: body.text ? pushInbox(st.inbox, String(body.text).slice(0, 300), now) : st.inbox })
      return ok({ ok: true })
    }
    if (url.pathname === '/reconcile') {
      const day = String(body.day ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Number(body.tokens))) return bad('bad reconcile')
      const r = reconcileStep(st.history, st.reconcile, day, Math.max(0, Number(body.tokens)))
      // Nhiều máy liên kết thì transcript một máy luôn ít hơn tổng server: không cộng nghi ngờ.
      const multi = (st.devices ?? []).length > 0
      await save({ ...st, reconcile: r.reconcile, suspicion: (st.suspicion ?? 0) + (r.suspicious && !multi ? 2 : 0) })
      return ok({ ok: true })
    }
    const look = CLASSES.includes(body?.cls) && GENDERS.includes(body?.gender)
    if ((url.pathname === '/appearance' || url.pathname === '/reset') && (req.method !== 'POST' || !look)) {
      return bad('bad appearance')
    }
    if (url.pathname === '/appearance') {
      const next = { ...st, player: { ...st.player, cls: body.cls, gender: body.gender } }
      await save(next)
      return ok({ player: next.player })
    }
    if (url.pathname === '/reset') {
      const next = handleReset(st, body.cls, body.gender)
      await save(next)
      return ok({ player: next.player, resets: next.resets })
    }
    return new Response('not found', { status: 404 })
  }
}
