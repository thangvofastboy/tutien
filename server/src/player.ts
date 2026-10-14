/// <reference types="@cloudflare/workers-types" />
// Durable Object một người chơi: giữ State, áp luật qua logic.ts.
import { handleUsage, handleReset, row, recordFail, isLocked, type State } from './logic.ts'
import { CLASSES as C, GENDERS as G } from '../../hooks/rules.ts'

const CLASSES: readonly string[] = C
const GENDERS: readonly string[] = G

export class PlayerDO {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? ((await req.json()) as any) : {}
    const st = await this.state.storage.get<State>('st')

    if (url.pathname === '/init') {
      if (st) return Response.json({ error: 'exists' }, { status: 409 })
      const { register } = await import('./logic.ts')
      const init = register(body.name, body.cls, body.gender, body.keyHash)
      await this.state.storage.put('st', init)
      return Response.json({ ok: true })
    }
    if (!st) return Response.json({ error: 'no player' }, { status: 404 })

    if (url.pathname === '/verify') {
      const now = Date.now()
      if (isLocked(st, now)) return Response.json({ ok: false, locked: true }, { status: 429 })
      if (body.keyHash !== st.keyHash) {
        await this.state.storage.put('st', recordFail(st, now))
        return Response.json({ ok: false }, { status: 401 })
      }
      return Response.json({ ok: true })
    }
    if (url.pathname === '/rotate' && req.method === 'POST') {
      await this.state.storage.put('st', { ...st, keyHash: body.keyHash })
      return Response.json({ ok: true })
    }
    if (url.pathname === '/admin-clear' && req.method === 'POST') {
      await this.state.storage.put('st', { ...st, suspicion: 0 })
      return Response.json({ ok: true })
    }
    if (url.pathname === '/me') {
      return Response.json({ player: st.player, row: row(st, Date.now()) })
    }
    if (url.pathname === '/usage') {
      const out = handleUsage(st, body, Date.now(), Math.random)
      if (!out.duplicate) await this.state.storage.put('st', out.state)
      return Response.json({ player: out.state.player, events: out.events, duplicate: out.duplicate })
    }
    const look = CLASSES.includes(body?.cls) && GENDERS.includes(body?.gender)
    if ((url.pathname === '/appearance' || url.pathname === '/reset') && (req.method !== 'POST' || !look)) {
      return Response.json({ error: 'bad appearance' }, { status: 400 })
    }
    if (url.pathname === '/appearance') {
      const next = { ...st, player: { ...st.player, cls: body.cls, gender: body.gender } }
      await this.state.storage.put('st', next)
      return Response.json({ player: next.player })
    }
    if (url.pathname === '/reset') {
      const next = handleReset(st, body.cls, body.gender)
      await this.state.storage.put('st', next)
      return Response.json({ player: next.player, resets: next.resets })
    }
    return new Response('not found', { status: 404 })
  }
}
