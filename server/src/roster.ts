/// <reference types="@cloudflare/workers-types" />
// Durable Object danh sách: giữ ảnh chụp từng người để xếp năm bảng (spec 16).
import type { Row } from './logic.ts'

export class RosterDO {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const rows = (await this.state.storage.get<Record<string, Row>>('rows')) ?? {}

    if (url.pathname === '/update' && req.method === 'POST') {
      const r = (await req.json()) as Row
      rows[r.name] = r
      await this.state.storage.put('rows', rows)
      return Response.json({ ok: true })
    }
    if (url.pathname === '/releases' && req.method === 'POST') {
      const { releases } = (await req.json()) as { releases: string[] }
      await this.state.storage.put('releases', releases)
      return Response.json({ ok: true })
    }
    if (url.pathname === '/releases') {
      return Response.json({ releases: (await this.state.storage.get<string[]>('releases')) ?? [] })
    }
    if (url.pathname === '/all') {
      return Response.json({ rows: Object.values(rows) })
    }
    return new Response('not found', { status: 404 })
  }
}
