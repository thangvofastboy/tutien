/// <reference types="@cloudflare/workers-types" />
// Durable Object một người chơi: giữ State, áp luật qua logic.ts.
import { handleUsage, handleReset, row, type State } from './logic.ts'

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
      const ok = body.keyHash === st.keyHash
      return Response.json({ ok }, { status: ok ? 200 : 401 })
    }
    if (url.pathname === '/me') {
      return Response.json({ player: st.player, row: row(st, Date.now()) })
    }
    if (url.pathname === '/usage') {
      const out = handleUsage(st, body, Date.now(), Math.random)
      if (!out.duplicate) await this.state.storage.put('st', out.state)
      return Response.json({ player: out.state.player, events: out.events, duplicate: out.duplicate })
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
    if (url.pathname === '/snapshot') {
      return Response.json(st)
    }
    return new Response('not found', { status: 404 })
  }
}
