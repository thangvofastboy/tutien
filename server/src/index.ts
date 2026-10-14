// Worker: định tuyến và xác thực khóa. Luật nằm trong logic.ts / hooks/rules.ts.
import { PlayerDO } from './player.ts'
import { RosterDO } from './roster.ts'
import { boards, versionAllowed, addRelease, type Row } from './logic.ts'

export { PlayerDO, RosterDO }

export interface Env {
  PLAYER: DurableObjectNamespace
  ROSTER: DurableObjectNamespace
  ADMIN_TOKEN: string
}

const CLASSES = ['Kiếm Tu', 'Đan Sư', 'Trận Pháp Sư', 'Luyện Khí Sư', 'Phù Tu', 'Thể Tu', 'Ma Tu']
const GENDERS = ['Nam', 'Nữ']
const NAME = /^[\p{L}\p{N}_-]{1,24}$/u

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const json = (x: unknown, status = 200) => Response.json(x, { status })
    const playerStub = (name: string) => env.PLAYER.get(env.PLAYER.idFromName(name.toLowerCase()))
    const roster = env.ROSTER.get(env.ROSTER.idFromName('team'))

    if (url.pathname === '/register' && req.method === 'POST') {
      const { name, cls, gender } = (await req.json()) as any
      if (!NAME.test(name)) return json({ error: 'bad name' }, 400)
      if (!CLASSES.includes(cls) || !GENDERS.includes(gender)) return json({ error: 'bad appearance' }, 400)
      const key = crypto.randomUUID()
      const res = await playerStub(name).fetch('https://do/init', {
        method: 'POST', body: JSON.stringify({ name, cls, gender, keyHash: await sha256(key) }),
      })
      if (res.status === 409) return json({ error: 'name taken' }, 409)
      return json({ key }, 201)
    }

    if (url.pathname === '/admin/releases' && req.method === 'POST') {
      if (req.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: 'forbidden' }, 403)
      const { tag } = (await req.json()) as { tag: string }
      if (!/^v\d+\.\d+\.\d+$/.test(tag)) return json({ error: 'bad tag' }, 400)
      const current = (await (await roster.fetch('https://do/releases')).json()) as { releases: string[] }
      const releases = addRelease(current.releases, tag)
      await roster.fetch('https://do/releases', { method: 'POST', body: JSON.stringify({ releases }) })
      return json({ releases })
    }

    if (url.pathname === '/leaderboard' && req.method === 'GET') {
      const all = (await (await roster.fetch('https://do/all')).json()) as { rows: Row[] }
      const board = url.searchParams.get('board') ?? 'tu-vi'
      const key = ({ 'tu-vi': 'tuVi', chamchi: 'chamChi', tuan: 'tuan', phoenix: 'phoenix', phapbao: 'phapBao' } as const)[board as 'tu-vi']
      if (!key) return json({ error: 'unknown board' }, 400)
      const states = all.rows
      return json({ rows: states.slice(0, 10) })
    }

    const version = req.headers.get('x-tutien-version') ?? ''
    const releases = (await (await roster.fetch('https://do/releases')).json()) as { releases: string[] }
    if (!versionAllowed(releases.releases, version)) {
      return json({ error: 'upgrade required', message: 'Bản mod đã cũ. Chạy /tutien update để cập nhật.' }, 426)
    }

    const auth = req.headers.get('authorization') ?? ''
    const key = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const name = url.searchParams.get('name')
    if (!name || !NAME.test(name)) return json({ error: 'name required' }, 400)
    const stub = playerStub(name)
    const verify = await stub.fetch('https://do/verify', {
      method: 'POST', body: JSON.stringify({ keyHash: await sha256(key) }),
    })
    if (verify.status === 404) return json({ error: 'no player' }, 404)
    if (verify.status !== 200) return json({ error: 'unauthorized' }, 401)

    const body = req.method === 'POST' ? await req.text() : undefined
    const res = await stub.fetch(`https://do${url.pathname}`, { method: req.method, body })
    if (res.ok && ['/usage', '/appearance', '/reset', '/me'].includes(url.pathname)) {
      const out = (await res.clone().json()) as any
      if (out.row) await roster.fetch('https://do/update', { method: 'POST', body: JSON.stringify(out.row) })
    }
    return res
  },
} satisfies ExportedHandler<Env>
