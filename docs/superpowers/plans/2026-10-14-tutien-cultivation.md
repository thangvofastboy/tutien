# Tu Tiên Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến token Claude Code thành EXP tu luyện: mod `/tutien` trong repo này gửi lượng token mỗi lượt lên một Cloudflare Worker, server giữ bậc/EXP/thiên phạt của từng người chơi, và pane hiển thị nhân vật theo lớp, giới và bậc.

**Architecture:** Luật thuần (ngưỡng EXP, thiên phạt, quá hạn, tỷ lệ tử vong) nằm trong `hooks/rules.ts`, một nguồn duy nhất. Mod (`hooks/`) đọc `turn.complete`, đệm lượt vào `$.store` và gửi lên server. Server (`server/`) là Worker có một Durable Object cho mỗi người chơi và một roster để xếp hạng. Ảnh nhân vật do `scripts/gen_realms.py` sinh sẵn, mod chỉ đọc file.

**Tech Stack:** TypeScript + TSX (hooks module của engine Claude Code, `claude plugin test`), Cloudflare Workers + Durable Objects (`wrangler`), Python 3 + Pillow (script sinh ảnh).

**Spec:** `docs/superpowers/specs/2026-10-14-tutien-cultivation-design.md`

## Global Constraints

- Thiên phạt: 24 giờ, tính bằng thời gian server; quá hạn → EXP về 0, giữ bậc.
- Tỷ lệ tử vong: 2% mỗi lần vượt thiên phạt thành công; về Luyện Khí Sơ Kỳ.
- 1.000 token = 1 EXP; token = `input_tokens + output_tokens + cache_creation_input_tokens`; **không** tính `cache_read_input_tokens`.
- 33 bậc; bậc 33 là tối đa, không có thiên phạt.
- Ngưỡng EXP bậc 1..32 lấy nguyên từ bảng spec mục 6; công thức thiên phạt `round(17370445 × (0,1 + 0,7 × (bậc-1)/31))`.
- Lớp (7) và giới (Nam, Nữ) chỉ đổi hình, không có bonus.
- Không commit trừ khi bạn yêu cầu; mỗi task kết thúc bằng bước commit để bạn duyệt từng bước khi cần.

## Review Focus

1. **Lượt không có `usage`** (lượt bị hủy, lỗi API): phải coi là 0 token, không được làm hỏng mod.
2. **Gửi lại cùng một lượt** (mạng lỗi sau khi server đã nhận): không được cộng hai lần; server bỏ qua `turnId` đã xử lý.
3. **Đệm offline tràn**: hàng đợi trong `$.store` có giới hạn, lượt cũ nhất bị bỏ khi vượt giới hạn.
4. **Thiên phạt hết hạn đúng lúc người chơi gửi lượt**: token của lượt đến sau hạn không được tính vào thiên phạt.
5. **Ảnh thiếu hoặc terminal không hiển thị được ảnh**: pane vẫn vẽ được, có dòng mô tả thay thế.

---

### Task 1: Luật thuần (`hooks/rules.ts`)

**Files:**
- Create: `hooks/rules.ts`
- Test: `hooks/rules.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces: `need(realm)`, `tribRequired(realm)`, `newPlayer(cls, gender)`, `settle(p, now)`, `applyUsage(p, tokens, now, rng)`, `statusLine(p, now)`, `Player`, `REALM_COUNT`, `REALM_NAMES`, `TRIBULATION_MS`, `DEATH_CHANCE`. Server và mod đều dùng các hàm này.

- [ ] **Step 1: Viết file luật**

```ts
// hooks/rules.ts
export const REALM_COUNT = 33
export const PEAK_TOKENS_PER_DAY = 17_370_445
export const TRIBULATION_MS = 24 * 60 * 60 * 1000
export const DEATH_CHANCE = 0.02
export const TOKENS_PER_EXP = 1000

// EXP cần để rời bậc 1..32 (spec mục 6).
const NEED = [
  8685, 10727, 13249, 16363, 20210, 24961, 30830, 38077, 47029, 58084, 71739,
  88604, 109434, 135161, 166935, 206180, 254650, 314515, 388453, 479774, 592562,
  731866, 903919, 1116418, 1378874, 1703030, 2103390, 2597871, 3208597, 3962898,
  4894524, 6045165,
]

export const REALM_NAMES = [
  'Luyện Khí Sơ Kỳ', 'Luyện Khí Trung Kỳ', 'Luyện Khí Hậu Kỳ',
  'Trúc Cơ Sơ Kỳ', 'Trúc Cơ Trung Kỳ', 'Trúc Cơ Hậu Kỳ',
  'Kim Đan Sơ Kỳ', 'Kim Đan Trung Kỳ', 'Kim Đan Hậu Kỳ',
  'Nguyên Anh Sơ Kỳ', 'Nguyên Anh Trung Kỳ', 'Nguyên Anh Hậu Kỳ',
  'Hóa Thần Sơ Kỳ', 'Hóa Thần Trung Kỳ', 'Hóa Thần Hậu Kỳ',
  'Luyện Hư Sơ Kỳ', 'Luyện Hư Trung Kỳ', 'Luyện Hư Hậu Kỳ',
  'Hợp Thể Sơ Kỳ', 'Hợp Thể Trung Kỳ', 'Hợp Thể Hậu Kỳ',
  'Đại Thừa Sơ Kỳ', 'Đại Thừa Trung Kỳ', 'Đại Thừa Hậu Kỳ',
  'Độ Kiếp Sơ Kỳ', 'Độ Kiếp Trung Kỳ', 'Độ Kiếp Hậu Kỳ',
  'Chân Tiên Sơ Kỳ', 'Chân Tiên Trung Kỳ', 'Chân Tiên Hậu Kỳ',
  'Tiên Đế Sơ Kỳ', 'Tiên Đế Trung Kỳ', 'Tiên Đế Hậu Kỳ',
]

export type Player = {
  realm: number
  exp: number
  pending: number // token lẻ chưa đủ 1.000 để thành EXP
  cls: string
  gender: string
  trib?: { startedAt: number; required: number; earned: number }
}

export type Event = 'breakthrough' | 'tribulation-started' | 'tribulation-failed' | 'death'

export const need = (realm: number) => NEED[realm - 1]

export const tribRequired = (realm: number) =>
  Math.round(PEAK_TOKENS_PER_DAY * (0.1 + (0.7 * (realm - 1)) / 31))

export const newPlayer = (cls: string, gender: string): Player => ({
  realm: 1, exp: 0, pending: 0, cls, gender,
})

// Quá hạn thiên phạt: EXP về 0, giữ bậc, thiên phạt bắt đầu lại từ đầu.
export function settle(p: Player, now: number): { p: Player; events: Event[] } {
  if (p.trib && now - p.trib.startedAt >= TRIBULATION_MS) {
    return { p: { ...p, exp: 0, trib: undefined }, events: ['tribulation-failed'] }
  }
  return { p, events: [] }
}

export function applyUsage(
  p0: Player, tokens: number, now: number, rng: () => number,
): { p: Player; events: Event[] } {
  const s = settle(p0, now)
  let p = s.p
  const events = [...s.events]
  if (p.realm >= REALM_COUNT) return { p, events }

  if (p.trib) {
    const trib = { ...p.trib, earned: p.trib.earned + tokens }
    if (trib.earned < trib.required) return { p: { ...p, trib }, events }
    p = { ...p, realm: p.realm + 1, exp: 0, pending: 0, trib: undefined }
    events.push('breakthrough')
    if (rng() < DEATH_CHANCE) {
      p = { ...p, realm: 1, exp: 0 }
      events.push('death')
    }
    return { p, events }
  }

  const total = p.pending + tokens
  const exp = p.exp + Math.floor(total / TOKENS_PER_EXP)
  p = { ...p, exp, pending: total % TOKENS_PER_EXP }
  if (exp >= need(p.realm)) {
    p = {
      ...p,
      exp: need(p.realm),
      trib: { startedAt: now, required: tribRequired(p.realm), earned: 0 },
    }
    events.push('tribulation-started')
  }
  return { p, events }
}

export function statusLine(p: Player, now: number): string {
  const name = REALM_NAMES[p.realm - 1]
  if (p.realm >= REALM_COUNT) return `${name} (cảnh giới tối đa)`
  if (!p.trib) return `${name}: ${p.exp.toLocaleString('en-US')}/${need(p.realm).toLocaleString('en-US')} EXP`
  const left = Math.max(0, p.trib.startedAt + TRIBULATION_MS - now)
  const hours = Math.floor(left / 3_600_000)
  return `${name}: thiên phạt ${p.trib.earned.toLocaleString('en-US')}/${p.trib.required.toLocaleString('en-US')} token, còn ${hours} giờ`
}
```

- [ ] **Step 2: Viết test**

```ts
// hooks/rules.test.ts
import { expect, test } from 'claude-code/testing'
import {
  applyUsage, newPlayer, need, tribRequired, settle, TRIBULATION_MS, REALM_COUNT,
} from './rules'

const never = () => 0.99 // không bao giờ chết
const dies = () => 0.0

test('1.000 token = 1 EXP, phần lẻ được giữ lại', () => {
  let { p } = applyUsage(newPlayer('Kiếm Tu', 'Nam'), 999, 0, never)
  expect(p.exp).toBe(0)
  ;({ p } = applyUsage(p, 1, 0, never))
  expect(p.exp).toBe(1)
  expect(p.pending).toBe(0)
})

test('đạt ngưỡng thì bắt đầu thiên phạt với số token đúng bậc', () => {
  const start = { ...newPlayer('Kiếm Tu', 'Nam'), exp: need(1) - 1, pending: 0 }
  const { p, events } = applyUsage(start, 1000, 5, never)
  expect(events).toEqual(['tribulation-started'])
  expect(p.trib?.required).toBe(tribRequired(1))
  expect(p.trib?.startedAt).toBe(5)
})

test('vượt thiên phạt lên bậc kế, EXP về 0', () => {
  const start = {
    ...newPlayer('Kiếm Tu', 'Nam'),
    exp: need(1),
    trib: { startedAt: 0, required: 100, earned: 99 },
  }
  const { p, events } = applyUsage(start, 1, 10, never)
  expect(p.realm).toBe(2)
  expect(p.exp).toBe(0)
  expect(events).toEqual(['breakthrough'])
})

test('vượt thiên phạt có thể bị chết, về bậc 1', () => {
  const start = { ...newPlayer('Kiếm Tu', 'Nam'), realm: 5, trib: { startedAt: 0, required: 1, earned: 0 } }
  const { p, events } = applyUsage(start, 1, 10, dies)
  expect(p.realm).toBe(1)
  expect(events).toEqual(['breakthrough', 'death'])
})

test('quá 24 giờ thì EXP về 0, giữ bậc; token đến sau hạn không tính vào thiên phạt', () => {
  const start = {
    ...newPlayer('Kiếm Tu', 'Nam'),
    realm: 3, exp: need(3),
    trib: { startedAt: 0, required: 500, earned: 100 },
  }
  const late = applyUsage(start, 1000, TRIBULATION_MS, never)
  expect(late.events).toEqual(['tribulation-failed'])
  expect(late.p.realm).toBe(3)
  expect(late.p.trib).toBeUndefined()
  expect(late.p.exp).toBe(1)
})

test('settle không đổi gì trước hạn', () => {
  const start = { ...newPlayer('Kiếm Tu', 'Nam'), trib: { startedAt: 0, required: 1, earned: 0 } }
  expect(settle(start, TRIBULATION_MS - 1).events).toEqual([])
})

test('bậc tối đa không còn thay đổi', () => {
  const top = { ...newPlayer('Kiếm Tu', 'Nam'), realm: REALM_COUNT, exp: 0 }
  const { p, events } = applyUsage(top, 1_000_000, 0, never)
  expect(p.realm).toBe(REALM_COUNT)
  expect(events).toEqual([])
})
```

- [ ] **Step 3: Chạy test, xác nhận lỗi trước khi có code**

Run: `claude plugin test .`
Expected: FAIL (hooks/rules.ts chưa tồn tại) — nếu đã viết xong file ở bước 1 thì bỏ qua và chỉ cần PASS ở bước 4.

- [ ] **Step 4: Chạy lại và xác nhận PASS**

Run: `claude plugin test .`
Expected: 7 test pass trong `hooks/rules.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add hooks/rules.ts hooks/rules.test.ts
git commit -m "feat: add cultivation rules module"
```

---

### Task 2: Server Worker + Durable Objects

**Files:**
- Create: `server/package.json`, `server/wrangler.toml`, `server/tsconfig.json`
- Create: `server/src/index.ts` (router, xác thực)
- Create: `server/src/player.ts` (Durable Object người chơi)
- Create: `server/src/roster.ts` (Durable Object danh sách, xếp hạng)

**Interfaces:**
- Consumes: `need`, `applyUsage`, `settle`, `newPlayer`, `Player` từ `../../hooks/rules`.
- Produces: HTTP API (xem bảng dưới). Khóa bí mật trả về một lần lúc đăng ký; server chỉ lưu SHA-256 của khóa.

| Route | Auth | Body | Trả về |
|---|---|---|---|
| `POST /register` | không | `{name, cls, gender}` | `{key}` hoặc 409 nếu tên đã có |
| `POST /usage` | `Bearer` | `{turnId, tokens}` | `{player, events}` |
| `POST /appearance` | `Bearer` | `{cls, gender}` | `{player}` |
| `GET /me` | `Bearer` | — | `{player}` (đã settle) |
| `GET /leaderboard` | không | — | `{rows: [{name, realm, exp, cls, gender}]}` |

- [ ] **Step 1: Cấu hình**

`server/package.json`:
```json
{
  "name": "tutien-server",
  "private": true,
  "scripts": { "dev": "wrangler dev", "deploy": "wrangler deploy" },
  "devDependencies": { "wrangler": "^4.0.0", "typescript": "^5.6.0" }
}
```

`server/wrangler.toml`:
```toml
name = "tutien"
main = "src/index.ts"
compatibility_date = "2026-10-01"

[[durable_objects.bindings]]
name = "PLAYER"
class_name = "PlayerDO"

[[durable_objects.bindings]]
name = "ROSTER"
class_name = "RosterDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["PlayerDO", "RosterDO"]
```

- [ ] **Step 2: Durable Object người chơi**

```ts
// server/src/player.ts
import { applyUsage, newPlayer, settle, type Event, type Player } from '../../hooks/rules'

const SEEN_LIMIT = 1000

type State = { player: Player; keyHash: string; seen: string[] }

export class PlayerDO {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.json<any>() : undefined
    const st = await this.load()

    if (url.pathname === '/init') {
      if (st) return Response.json({ error: 'exists' }, { status: 409 })
      const { cls, gender, keyHash, name } = body
      const init: State = { player: newPlayer(cls, gender), keyHash, seen: [] }
      await this.state.storage.put('st', { ...init, name })
      return Response.json({ ok: true })
    }
    if (!st) return Response.json({ error: 'no player' }, { status: 404 })

    if (url.pathname === '/me') {
      const { p } = settle(st.player, Date.now())
      return this.save({ ...st, player: p }, { player: p })
    }

    if (url.pathname === '/usage') {
      if (st.seen.includes(body.turnId)) return Response.json({ player: st.player, events: [], duplicate: true })
      const now = Date.now()
      const { p, events } = applyUsage(st.player, Number(body.tokens) || 0, now, Math.random)
      const seen = [...st.seen, body.turnId].slice(-SEEN_LIMIT)
      return this.save({ ...st, player: p, seen }, { player: p, events })
    }

    if (url.pathname === '/appearance') {
      const p = { ...st.player, cls: body.cls, gender: body.gender }
      return this.save({ ...st, player: p }, { player: p })
    }

    return new Response('not found', { status: 404 })
  }

  private async load(): Promise<(State & { name?: string }) | undefined> {
    return this.state.storage.get<State & { name?: string }>('st')
  }

  private async save<T extends object>(st: State & { name?: string }, out: T): Promise<Response> {
    await this.state.storage.put('st', st)
    return Response.json(out)
  }
}
```

Lưu ý: `Date.now()` trong DO là thời gian server; mod không gửi thời gian đi.

- [ ] **Step 3: Roster (bảng xếp hạng)**

```ts
// server/src/roster.ts
import type { Player } from '../../hooks/rules'

type Row = { name: string; realm: number; exp: number; cls: string; gender: string }

export class RosterDO {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const rows = (await this.state.storage.get<Record<string, Row>>('rows')) ?? {}

    if (url.pathname === '/update' && req.method === 'POST') {
      const { name, player } = (await req.json()) as { name: string; player: Player }
      rows[name] = { name, realm: player.realm, exp: player.exp, cls: player.cls, gender: player.gender }
      await this.state.storage.put('rows', rows)
      return Response.json({ ok: true })
    }
    if (url.pathname === '/top') {
      const sorted = Object.values(rows).sort((a, b) => b.realm - a.realm || b.exp - a.exp)
      return Response.json({ rows: sorted })
    }
    return new Response('not found', { status: 404 })
  }
}
```

- [ ] **Step 4: Router và xác thực**

```ts
// server/src/index.ts
import { PlayerDO } from './player'
import { RosterDO } from './roster'

export { PlayerDO, RosterDO }

export interface Env {
  PLAYER: DurableObjectNamespace
  ROSTER: DurableObjectNamespace
}

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const CLASSES = ['Kiếm Tu', 'Đan Sư', 'Trận Pháp Sư', 'Luyện Khí Sư', 'Phù Tu', 'Thể Tu', 'Ma Tu']
const GENDERS = ['Nam', 'Nữ']
const NAME = /^[\p{L}\p{N}_-]{1,24}$/u

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const json = (x: unknown, status = 200) => Response.json(x, { status })

    if (url.pathname === '/register' && req.method === 'POST') {
      const { name, cls, gender } = (await req.json()) as any
      if (!NAME.test(name)) return json({ error: 'bad name' }, 400)
      if (!CLASSES.includes(cls) || !GENDERS.includes(gender)) return json({ error: 'bad appearance' }, 400)
      const key = crypto.randomUUID()
      const stub = env.PLAYER.get(env.PLAYER.idFromName(name.toLowerCase()))
      const res = await stub.fetch('https://do/init', {
        method: 'POST',
        body: JSON.stringify({ name, cls, gender, keyHash: await sha256(key) }),
      })
      if (res.status === 409) return json({ error: 'name taken' }, 409)
      return json({ key })
    }

    if (url.pathname === '/leaderboard' && req.method === 'GET') {
      const roster = env.ROSTER.get(env.ROSTER.idFromName('team'))
      return roster.fetch('https://do/top')
    }

    // Các route còn lại cần khóa.
    const auth = req.headers.get('authorization') ?? ''
    const key = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const name = url.searchParams.get('name') ?? (await peekName(req))
    if (!name) return json({ error: 'name required' }, 400)
    const stub = env.PLAYER.get(env.PLAYER.idFromName(name.toLowerCase()))
    const who = await stub.fetch('https://do/me')
    if (who.status === 404) return json({ error: 'no player' }, 404)
    // Xác thực: so khóa với hash lưu lúc đăng ký. Hash trả về từ /me không chứa khóa,
    // nên DO có route /verify riêng (xem bước 2: thêm vào PlayerDO).
    const verify = await stub.fetch('https://do/verify', { method: 'POST', body: JSON.stringify({ keyHash: await sha256(key) }) })
    if (verify.status !== 200) return json({ error: 'unauthorized' }, 401)

    const inner = url.pathname
    const body = req.method === 'POST' ? await req.text() : undefined
    const res = await stub.fetch(`https://do${inner}`, { method: req.method, body })
    if (inner === '/usage' || inner === '/appearance' || inner === '/me') {
      const out = (await res.clone().json()) as any
      if (out.player) {
        const roster = env.ROSTER.get(env.ROSTER.idFromName('team'))
        await roster.fetch('https://do/update', { method: 'POST', body: JSON.stringify({ name, player: out.player }) })
      }
    }
    return res
  },
} satisfies ExportedHandler<Env>

async function peekName(req: Request): Promise<string | undefined> {
  if (req.method !== 'POST') return undefined
  const body = (await req.clone().json().catch(() => ({}))) as any
  return body.name
}
```

- [ ] **Step 5: Thêm route `/verify` vào PlayerDO**

Trong `PlayerDO.fetch`, ngay sau dòng `if (!st) return ...` thêm:

```ts
    if (url.pathname === '/verify') {
      return Response.json({ ok: body.keyHash === st.keyHash }, { status: body.keyHash === st.keyHash ? 200 : 401 })
    }
```

Lưu ý: `/init` lưu `name` trong state nhưng `index.ts` lấy `name` từ body/URL; khi `/usage` và `/appearance` nhận body có `name` thì nên lấy từ query `?name=` hoặc body. Đơn giản hóa: client luôn gửi `name` trong query string (`?name=...`). Route `peekName` chỉ là dự phòng.

- [ ] **Step 6: Kiểm tra cục bộ**

Run: `cd server && npm install && npx wrangler dev`
Trong terminal khác:
```bash
curl -s -X POST localhost:8787/register -H 'content-type: application/json' -d '{"name":"thang","cls":"Kiếm Tu","gender":"Nam"}'
```
Expected: `{"key":"<uuid>"}`.

```bash
curl -s -X POST 'localhost:8787/usage?name=thang' -H "authorization: Bearer <uuid>" -H 'content-type: application/json' -d '{"turnId":"t1","tokens":5000}'
```
Expected: `{"player":{"realm":1,"exp":5,...},"events":[]}`.

Gửi lại cùng `turnId` phải trả về `"duplicate":true`, EXP không tăng.

Gửi sai khóa phải nhận 401.

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "feat: add cultivation server (Worker + Durable Objects)"
```

---

### Task 3: Client mod: gửi lượt và đệm offline

**Files:**
- Create: `hooks/api.ts` (gọi server, đọc khóa từ `$.store`)
- Create: `hooks/usage.ts` (hook `turn.complete`, hàng đợi)
- Test: `hooks/usage.test.ts`

**Interfaces:**
- Consumes: `$.http.fetch(url, {method, headers, body})` → `{status, ok, headers, text}`; `$.store.get/set`; `turn.complete` có `turnId` và `usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`).
- Produces: `SERVER` (URL Worker), `callServer($, path, body?)`, `countTokens(usage)`, `QUEUE_LIMIT = 500`.

- [ ] **Step 1: Viết `hooks/api.ts`**

```ts
// hooks/api.ts
export const SERVER = 'https://tutien.<tài-khoản>.workers.dev'
export const KEY = 'tutien.key'
export const NAME = 'tutien.name'

type Store = { get: (k: string) => Promise<unknown> }

export async function callServer<T>(
  $: { store: Store; http: { fetch: (url: string, init?: any) => Promise<any> } },
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: T }> {
  const name = (await $.store.get(NAME)) as string | undefined
  const key = (await $.store.get(KEY)) as string | undefined
  if (!name || !key) return { ok: false, status: 0 }
  const res = await $.http.fetch(`${SERVER}${path}?name=${encodeURIComponent(name)}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true, status: res.status, data: JSON.parse(res.text) as T }
}

export const countTokens = (u?: {
  input_tokens: number; output_tokens: number; cache_creation_input_tokens: number
}) => (u ? u.input_tokens + u.output_tokens + u.cache_creation_input_tokens : 0)
```

Thay `<tài-khoản>` bằng subdomain thật sau khi deploy (Task 7).

- [ ] **Step 2: Viết hook `turn.complete` với hàng đợi**

```ts
// hooks/usage.ts
import type { Register } from 'claude-code'
import { callServer, countTokens } from './api'

export const QUEUE_LIMIT = 500
const QUEUE = 'tutien.queue'

type Item = { turnId: string; tokens: number }

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const tokens = countTokens(e.usage)
    if (tokens > 0 && e.turnId) {
      const queue = ((await $.store.get(QUEUE)) as Item[] | undefined) ?? []
      const next_ = [...queue, { turnId: e.turnId, tokens }].slice(-QUEUE_LIMIT)
      await $.store.set(QUEUE, next_)
      await flush($)
    }
    return result
  })

  on('session.start', async ($, e, next) => {
    await flush($)
    return next(e)
  })
}

// Gửi lần lượt; lượt nào gửi lỗi thì giữ lại để thử lần sau.
export async function flush($: any) {
  const queue = ((await $.store.get(QUEUE)) as Item[] | undefined) ?? []
  const rest: Item[] = []
  for (const item of queue) {
    const res = await callServer($, '/usage', item).catch(() => ({ ok: false, status: 0 }))
    if (!res.ok && res.status !== 0 && res.status < 500) continue // lỗi cố định (sai khóa, 404): bỏ
    if (!res.ok) rest.push(item)
  }
  await $.store.set(QUEUE, rest)
}
```

Lưu ý: `flush` trong `turn.complete` gửi ngay lượt vừa xong; nếu lỗi mạng thì lượt ở lại hàng đợi.

- [ ] **Step 3: Test với mock HTTP**

```ts
// hooks/usage.test.ts
import { expect, test } from 'claude-code/testing'
import { countTokens } from './api'

test('lượt không có usage tính là 0 token', () => {
  expect(countTokens(undefined)).toBe(0)
})

test('cache read không được tính', () => {
  expect(countTokens({ input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 2, cache_read_input_tokens: 999_999 })).toBe(17)
})
```

Test về gửi lại và hàng đợi cần thêm mock `http.fetch` và `store` theo kit `claude-code/testing` (xem `mock.store`). Viết thêm một test: khi `http.fetch` trả lỗi mạng (`status: 503`), lượt vẫn còn trong `tutien.queue`; khi trả 200 thì hàng đợi rỗng.

- [ ] **Step 4: Chạy test**

Run: `claude plugin test .`
Expected: test mới pass.

- [ ] **Step 5: Cập nhật `hooks/hooks.json`**

```json
{ "modules": ["./register.ts", "./usage.ts"] }
```

- [ ] **Step 6: Commit**

```bash
git add hooks/api.ts hooks/usage.ts hooks/usage.test.ts hooks/hooks.json
git commit -m "feat: send turn usage to the cultivation server with offline queue"
```

---

### Task 4: Lệnh `/tutien register|appearance|status|top`

**Files:**
- Modify: `hooks/register.ts` (giữ `update`, thêm các lệnh)

**Interfaces:**
- Consumes: `callServer`, `SERVER`, `KEY`, `NAME` (`hooks/api.ts`); `statusLine` (`hooks/rules.ts`); `CLASSES`, `GENDERS` (đặt trong `hooks/rules.ts`, thêm export ở bước 1).
- Produces: lệnh `/tutien` với các nhánh `update`, `register <tên> <lớp> <giới>`, `appearance <lớp> <giới>`, `status`, `top`.

- [ ] **Step 1: Thêm `CLASSES` và `GENDERS` vào `hooks/rules.ts`**

```ts
export const CLASSES = ['Kiếm Tu', 'Đan Sư', 'Trận Pháp Sư', 'Luyện Khí Sư', 'Phù Tu', 'Thể Tu', 'Ma Tu']
export const GENDERS = ['Nam', 'Nữ']
```

- [ ] **Step 2: Viết nhánh lệnh**

Trong `hooks/register.ts`, mở rộng `argumentHint` thành `'update | register <tên> <lớp> <giới> | appearance <lớp> <giới> | status | top'`, và trong `command.run` tách theo từ đầu tiên:

```ts
const [sub, ...rest] = e.args.trim().split(/\s+/)
if (sub === 'register') {
  const [name, cls, gender] = rest
  if (!name || !CLASSES.includes(cls) || !GENDERS.includes(gender)) {
    return { text: `Dùng: /tutien register <tên> <lớp> <giới>\nLớp: ${CLASSES.join(', ')}\nGiới: ${GENDERS.join(', ')}` }
  }
  const res = await $.http.fetch(`${SERVER}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, cls, gender }),
  })
  if (res.status === 409) return { text: `Tên "${name}" đã có người dùng.` }
  if (!res.ok) return { text: `Đăng ký thất bại (${res.status}).` }
  await $.store.set(KEY, JSON.parse(res.text).key)
  await $.store.set(NAME, name)
  return { text: `Đã đăng ký ${name}, lớp ${cls}, ${gender}. Khóa đã lưu trên máy này.` }
}

if (sub === 'appearance') {
  const [cls, gender] = rest
  if (!CLASSES.includes(cls) || !GENDERS.includes(gender)) {
    return { text: 'Dùng: /tutien appearance <lớp> <giới>' }
  }
  const res = await callServer<{ player: Player }>($, '/appearance', { cls, gender })
  if (!res.ok) return { text: 'Chưa đăng ký, hoặc server không phản hồi.' }
  return { text: `Đã đổi thành ${cls}, ${gender}.` }
}

if (sub === 'status') {
  const res = await callServer<{ player: Player }>($, '/me')
  if (!res.ok || !res.data) return { text: 'Chưa đăng ký, hoặc server không phản hồi.' }
  return { text: statusLine(res.data.player, Date.now()) }
}

if (sub === 'top') {
  const res = await $.http.fetch(`${SERVER}/leaderboard`, { method: 'GET' })
  if (!res.ok) return { text: `Không lấy được bảng xếp hạng (${res.status}).` }
  const { rows } = JSON.parse(res.text) as { rows: { name: string; realm: number; exp: number }[] }
  if (rows.length === 0) return { text: 'Chưa có ai tu luyện.' }
  return {
    text: rows
      .map((r, i) => `${i + 1}. ${r.name} — ${REALM_NAMES[r.realm - 1]} (${r.exp.toLocaleString('en-US')} EXP)`)
      .join('\n'),
  }
}

return { text: USAGE }
```

`fetch_` là hàm nhỏ bọc `$.http.fetch` và `JSON.parse`; `callServer` đã có sẵn cho các route cần khóa. Route `/register` không cần khóa nên gọi `$.http.fetch` trực tiếp (method POST, body JSON).

- [ ] **Step 3: Test cho nhánh `register` và `status`**

Dùng `on('http.fetch', ...)` của test kit để trả về các phản hồi giả: 409 cho tên trùng, 200 với `{key}` cho đăng ký mới. Test rằng `register thang "Kiếm Tu" Nam` lưu khóa vào `tutien.key`, và `register` thiếu tham số trả về chuỗi hướng dẫn.

- [ ] **Step 4: Chạy test**

Run: `claude plugin test .`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/register.ts hooks/rules.ts hooks/register.test.ts
git commit -m "feat: add /tutien register, appearance, status and top"
```

---

### Task 5: Pane nhân vật (`hooks/pane.tsx`)

**Files:**
- Create: `hooks/pane.tsx`
- Modify: `hooks/hooks.json` (thêm `./pane.tsx`)
- Test: `hooks/pane.test.tsx`

**Interfaces:**
- Consumes: `statusLine`, `REALM_NAMES`, `need`, `Player` (`hooks/rules.ts`); `callServer` (`hooks/api.ts`); `ImageSource` dạng `{file, format: 'png'}` đã xác nhận trong engine.
- Produces: pane `tu-tien`, mở bằng `$.ui.open({ id: 'tu-tien', title: 'Tu tiên' })` và một lệnh `/tutien pane`.

- [ ] **Step 1: Viết pane**

```tsx
// hooks/pane.tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import { callServer } from './api'
import { REALM_NAMES, REALM_COUNT, need, statusLine, type Player } from './rules'

const PANE = 'tu-tien'
const me = atom({ plugin: 'tu-tien', key: 'me' } as const, undefined as Player | undefined)

// Ảnh bậc: assets/realms/<lớp>/<giới>/NN.png, NN là hai chữ số bậc.
const realmImage = (root: string, p: Player) =>
  `${root}/assets/realms/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.png`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tutien-pane', description: 'Mở pane Tu tiên' })
    const res = await callServer<{ player: Player }>($, '/me').catch(() => undefined)
    if (res?.ok && res.data) await update($, me, () => res.data!.player)
    return next(e)
  })

  on('command.run', { command: 'tutien-pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Tu tiên' })
    return { text: 'Đã mở pane Tu tiên.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Image } = $.ui.resolve(e)
    const p = await read($, me)
    if (!p) return <Text dimColor>Chưa đăng ký. Dùng /tutien register.</Text>
    const root = $.plugin.root
    const alt = `${REALM_NAMES[p.realm - 1]} (${p.cls}, ${p.gender})`
    return (
      <Box flexDirection="column">
        <Image
          key="realm"
          source={{ file: realmImage(root, p), format: 'png' }}
          columns={24}
          rows={12}
          alt={alt}
        />
        <Text>{statusLine(p, Date.now())}</Text>
        {p.realm < REALM_COUNT && <Text dimColor>Cần {need(p.realm).toLocaleString('en-US')} EXP để rời bậc.</Text>}
      </Box>
    )
  })
}
```

Lưu ý: `atom` lấy đúng cú pháp trong ví dụ `pane.tsx` trong skill (`atom({ plugin, key } as const, initial)`). `read` và `update` đúng như ví dụ đó.

- [ ] **Step 2: Test pane**

Test dùng `$.ui.mount({ plugin: 'tu-tien', surface: 'terminal', component: 'Pane', props: { requestId: 'tu-tien' } })`, rồi `ui.find({ type: 'Image' })` phải có, và `ui.find({ type: 'Text', text: /Luyện Khí/ })` khớp. Trước khi viết test, đọc `Image` element props trong `types/claude-code.d.ts` để đúng tên prop (`alt`, `source`, `columns`, `rows`).

- [ ] **Step 3: Thêm vào `hooks/hooks.json`**

```json
{ "modules": ["./register.ts", "./usage.ts", "./pane.tsx"] }
```

- [ ] **Step 4: Chạy test và validate**

Run: `claude plugin test . && claude plugin validate .`
Expected: pass, không lỗi.

- [ ] **Step 5: Commit**

```bash
git add hooks/pane.tsx hooks/pane.test.tsx hooks/hooks.json
git commit -m "feat: add cultivation pane with realm image"
```

---

### Task 6: Script sinh 462 ảnh nhân vật

**Files:**
- Create: `scripts/gen_realms.py`
- Create: `scripts/test_gen_realms.py`
- Create: `assets/realms/<lớp>/<giới>/NN.png` (462 file, sinh bởi script)

**Interfaces:**
- Consumes: không có (Pillow).
- Produces: `assets/realms/<lớp>/<giới>/01.png` … `33.png`. Lớp là một trong `CLASSES` ở `hooks/rules.ts`, giới là `Nam` hoặc `Nữ`.

- [ ] **Step 1: Viết test cho script**

```python
# scripts/test_gen_realms.py
import pathlib, sys
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import gen_realms as g

def test_palette_differs_per_class():
    assert g.palette('Kiếm Tu') != g.palette('Đan Sư')

def test_generates_png(tmp_path):
    g.render(tmp_path, 'Kiếm Tu', 'Nam', 1)
    img = Image.open(tmp_path / 'Kiếm Tu' / 'Nam' / '01.png')
    assert img.size == (g.SIZE, g.SIZE)

def test_deterministic(tmp_path):
    a = g.frame('Kiếm Tu', 'Nam', 7)
    b = g.frame('Kiếm Tu', 'Nam', 7)
    assert a.tobytes() == b.tobytes()

if __name__ == '__main__':
    import pytest; raise SystemExit(pytest.main([__file__]))
```

- [ ] **Step 2: Chạy test, xác nhận lỗi**

Run: `python3 scripts/test_gen_realms.py`
Expected: FAIL (`gen_realms` chưa tồn tại).

- [ ] **Step 3: Viết script**

```python
# scripts/gen_realms.py
"""Sinh ảnh nhân vật theo lớp, giới và bậc. Chạy: python3 scripts/gen_realms.py"""
import hashlib, pathlib, random
from PIL import Image, ImageDraw

SIZE = 96  # px; mod hiển thị 24x12 ô
CLASSES = ['Kiếm Tu', 'Đan Sư', 'Trận Pháp Sư', 'Luyện Khí Sư', 'Phù Tu', 'Thể Tu', 'Ma Tu']
GENDERS = ['Nam', 'Nữ']
REALMS = 33
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'realms'

def palette(cls: str):
    h = int(hashlib.sha256(cls.encode()).hexdigest(), 16)
    rng = random.Random(h)
    return [tuple(rng.randrange(40, 230) for _ in range(3)) for _ in range(3)]

def frame(cls: str, gender: str, realm: int) -> Image.Image:
    rng = random.Random(f'{cls}|{gender}|{realm}')
    img = Image.new('RGB', (SIZE, SIZE), (18, 20, 32))
    d = ImageDraw.Draw(img)
    main, accent, glow = palette(cls)
    # Hào quang tăng dần theo bậc: bán kính và số vòng.
    rings = min(realm // 4, 6)
    for i in range(rings):
        r = 44 - i * 6
        d.ellipse([SIZE/2 - r, SIZE/2 - r, SIZE/2 + r, SIZE/2 + r], outline=glow)
    # Thân người: đơn giản hóa; giới đổi độ rộng vai.
    shoulder = 18 if gender == 'Nam' else 14
    d.ellipse([SIZE/2 - 7, 18, SIZE/2 + 7, 34], fill=main)            # đầu
    d.polygon([(SIZE/2 - shoulder, 40), (SIZE/2 + shoulder, 40),
               (SIZE/2 + 10, 78), (SIZE/2 - 10, 78)], fill=main)      # thân
    d.rectangle([SIZE/2 - 2, 40, SIZE/2 + 2, 60], fill=accent)        # đai
    # Bậc cao: thêm sấm sét ngẫu nhiên khi realm >= 25.
    if realm >= 25:
        for _ in range(3):
            x = rng.randrange(8, SIZE - 8)
            d.line([(x, 0), (x + rng.randrange(-6, 6), SIZE // 2)], fill=glow, width=2)
    return img

def render(out: pathlib.Path, cls: str, gender: str, realm: int):
    path = out / cls / gender
    path.mkdir(parents=True, exist_ok=True)
    frame(cls, gender, realm).save(path / f'{realm:02d}.png')

if __name__ == '__main__':
    n = 0
    for cls in CLASSES:
        for g in GENDERS:
            for r in range(1, REALMS + 1):
                render(OUT, cls, g, r)
                n += 1
    print(f'{n} ảnh -> {OUT}')
```

Đây là bản khung đơn giản để bạn xem phong cách trước; nếu bạn muốn nét vẽ đẹp hơn, bước duyệt mẫu ở Step 5 sẽ quyết định có chỉnh tiếp không.

- [ ] **Step 4: Chạy test và sinh ảnh**

Run: `pip install pillow pytest && python3 scripts/test_gen_realms.py && python3 scripts/gen_realms.py`
Expected: test pass; in ra `462 ảnh -> .../assets/realms`.

Run: `find assets/realms -name '*.png' | wc -l`
Expected: `462`

- [ ] **Step 5: Duyệt mẫu**

Mở vài ảnh mẫu (ví dụ `assets/realms/Kiếm Tu/Nam/01.png`, `.../33.png`) và hỏi bạn có muốn chỉnh phong cách không. Nếu đổi, sửa `frame()` và chạy lại Step 4.

- [ ] **Step 6: Commit**

```bash
git add scripts/ assets/realms/
git commit -m "feat: generate 462 realm portraits from script"
```

---

### Task 7: Triển khai và tài liệu

**Files:**
- Modify: `server/wrangler.toml` (không đổi nếu tên hợp lệ)
- Modify: `hooks/api.ts` (thay `SERVER` bằng URL thật)
- Modify: `README.md` (hướng dẫn cài, đăng ký, các lệnh)

**Interfaces:**
- Consumes: URL Worker sau khi deploy.
- Produces: server chạy được, mod trỏ đúng server.

- [ ] **Step 1: Deploy**

Run: `cd server && npx wrangler login && npx wrangler deploy`
Expected: in ra URL dạng `https://tutien.<subdomain>.workers.dev`.

- [ ] **Step 2: Cập nhật `SERVER` trong `hooks/api.ts`** bằng URL vừa có. Chạy lại `claude plugin test .`.

- [ ] **Step 3: Smoke test end-to-end**

Trong một session Claude Code có `claude --plugin-dir .`:
1. `/tutien register <tên> Kiếm\ Tu Nam`
2. Chat một lượt ngắn, rồi `/tutien status`: EXP tăng (lượt ngắn có thể 0 EXP vì dưới 1.000 token; khi đó thử lượt dài hơn).
3. `/tutien top`: thấy tên mình.
4. Mở pane: `/tutien-pane`, xác nhận có ảnh (hoặc dòng mô tả trên terminal không hỗ trợ ảnh).

- [ ] **Step 4: Cập nhật README**: hướng dẫn `wrangler deploy`, lệnh `/tutien`, cách tạo lại ảnh (`python3 scripts/gen_realms.py`).

- [ ] **Step 5: Commit**

```bash
git add server/wrangler.toml hooks/api.ts README.md
git commit -m "chore: deploy cultivation server and document usage"
```

---

## Self-Review

- **Độ phủ spec**: luật EXP/thiên phạt/tử vong → Task 1; server và định danh → Task 2; gửi token và đệm → Task 3; lệnh → Task 4; pane → Task 5; ảnh 462 → Task 6; triển khai → Task 7; bảng xếp hạng → Task 2 (roster) và Task 4 (`top`).
- **Review Focus**: lượt không `usage` → `countTokens(undefined)=0` (Task 3, test); gửi lại → `turnId` và `seen` (Task 2 Step 2, Step 6); hàng đợi tràn → `QUEUE_LIMIT` (Task 3); thiên phạt hết hạn → test trong Task 1; ảnh thiếu → `alt` (Task 5).
- **Nhất quán kiểu**: `Player` và các hàm trong `rules.ts` dùng xuyên suốt; `callServer` có cùng chữ ký ở Task 3, 4, 5.
- **Điểm còn mở cần kiểm tra khi thực hiện**: `Image` element props (Task 5 Step 2); `turnId` trong `turn.complete` là chuỗi (đã xác nhận trong type); route `/verify` trong `PlayerDO` cần được thêm như Task 2 Step 5 (phần này trong `index.ts` đang gọi `/verify`, nên bước 5 là bắt buộc).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-14-tutien-cultivation.md`. Chưa commit (quy tắc của bạn).

Bạn chọn cách thực hiện:
- **Subagent-driven**: mỗi task một subagent mới, có reviewer kiểm tra trước khi sang task kế. Kỹ hơn, tốn context hơn. Nên chọn vì plan có 7 task phụ thuộc nhau về interface và một lỗi nhỏ ở server hoặc luật có thể lan sang mod.
- **Native**: tôi làm từng task ngay trong session này, rồi một reviewer kiểm tra toàn nhánh cuối. Nhanh và rẻ hơn.

Tôi khuyên **Subagent-driven**. Bạn duyệt plan và chọn cách thực hiện nhé?

