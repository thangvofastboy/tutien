/// <reference types="@cloudflare/workers-types" />
// Worker: định tuyến và xác thực khóa. Luật nằm trong logic.ts, extras.ts, social.ts và hooks/rules.ts.
import { PlayerDO, LINK_MS } from './player.ts'
import { LUAN_DAO_TEACH } from './features.ts'
import { MASTER_REWARD } from './social.ts'
import { RosterDO } from './roster.ts'
import { CLASSES as C, GENDERS as G, REALM_NAMES } from '../../hooks/rules.ts'
import { upcomingHolidays } from '../../hooks/holidays.ts'
import { sortBoards, publicBoard, versionAllowed, addRelease, validTurnId, type Row } from './logic.ts'
import { ARTIFACTS, PILLS, BADGES, SHOP, GIFT_RATE } from './extras.ts'
import { ROLES } from './social.ts'
import { renderWeb } from './web.ts'

export { PlayerDO, RosterDO }

// Danh sách bản phát hành được đọc ở mỗi yêu cầu ghi: nhớ 15 giây trong isolate để khỏi gọi RosterDO mỗi lần.
// ponytail: isolate khác có thể thấy bản cũ tối đa 15 giây sau khi admin đăng ký tag mới.
let releaseCache: { at: number; v: string[] } | null = null
const RELEASE_CACHE_MS = 15_000

export interface Env {
  PLAYER: DurableObjectNamespace
  ROSTER: DurableObjectNamespace
  ADMIN_TOKEN?: string
  WEBHOOK_URL?: string // Slack hoặc Discord (spec 18.3), đặt bằng wrangler secret
  ASSETS?: Fetcher // ảnh nhân vật cho trang web (spec 26)
}

const CLASSES: readonly string[] = C
const GENDERS: readonly string[] = G
const NAME = /^[\p{L}\p{N}_-]{1,24}$/u
const BOARDS = { 'tu-vi': 'tuVi', chamchi: 'chamChi', tuan: 'tuan', phoenix: 'phoenix', phapbao: 'phapBao' } as const
// Only these player routes are reachable from outside; DO-internal routes (/init, /verify, /gift, /export…) are not.
const PLAYER_ROUTES: Record<string, 'GET' | 'POST'> = {
  '/usage': 'POST', '/appearance': 'POST', '/reset': 'POST', '/me': 'GET', '/rotate-key': 'POST',
  '/status': 'GET', '/history': 'GET', '/bicanh': 'POST', '/pill': 'POST', '/bequan': 'POST', '/shop': 'POST',
  '/profile': 'POST', '/reconcile': 'POST', '/link-code': 'POST', '/social': 'POST', '/rename': 'POST', '/merge': 'POST', '/inbox-clear': 'POST',
  '/ky-ngo': 'POST', '/cong-phap': 'POST', '/luan-dao': 'POST',
}

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
const validLook = (b: any) => CLASSES.includes(b?.cls) && GENDERS.includes(b?.gender)
// Mã liên kết 8 ký tự, không có ký tự dễ nhầm (0/O, 1/I).
// Mã tài khoản Claude (accountUuid trong ~/.claude.json) chỉ lưu dạng băm.
const accountHash = async (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{16,64}$/i.test(v) ? sha256(`tutien-account:${v.toLowerCase()}`) : '')
const linkCode = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const now = Date.now()
    const json = (x: unknown, status = 200) => Response.json(x, { status })
    const playerStub = (name: string) => env.PLAYER.get(env.PLAYER.idFromName(name.toLowerCase()))
    const roster = env.ROSTER.get(env.ROSTER.idFromName('team'))
    const rosterJson = async <T>(path: string, init?: RequestInit) => (await (await roster.fetch(`https://do${path}`, init)).json()) as T
    const releases = async () => {
      if (releaseCache && now - releaseCache.at < RELEASE_CACHE_MS) return releaseCache.v
      const v = (await rosterJson<{ releases: string[] }>('/releases')).releases
      releaseCache = { at: now, v }
      return v
    }
    const allRows = async () => (await rosterJson<{ rows: (Row & { title?: string })[] }>('/all')).rows
    const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
    const isAdmin = () => !!env.ADMIN_TOKEN && req.headers.get('authorization') === `Bearer ${env.ADMIN_TOKEN}`

    if (url.pathname === '/admin/releases' && req.method === 'POST') {
      // Fail closed: an unset secret must not match "Bearer undefined".
      if (!isAdmin()) return json({ error: 'forbidden' }, 403)
      const { tag } = ((await req.json().catch(() => null)) ?? {}) as { tag: string }
      if (!/^v\d+\.\d+\.\d+$/.test(tag)) return json({ error: 'bad tag' }, 400)
      const next = addRelease(await releases(), tag)
      await roster.fetch('https://do/releases', post({ releases: next }))
      releaseCache = { at: now, v: next }
      return json({ releases: next })
    }

    if (url.pathname === '/admin/clear' && req.method === 'POST') {
      if (!isAdmin()) return json({ error: 'forbidden' }, 403)
      const { name } = ((await req.json().catch(() => null)) ?? {}) as { name: string }
      if (typeof name !== 'string' || !NAME.test(name)) return json({ error: 'bad name' }, 400)
      const res = await playerStub(name).fetch('https://do/admin-clear', post({}))
      return json({ ok: res.ok }, res.ok ? 200 : 404)
    }

    // ---------- Đọc công khai: bảng, team, hồ sơ, thư viện, trang web ----------
    if (url.pathname === '/leaderboard' && req.method === 'GET') {
      const boardName = url.searchParams.get('board') ?? 'tu-vi'
      const me = (url.searchParams.get('me') ?? '').toLowerCase()
      const rows = await allRows()
      let pub: { rank: number; name: string; cls: string; realm: number; score: number }[]
      if (boardName === 'tong') {
        const team = await rosterJson<{ tongs: { rank: number; name: string; members: number; power: number }[] }>('/team')
        pub = team.tongs.map(t => ({ rank: t.rank, name: t.name, cls: `${t.members} người`, realm: 0, score: t.power }))
      } else if (boardName === 'thap') {
        const ranked = rows.filter(r => !r.flagged && (r.floor ?? 0) > 0)
          .sort((a, b) => (b.floor ?? 0) - (a.floor ?? 0) || (a.floorAt ?? 0) - (b.floorAt ?? 0))
        pub = ranked.map((r, i) => ({ rank: i + 1, name: r.name, cls: r.cls, realm: r.realm, score: (r.floor ?? 0) * 10 }))
      } else if (boardName === 'canh-gioi') {
        const major = Number(url.searchParams.get('major') ?? 0)
        const ranked = sortBoards(rows).tuVi.filter(r => Math.floor((r.realm - 1) / 3) === major)
        pub = ranked.map((r, i) => ({ rank: i + 1, name: r.name, cls: r.cls, realm: r.realm, score: r.pct }))
      } else {
        const board = BOARDS[boardName as keyof typeof BOARDS]
        if (!board) return json({ error: 'unknown board' }, 400)
        pub = publicBoard(sortBoards(rows)[board], boardName, now)
      }
      const mine = me ? pub.find(r => r.name.toLowerCase() === me && r.rank > 10) : undefined
      return json({ rows: mine ? [...pub.slice(0, 10), mine] : pub.slice(0, 10) })
    }
    if (url.pathname === '/team' && req.method === 'GET') {
      return json({ ...(await rosterJson<object>('/team')), holidays: upcomingHolidays(now, 45) })
    }
    // Tìm bạn tu (spec 25): không lộ EXP hay token.
    if (url.pathname === '/find' && req.method === 'GET') {
      const name = url.searchParams.get('name') ?? ''
      const r = (await allRows()).find(x => x.name.toLowerCase() === name.toLowerCase())
      if (!r || r.flagged) return json({ error: 'not found' }, 404)
      const social = await rosterJson<any>(`/social-info?name=${encodeURIComponent(r.name)}`)
      return json({
        name: r.name, cls: r.cls, gender: r.gender, persona: r.persona ?? null, realm: r.realm, realmName: REALM_NAMES[r.realm - 1],
        pct: r.pct, trib: r.trib ?? null, badges: r.badges ?? [], equipped: r.equipped ?? null, title: r.title ?? null,
        tong: social.tong ? { name: social.tong.name, role: social.tong.role } : null, floor: r.floor ?? 0,
      })
    }
    if (url.pathname === '/library' && req.method === 'GET') {
      return json({ artifacts: ARTIFACTS, pills: PILLS, badges: BADGES, shop: SHOP, roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { name: v.name, slots: v.slots, minRealm: v.minRealm, desc: v.desc }])), holidays: upcomingHolidays(now, 365) })
    }
    if (url.pathname === '/tong-info' && req.method === 'GET') {
      return roster.fetch(`https://do/tong?name=${encodeURIComponent(url.searchParams.get('name') ?? '')}`)
    }
    if (req.method === 'GET') {
      const page = await renderWeb(url, { allRows, team: () => rosterJson('/team'), tong: (n: string) => rosterJson(`/tong?name=${encodeURIComponent(n)}`), assets: env.ASSETS, req })
      if (page) return page
    }

    // Every write path below requires a current mod build (spec 21.5).
    if (!versionAllowed(await releases(), req.headers.get('x-tutien-version') ?? '')) {
      return json({ error: 'upgrade required', message: 'Server chưa nhận phiên bản mod này. Chạy /tutien update; nếu đã là bản mới nhất, chờ admin đăng ký phiên bản trên server.' }, 426)
    }

    if (url.pathname === '/register' && req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as any
      if (typeof body?.name !== 'string' || !NAME.test(body.name)) return json({ error: 'bad name' }, 400)
      if (!validLook(body)) return json({ error: 'bad appearance' }, 400)
      const ip = (await sha256(req.headers.get('cf-connecting-ip') ?? 'unknown')).slice(0, 16)
      if ((await roster.fetch('https://do/reg-limit', post({ ip }))).status === 429) return json({ error: 'Đăng ký quá nhiều trong một giờ, thử lại sau.' }, 429)
      const key = crypto.randomUUID()
      const res = await playerStub(body.name).fetch('https://do/init', post({ name: body.name, cls: body.cls, gender: body.gender, keyHash: await sha256(key), accountHash: await accountHash(req.headers.get('x-tutien-account')) }))
      if (res.status === 409) return json({ error: 'name taken' }, 409)
      // Có mặt trong danh sách ngay, để người khác tìm, mời và xếp hạng được.
      const me = (await (await playerStub(body.name).fetch('https://do/me')).json()) as { row?: Row }
      if (me.row) await roster.fetch('https://do/update?revive=1', post(me.row))
      return json({ key }, 201)
    }
    // Liên kết máy mới bằng mã một lần: máy mới nhận khóa riêng của nó.
    if (url.pathname === '/link' && req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as any
      if (typeof body?.name !== 'string' || !NAME.test(body.name) || typeof body?.code !== 'string') return json({ error: 'bad link' }, 400)
      const key = crypto.randomUUID()
      const res = await playerStub(body.name).fetch('https://do/link', post({ codeHash: await sha256(body.code.trim().toUpperCase()), keyHash: await sha256(key), accountHash: await accountHash(req.headers.get('x-tutien-account')) }))
      if (!res.ok) return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } })
      return json({ key, ...((await res.json()) as object) })
    }

    const method = PLAYER_ROUTES[url.pathname]
    if (!method) return json({ error: 'not found' }, 404)
    // Each route has exactly one method; validation below runs for every write, never skipped by method.
    if (req.method !== method) return json({ error: 'method not allowed' }, 405)

    const auth = req.headers.get('authorization') ?? ''
    const key = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const name = url.searchParams.get('name')
    if (!key || !name || !NAME.test(name)) return json({ error: 'unauthorized' }, 401)
    const stub = playerStub(name)
    const verify = await stub.fetch('https://do/verify', post({ keyHash: await sha256(key), accountHash: await accountHash(req.headers.get('x-tutien-account')) }))
    if (verify.status === 429) return json({ error: 'locked', message: 'Sai khóa quá nhiều lần trong giờ này; chỉ khóa đúng mới được chấp nhận.' }, 429)
    if (verify.status !== 200) return json({ error: 'unauthorized' }, 401)
    const refreshRow = async (s: DurableObjectStub = stub, known?: Row) => {
      const r = known ?? ((await (await s.fetch('https://do/me')).json()) as { row?: Row }).row
      if (r) await roster.fetch('https://do/update', post(r))
    }

    if (url.pathname === '/rotate-key') {
      const fresh = crypto.randomUUID()
      await stub.fetch('https://do/rotate', post({ keyHash: await sha256(fresh) }))
      return json({ key: fresh })
    }
    if (url.pathname === '/link-code') {
      const code = linkCode()
      await stub.fetch('https://do/link-code', post({ codeHash: await sha256(code) }))
      return json({ code, minutes: LINK_MS / 60_000 })
    }

    let body: any = undefined
    if (req.method === 'POST') {
      body = (await req.json().catch(() => null)) ?? {}
      if (url.pathname === '/usage' && (!validTurnId(body?.turnId) || !Number.isFinite(Number(body?.tokens)))) {
        return json({ error: 'bad usage' }, 400)
      }
      if ((url.pathname === '/appearance' || url.pathname === '/reset') && !validLook(body)) {
        return json({ error: 'bad appearance' }, 400)
      }
    }

    // Quan hệ xã hội: RosterDO quyết định, người nhận được thông báo qua hộp thư.
    if (url.pathname === '/social') {
      const res = await roster.fetch('https://do/social', post({ ...body, me: name }))
      const out = (await res.json()) as { text?: string; error?: string; notify?: { to: string; text: string } | null }
      if (out.notify) await playerStub(out.notify.to).fetch('https://do/inbox', post({ text: out.notify.text, congrats: body.op === 'congrats' }))
      return json(out, res.status)
    }

    // Luận đạo: Worker lấy hồ sơ công khai hai bên, DO người thách đấu tung kết quả và đếm lượt.
    if (url.pathname === '/luan-dao') {
      const rows = await allRows()
      const me = rows.find(r => r.name.toLowerCase() === name.toLowerCase())
      const foe = rows.find(r => r.name.toLowerCase() === String(body?.target ?? '').toLowerCase())
      if (me?.flagged) return json({ error: 'Nhân vật đang bị đánh dấu, chờ admin xem xét.' }, 403)
      if (!me || !foe || foe.flagged) return json({ error: `Không tìm thấy đạo hữu "${body?.target ?? ''}".` }, 404)
      if (foe.name.toLowerCase() === name.toLowerCase()) return json({ error: '🪞 Tự đánh với bóng mình trong gương? Thắng cũng không vẻ vang gì.' }, 400)
      const fighter = (r: Row) => ({ name: r.name, realm: r.realm, artifacts: r.artifacts, linhCan: r.linhCan, duel: r.duel })
      const res = await stub.fetch('https://do/duel', post({ a: fighter(me), b: fighter(foe) }))
      const out = (await res.json()) as { win?: boolean; log?: string[]; error?: string }
      if (!res.ok) return json(out, res.status)
      const foeStub = playerStub(foe.name)
      await foeStub.fetch('https://do/linh-thach', post({
        delta: out.win ? 0 : LUAN_DAO_TEACH,
        text: out.win ? `⚔️ ${name} đến luận đạo và thắng đạo hữu. Phục thù đi: /tutien luan-dao ${name}` : `⚔️ ${name} đến luận đạo và thua đạo hữu. +${LUAN_DAO_TEACH} linh thạch phí chỉ giáo.`,
      }))
      await refreshRow()
      return json({ text: (out.log ?? []).join('\n'), win: out.win })
    }

    // Gộp: nhân vật đang xác thực (cũ) chuyển hết sang nhân vật `into` (khóa của máy này đã liên kết), rồi bị xóa.
    if (url.pathname === '/merge') {
      const into = String(body?.into ?? '')
      if (!NAME.test(into) || into.toLowerCase() === name.toLowerCase() || typeof body?.intoKey !== 'string') return json({ error: 'bad merge' }, 400)
      const target = playerStub(into)
      const ok = await target.fetch('https://do/verify', post({ keyHash: await sha256(body.intoKey), accountHash: await accountHash(req.headers.get('x-tutien-account')) }))
      if (ok.status !== 200) return json({ error: 'unauthorized target' }, 401)
      const lock = await stub.fetch('https://do/merge-lock', post({}))
      if (!lock.ok) return new Response(lock.body, { status: lock.status, headers: { 'content-type': 'application/json' } })
      const exp = (await lock.json()) as { state?: any }
      if (!exp.state) {
        await stub.fetch('https://do/rename-unlock', post({}))
        return json({ error: 'no player' }, 404)
      }
      const res = await target.fetch('https://do/absorb', post({ state: exp.state }))
      if (!res.ok) {
        await stub.fetch('https://do/rename-unlock', post({}))
        return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } })
      }
      await stub.fetch('https://do/wipe', post({}))
      await roster.fetch('https://do/remove', post({ name }))
      await refreshRow(target)
      return json({ merged: name, into, ...((await res.json()) as object) })
    }

    // Đổi tên: chép trạng thái sang DO mới, xóa DO cũ, cập nhật bảng và quan hệ.
    if (url.pathname === '/rename') {
      const to = String(body?.to ?? '')
      if (!NAME.test(to)) return json({ error: 'Tên mới 1–24 ký tự: chữ, số, gạch dưới hoặc gạch ngang.' }, 400)
      if (to.toLowerCase() === name.toLowerCase()) return json({ error: 'Tên mới trùng tên cũ.' }, 400)
      const lock = await stub.fetch('https://do/rename-lock', post({}))
      const locked = (await lock.json()) as { state?: any; error?: string }
      if (!lock.ok || !locked.state) return json({ error: locked.error ?? 'Không đổi tên được.' }, lock.status)
      const fresh = playerStub(to)
      const imp = await fresh.fetch('https://do/import', post({ state: locked.state, name: to }))
      if (!imp.ok) {
        // Nhập thất bại (trùng tên hoặc lỗi tạm): mở khóa và giữ nhân vật cũ, không xóa.
        await stub.fetch('https://do/rename-unlock', post({}))
        return json({ error: imp.status === 409 ? `Tên "${to}" đã có người dùng.` : 'Không đổi tên được, thử lại sau.' }, imp.status)
      }
      await stub.fetch('https://do/wipe', post({}))
      await roster.fetch('https://do/rename', post({ from: name, to }))
      await refreshRow(fresh)
      return json({ name: to })
    }

    // Mỗi lượt: Worker tính bonus tông, đồng hành, sự kiện; khách không tự gửi được bonus.
    let partner: string | null = null
    if (url.pathname === '/usage') {
      const c = await rosterJson<{ ctx: object; partner: string | null }>(`/ctx?name=${encodeURIComponent(name)}`)
      body = { turnId: body.turnId, tokens: body.tokens, quiet: body.quiet === true, ctx: c.ctx }
      partner = c.partner
    }

    const res = await stub.fetch(`https://do${url.pathname}`, { method: req.method, body: body === undefined ? undefined : JSON.stringify(body) })
    if (!res.ok) return res
    const data = (await res.json()) as any

    // Đồ đệ đột phá (lượt thường hoặc kỳ ngộ): sư phụ nhận học phí.
    if ((url.pathname === '/usage' || url.pathname === '/ky-ngo') && (data.events ?? []).includes('breakthrough')) {
      const info = await rosterJson<{ master?: string | null }>(`/social-info?name=${encodeURIComponent(name)}`)
      if (info.master) await playerStub(info.master).fetch('https://do/linh-thach', post({ delta: MASTER_REWARD, text: `🧑‍🏫 Đồ đệ ${name} vừa đột phá ${REALM_NAMES[data.player.realm - 1]}! +${MASTER_REWARD} linh thạch học phí.` }))
    }
    if (url.pathname === '/usage') {
      if (partner && data.gainedExp > 0) {
        const gift = Math.floor(data.gainedExp * GIFT_RATE)
        if (gift > 0) {
          const p = playerStub(partner)
          await p.fetch('https://do/gift', post({ exp: gift }))
          await refreshRow(p)
        }
      }
      const events: string[] = data.events ?? []
      const major = events.includes('breakthrough') && (data.player.realm - 1) % 3 === 0
      if (env.WEBHOOK_URL && (major || events.includes('death'))) {
        const text = events.includes('death')
          ? `💀 ${name} đan điền vỡ nát, trở về Luyện Khí Sơ Kỳ.`
          : `✨ ${name} đột phá ${REALM_NAMES[data.player.realm - 1]}!`
        await fetch(env.WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) }).catch(() => null)
      }
    }
    if (url.pathname === '/status' || url.pathname === '/me') {
      data.social = await rosterJson(`/social-info?name=${encodeURIComponent(name)}`)
    }
    // Refresh the roster snapshot from the player's own state after every call.
    if (req.method === 'POST') await refreshRow()
    else if (url.pathname === '/me') await refreshRow(stub, data.row) // /me đã trả sẵn row: khỏi hỏi lại DO
    return json(data)
  },
} satisfies ExportedHandler<Env>
