import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RosterDO } from './roster.ts'

// Storage giả theo Map, đủ cho các lệnh RosterDO dùng.
function fakeState(init: Record<string, unknown> = {}) {
  const m = new Map<string, unknown>(Object.entries(init))
  const storage = {
    get: async (k: string) => m.get(k),
    put: async (k: any, v?: unknown) => {
      if (typeof k === 'string') m.set(k, v)
      else for (const [kk, vv] of Object.entries(k)) m.set(kk, vv)
    },
    delete: async (k: string) => m.delete(k),
    list: async ({ prefix }: { prefix: string }) => new Map([...m].filter(([k]) => k.startsWith(prefix))),
  }
  return { m, state: { storage, blockConcurrencyWhile: (f: () => Promise<void>) => f() } as any }
}
const call = (r: RosterDO, path: string, body?: unknown) =>
  r.fetch(new Request(`https://do${path}`, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) })).then(x => x.json() as Promise<any>)
const rowOf = (name: string, realm = 1) => ({ name, cls: 'Kiếm Tu', gender: 'Nam', realm, pct: 0, score: 0 })

test('khối rows cũ được chuyển thành mỗi người một khóa rồi xóa', async () => {
  const { m, state } = fakeState({ rows: { Alice: rowOf('Alice'), Bob: rowOf('Bob') } })
  const r = new RosterDO(state)
  await new Promise(r => setTimeout(r, 0))
  assert.equal(m.has('rows'), false)
  assert.ok(m.has('row:alice') && m.has('row:bob'))
  assert.equal((await call(r, '/all')).rows.length, 2)
})

test('update ghi một dòng, rename đổi khóa, remove xóa dòng', async () => {
  const { m, state } = fakeState()
  const r = new RosterDO(state)
  await call(r, '/update', rowOf('Alice', 3))
  assert.ok(m.has('row:alice'))
  assert.equal((await call(r, '/all')).rows[0].realm, 3)
  await call(r, '/rename', { from: 'Alice', to: 'Alicia' })
  assert.equal(m.has('row:alice'), false)
  assert.equal((await call(r, '/all')).rows[0].name, 'Alicia')
  await call(r, '/remove', { name: 'Alicia' })
  assert.equal((await call(r, '/all')).rows.length, 0)
})

test('giới hạn đăng ký: quá 20 lần mỗi địa chỉ trong giờ thì bị từ chối, địa chỉ khác vẫn qua', async () => {
  const { state } = fakeState()
  const r = new RosterDO(state)
  for (let i = 0; i < 20; i++) assert.equal((await call(r, '/reg-limit', { ip: 'a' })).ok, true)
  const blocked = await r.fetch(new Request('https://do/reg-limit', { method: 'POST', body: JSON.stringify({ ip: 'a' }) }))
  assert.equal(blocked.status, 429)
  assert.equal((await call(r, '/reg-limit', { ip: 'b' })).ok, true)
})

test('tên trùng trả lại lượt (release) nên không tốn hạn mức', async () => {
  const { state } = fakeState()
  const r = new RosterDO(state)
  for (let i = 0; i < 50; i++) {
    assert.equal((await call(r, '/reg-limit', { ip: 'c' })).ok, true)
    await call(r, '/reg-limit', { ip: 'c', release: true })
  }
})

test('bảng nằm trong bộ nhớ: đọc /all, /ctx, /team không quét lại storage', async () => {
  const { state } = fakeState({ 'row:alice': rowOf('Alice', 2) })
  let lists = 0
  const list = state.storage.list
  state.storage.list = (o: any) => { lists++; return list(o) }
  const r = new RosterDO(state)
  await new Promise(r => setTimeout(r, 0))
  const before = lists
  await call(r, '/update', rowOf('Bob', 4))
  for (const p of ['/all', '/ctx?name=Bob', '/team', '/social-info?name=Bob']) await call(r, p)
  assert.equal(lists, before)
  assert.deepEqual((await call(r, '/all')).rows.map((x: any) => x.name).sort(), ['Alice', 'Bob'])
})

test('tông: Tông Chủ trục xuất được thành viên, người khác thì không', async () => {
  const { state } = fakeState()
  const r = new RosterDO(state)
  await call(r, '/update', rowOf('Chu', 12))
  await call(r, '/update', rowOf('Ke', 1))
  await call(r, '/social', { me: 'Chu', op: 'tong-tao', name: 'Kiem' })
  await call(r, '/social', { me: 'Ke', op: 'tong-vao', name: 'Kiem' })
  assert.ok((await call(r, '/social', { me: 'Ke', op: 'tong-duoi', target: 'Chu' })).error)
  const out = await call(r, '/social', { me: 'Chu', op: 'tong-duoi', target: 'Ke' })
  assert.equal(out.notify.to, 'Ke')
  assert.equal((await call(r, '/social-info?name=Ke')).tong, null)
})
