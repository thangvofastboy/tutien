/// <reference types="@cloudflare/workers-types" />
// Durable Object danh sách cả team: ảnh chụp từng người (bảng xếp hạng), phiên bản, và quan hệ xã hội (tông, bạn, đạo lữ, mùa).
import { sortBoards, type Row } from './logic.ts'
import {
  emptySocial, ctxFor, memberOf, tongCreate, tongJoin, tongLeave, tongAppoint, tongWeek, invite, accept, unpair,
  seasonStep, titleOf, community, teamProgress, tongBoard, thienDaoEvent, canCongrats, ROLES,
  renameSocial, removeSocial, acceptRow, congratsOnce, tongWar, teamWeek, baiSu, nhanDo, suDoHuy, disciplesOf, type Social, type Snap, type Role,
} from './social.ts'

const lc = (s: string) => s.toLowerCase()
export const snapOf = (r: Row): Snap => ({
  name: r.name, realm: r.realm, wk: r.wk ?? 0, lwk: r.lwk ?? 0, mo: r.mo ?? 0, lmo: r.lmo ?? 0,
  lastAt: r.lastAt, lastBreakthroughAt: r.lastBreakthroughAt, flagged: r.flagged,
})

// Giới hạn đăng ký mỗi giờ: theo địa chỉ (đã băm) và toàn server, chặn spam làm đầy bảng.
const REG_PER_IP = 20
const REG_GLOBAL = 300
const HOUR_MS = 3_600_000

export class RosterDO {
  constructor(private state: DurableObjectState) {
    // Chuyển khối 'rows' cũ sang mỗi người một khóa 'row:<tên thường>': /update chỉ ghi một dòng. Chạy lại được nếu bị ngắt giữa chừng.
    state.blockConcurrencyWhile(async () => {
      const legacy = await state.storage.get<Record<string, Row>>('rows')
      if (!legacy) return
      const entries = Object.values(legacy).map(r => [`row:${lc(r.name)}`, r] as const)
      // put nhiều khóa tối đa 128 khóa mỗi lần.
      for (let i = 0; i < entries.length; i += 100) await state.storage.put(Object.fromEntries(entries.slice(i, i + 100)))
      await state.storage.delete('rows')
    })
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const now = Date.now()
    // Đọc body TRƯỚC khi đọc storage: await req.json() không phải I/O storage nên cổng vào của DO mở,
    // yêu cầu khác chen vào giữa get và put được, ghi đè rows/social cũ (mất hàng, mất thành viên tông).
    const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as any) : {}
    // /update (mỗi lượt của mỗi người) và vài route nhỏ không cần cả bảng lẫn quan hệ xã hội: bỏ qua việc đọc.
    const light = url.pathname === '/update' || url.pathname === '/releases' || url.pathname === '/reg-limit'
    const rows: Record<string, Row> = {}
    if (!light) for (const r of (await this.state.storage.list<Row>({ prefix: 'row:' })).values()) rows[r.name] = r
    let social = light ? emptySocial() : ((await this.state.storage.get<Social>('social')) ?? emptySocial())
    const snaps = () => Object.values(rows).map(snapOf)
    const saveSocial = (s: Social) => this.state.storage.put('social', s)
    const find = (n: string) => Object.values(rows).find(r => lc(r.name) === lc(n))
    const realName = (n?: string) => (n ? find(n)?.name ?? n : null)

    const gone = (await this.state.storage.get<string[]>('gone')) ?? []
    if (url.pathname === '/update' && req.method === 'POST') {
      const r = body as Row
      const revive = url.searchParams.get('revive') === '1'
      if (!acceptRow(gone, r.name, revive)) return Response.json({ ok: false, gone: true })
      if (revive && gone.includes(lc(r.name))) await this.state.storage.put('gone', gone.filter(g => g !== lc(r.name)))
      await this.state.storage.put(`row:${lc(r.name)}`, r)
      return Response.json({ ok: true })
    }
    // Đăng ký quá nhanh: từ chối. Bảng đếm chỉ giữ các địa chỉ trong giờ gần nhất nên không phình ra.
    if (url.pathname === '/reg-limit' && req.method === 'POST') {
      const regs = (await this.state.storage.get<Record<string, { n: number; t: number }>>('regs')) ?? {}
      for (const [k, v] of Object.entries(regs)) if (now - v.t > HOUR_MS) delete regs[k]
      const mine = regs[body.ip] ?? { n: 0, t: now }
      if (mine.n >= REG_PER_IP || Object.values(regs).reduce((a, v) => a + v.n, 0) >= REG_GLOBAL) return Response.json({ ok: false }, { status: 429 })
      regs[body.ip] = { n: mine.n + 1, t: mine.t }
      await this.state.storage.put('regs', regs)
      return Response.json({ ok: true })
    }
    if (url.pathname === '/rename' && req.method === 'POST') {
      const old = find(body.from)
      if (old) {
        await this.state.storage.delete(`row:${lc(old.name)}`)
        await this.state.storage.put(`row:${lc(body.to)}`, { ...old, name: body.to })
      }
      // ponytail: danh sách 'gone' chỉ giữ 500 tên gần nhất (cũng áp dụng cho /remove), tên cũ hơn bị quên. Nâng cấp: tăng trần hoặc bảng riêng khi số đổi tên/xóa vượt 500.
      await this.state.storage.put('gone', [...gone.filter(g => g !== lc(body.to)), lc(body.from)].slice(-500))
      await saveSocial(renameSocial(social, body.from, body.to))
      return Response.json({ ok: true })
    }
    if (url.pathname === '/remove' && req.method === 'POST') {
      const old = find(body.name)
      if (old) await this.state.storage.delete(`row:${lc(old.name)}`)
      await this.state.storage.put('gone', [...gone, lc(body.name)].slice(-500))
      await saveSocial(removeSocial(social, body.name))
      return Response.json({ ok: true })
    }
    if (url.pathname === '/releases' && req.method === 'POST') {
      await this.state.storage.put('releases', body.releases)
      return Response.json({ ok: true })
    }
    if (url.pathname === '/releases') {
      return Response.json({ releases: (await this.state.storage.get<string[]>('releases')) ?? [] })
    }
    if (url.pathname === '/all') {
      // Ghi người thắng mùa trước ở lần đọc đầu tiên của mùa mới.
      const next = seasonStep(social, sortBoards(Object.values(rows)).tuVi[0]?.name, now)
      if (next !== social) await saveSocial(next)
      const titled = Object.values(rows).map(r => ({ ...r, title: titleOf(next, r.name, now) }))
      return Response.json({ rows: titled })
    }
    if (url.pathname === '/ctx') {
      return Response.json({ ctx: ctxFor(social, snaps(), url.searchParams.get('name') ?? '', now), partner: social.partners[lc(url.searchParams.get('name') ?? '')] ?? null })
    }
    if (url.pathname === '/team') {
      return Response.json({
        progress: teamProgress(snaps()),
        community: community(snaps()),
        tongs: tongBoard(social, snaps()),
        event: thienDaoEvent(now),
        seasons: social.seasons,
        players: Object.keys(rows).length,
        war: tongWar(social, snaps()),
        teamWeek: teamWeek(snaps()),
        recent: Object.values(rows).filter(r => r.lastBreakthroughAt && now - r.lastBreakthroughAt < 7 * 86_400_000)
          .sort((a, b) => (b.lastBreakthroughAt ?? 0) - (a.lastBreakthroughAt ?? 0)).slice(0, 10)
          .map(r => ({ name: r.name, realm: r.realm, at: r.lastBreakthroughAt })),
      })
    }
    if (url.pathname === '/tong') {
      const t = social.tongs[lc(url.searchParams.get('name') ?? '')]
      if (!t) return Response.json({ error: 'not found' }, { status: 404 })
      const w = tongWeek(t, snaps())
      return Response.json({
        name: t.name, owner: t.owner, week: { pct: w.pct, lastOk: w.lastOk },
        members: Object.entries(t.members).map(([n, role]) => ({ name: n, role: ROLES[role].name, realm: find(n)?.realm ?? 0, weak: w.weak.includes(n) })),
      })
    }
    // Hồ sơ xã hội của một người (cho /tutien status, tìm bạn tu, web).
    if (url.pathname === '/social-info') {
      const name = url.searchParams.get('name') ?? ''
      const m = memberOf(social, name)
      const w = m ? tongWeek(m.tong, snaps()) : null
      return Response.json({
        tong: m ? { name: m.tong.name, role: ROLES[m.role].name, weekPct: w!.pct, paused: !w!.lastOk || w!.weak.some(n => lc(n) === lc(name)) } : null,
        companion: realName(social.companions[lc(name)]),
        partner: realName(social.partners[lc(name)]),
        invites: social.invites.filter(i => lc(i.to) === lc(name)).map(i => ({ from: i.from, kind: i.kind })),
        title: titleOf(social, name, now) ?? null,
        master: realName(social.masters?.[lc(name)]),
        disciples: disciplesOf(social, name).map(d => realName(d)),
        linhMach: !!m && lc(tongWar(social, snaps()).lastWinner ?? '') === lc(m.tong.name),
        event: thienDaoEvent(now),
      })
    }
    if (url.pathname === '/social' && req.method === 'POST') {
      const me: string = body.me
      const meRow = find(me)
      let r: { s?: Social; error?: string; text?: string } = { error: 'Thao tác không hợp lệ.' }
      let notify: { to: string; text: string } | null = null
      switch (body.op) {
        case 'tong-tao': r = tongCreate(social, String(body.name ?? ''), me, meRow?.realm ?? 0); break
        case 'tong-vao': r = tongJoin(social, String(body.name ?? ''), me); break
        case 'tong-roi': r = tongLeave(social, me); break
        case 'tong-bo-nhiem': {
          const target = find(String(body.target ?? ''))
          r = tongAppoint(social, me, String(body.target ?? ''), body.role as Role, target?.realm ?? 0)
          if (r.s && target) notify = { to: target.name, text: `🏯 Đạo hữu được bổ nhiệm làm ${ROLES[body.role as Role].name}.` }
          break
        }
        case 'invite': {
          if (body.kind !== 'ban' && body.kind !== 'dao-lu') break
          const target = find(String(body.to ?? ''))
          if (!target) { r = { error: `Không có người chơi ${body.to}.` }; break }
          r = invite(social, me, target.name, body.kind, now)
          if (r.s) notify = { to: target.name, text: `💌 ${me} mời đạo hữu làm ${body.kind === 'ban' ? 'bạn đồng hành' : 'đạo lữ'}. Gõ /tutien ${body.kind} chap-nhan ${me}.` }
          break
        }
        case 'accept': if (body.kind !== 'ban' && body.kind !== 'dao-lu') break; r = accept(social, me, String(body.from ?? ''), body.kind); if (r.s) notify = { to: String(body.from), text: `💞 ${me} đã chấp nhận lời mời.` }; break
        case 'unpair': r = unpair(social, me, body.kind); break
        case 'bai-su': {
          const target = find(String(body.to ?? ''))
          r = baiSu(social, meRow && snapOf(meRow), target && snapOf(target), now)
          if (r.s && target) notify = { to: target.name, text: `🙇 ${me} quỳ trước động phủ xin bái sư. Gõ /tutien nhan-do ${me} để nhận.` }
          break
        }
        case 'nhan-do': r = nhanDo(social, me, String(body.from ?? '')); if (r.s) notify = { to: String(body.from), text: `🧑‍🏫 ${me} đã nhận đạo hữu làm đồ đệ! +0,5% EXP nhờ sư phụ chỉ điểm.` }; break
        case 'su-do-huy': r = suDoHuy(social, me); break
        case 'congrats': {
          const target = find(String(body.to ?? ''))
          if (!target || lc(target.name) === lc(me)) { r = { error: 'Không tìm thấy người này.' }; break }
          if (!canCongrats(snapOf(target), now)) { r = { error: `${target.name} không đột phá trong 24 giờ qua.` }; break }
          const once = congratsOnce(social, me, target.name, target.lastBreakthroughAt!)
          if (once.error) { r = { error: once.error }; break }
          r = { s: once.s, text: `🎉 Đã chúc mừng ${target.name}.` }
          notify = { to: target.name, text: `🎉 ${me} chúc mừng đạo hữu vừa đột phá!` }
          break
        }
      }
      if (r.error) return Response.json({ error: r.error }, { status: 400 })
      if (r.s && r.s !== social) { social = r.s; await saveSocial(social) }
      return Response.json({ text: r.text, notify })
    }
    return new Response('not found', { status: 404 })
  }
}
