/// <reference types="@cloudflare/workers-types" />
// Worker: định tuyến và xác thực khóa. Luật nằm trong logic.ts / hooks/rules.ts.
import { PlayerDO } from './player.ts'
import { RosterDO } from './roster.ts'
import { sortBoards, publicBoard, versionAllowed, addRelease, validTurnId, type Row } from './logic.ts'

export { PlayerDO, RosterDO }

export interface Env {
  PLAYER: DurableObjectNamespace
  ROSTER: DurableObjectNamespace
  ADMIN_TOKEN?: string
}

const CLASSES = ['Kiếm Tu', 'Đan Sư', 'Trận Pháp Sư', 'Luyện Khí Sư', 'Phù Tu', 'Thể Tu', 'Ma Tu']
const GENDERS = ['Nam', 'Nữ']
const NAME = /^[\p{L}\p{N}_-]{1,24}$/u
const BOARDS = { 'tu-vi': 'tuVi', chamchi: 'chamChi', tuan: 'tuan', phoenix: 'phoenix', phapbao: 'phapBao' } as const
// Only these player routes are reachable from outside; DO-internal routes (/init, /verify) are not.
const PLAYER_ROUTES: Record<string, 'GET' | 'POST'> = { '/usage': 'POST', '/appearance': 'POST', '/reset': 'POST', '/me': 'GET', '/rotate-key': 'POST' }

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
const validLook = (b: any) => CLASSES.includes(b?.cls) && GENDERS.includes(b?.gender)

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const json = (x: unknown, status = 200) => Response.json(x, { status })
    const playerStub = (name: string) => env.PLAYER.get(env.PLAYER.idFromName(name.toLowerCase()))
    const roster = env.ROSTER.get(env.ROSTER.idFromName('team'))
    const releases = async () => ((await (await roster.fetch('https://do/releases')).json()) as { releases: string[] }).releases

    if (url.pathname === '/admin/releases' && req.method === 'POST') {
      // Fail closed: an unset secret must not match "Bearer undefined".
      if (!env.ADMIN_TOKEN || req.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
        return json({ error: 'forbidden' }, 403)
      }
      const { tag } = (await req.json()) as { tag: string }
      if (!/^v\d+\.\d+\.\d+$/.test(tag)) return json({ error: 'bad tag' }, 400)
      const next = addRelease(await releases(), tag)
      await roster.fetch('https://do/releases', { method: 'POST', body: JSON.stringify({ releases: next }) })
      return json({ releases: next })
    }

    if (url.pathname === '/admin/clear' && req.method === 'POST') {
      if (!env.ADMIN_TOKEN || req.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
        return json({ error: 'forbidden' }, 403)
      }
      const { name } = (await req.json()) as { name: string }
      if (typeof name !== 'string' || !NAME.test(name)) return json({ error: 'bad name' }, 400)
      const res = await playerStub(name).fetch('https://do/admin-clear', { method: 'POST', body: '{}' })
      return json({ ok: res.ok }, res.ok ? 200 : 404)
    }

    if (url.pathname === '/leaderboard' && req.method === 'GET') {
      const board = BOARDS[(url.searchParams.get('board') ?? 'tu-vi') as keyof typeof BOARDS]
      if (!board) return json({ error: 'unknown board' }, 400)
      const all = (await (await roster.fetch('https://do/all')).json()) as { rows: Row[] }
      const ranked = sortBoards(all.rows)[board]
      return json({ rows: publicBoard(ranked, url.searchParams.get('board') ?? 'tu-vi', Date.now()).slice(0, 10) })
    }

    // Every write path below requires a current mod build (spec 21.5).
    if (!versionAllowed(await releases(), req.headers.get('x-tutien-version') ?? '')) {
      return json({ error: 'upgrade required', message: 'Bản mod đã cũ. Chạy /tutien update để cập nhật.' }, 426)
    }

    if (url.pathname === '/register' && req.method === 'POST') {
      const body = (await req.json()) as any
      if (typeof body?.name !== 'string' || !NAME.test(body.name)) return json({ error: 'bad name' }, 400)
      if (!validLook(body)) return json({ error: 'bad appearance' }, 400)
      const key = crypto.randomUUID()
      const res = await playerStub(body.name).fetch('https://do/init', {
        method: 'POST',
        body: JSON.stringify({ name: body.name, cls: body.cls, gender: body.gender, keyHash: await sha256(key) }),
      })
      if (res.status === 409) return json({ error: 'name taken' }, 409)
      return json({ key }, 201)
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
    const verify = await stub.fetch('https://do/verify', { method: 'POST', body: JSON.stringify({ keyHash: await sha256(key) }) })
    if (verify.status === 429) return json({ error: 'locked', message: 'Sai khóa quá nhiều lần trong giờ này; chỉ khóa đúng mới được chấp nhận.' }, 429)
    if (verify.status !== 200) return json({ error: 'unauthorized' }, 401)

    if (url.pathname === '/rotate-key') {
      const fresh = crypto.randomUUID()
      await stub.fetch('https://do/rotate', { method: 'POST', body: JSON.stringify({ keyHash: await sha256(fresh) }) })
      return json({ key: fresh })
    }

    let body: any = undefined
    if (req.method === 'POST') {
      body = await req.json().catch(() => null)
      if (url.pathname === '/usage' && (!validTurnId(body?.turnId) || !Number.isFinite(Number(body?.tokens)))) {
        return json({ error: 'bad usage' }, 400)
      }
      if ((url.pathname === '/appearance' || url.pathname === '/reset') && !validLook(body)) {
        return json({ error: 'bad appearance' }, 400)
      }
    }
    const res = await stub.fetch(`https://do${url.pathname}`, { method: req.method, body: body === undefined ? undefined : JSON.stringify(body) })
    if (res.ok) {
      // Refresh the roster snapshot from the player's own state after every call.
      const me = (await (await stub.fetch('https://do/me')).json()) as { row?: Row }
      if (me.row) await roster.fetch('https://do/update', { method: 'POST', body: JSON.stringify(me.row) })
    }
    return res
  },
} satisfies ExportedHandler<Env>
