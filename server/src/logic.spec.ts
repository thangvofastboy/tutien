import test from 'node:test'
import assert from 'node:assert/strict'
import { register, handleUsage, handleReset, boards, DAY_KEY } from './logic.ts'
import { need } from '../../hooks/rules.ts'

const NOW = Date.UTC(2026, 9, 14, 12)
const never = () => 0.99

test('đăng ký tạo hồ sơ bậc 1', () => {
  const st = register('thang', 'Thể Tu', 'Nam', 'hash')
  assert.equal(st.player.realm, 1)
  assert.equal(st.lifetimeTokens, 0)
})

test('turnId trùng không cộng hai lần', () => {
  let st = register('thang', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 't1', tokens: 5000 }, NOW, never).state
  const again = handleUsage(st, { turnId: 't1', tokens: 5000 }, NOW, never)
  assert.equal(again.duplicate, true)
  assert.equal(again.state.lifetimeTokens, 5000)
})

test('token trọn đời và token tuần cộng dồn theo ngày', () => {
  let st = register('thang', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 'a', tokens: 1000 }, NOW, never).state
  st = handleUsage(st, { turnId: 'b', tokens: 2000 }, NOW, never).state
  assert.equal(st.lifetimeTokens, 3000)
  assert.equal(st.weekTokens[DAY_KEY(NOW)], 3000)
})

test('token tuần cũ hơn 7 ngày bị bỏ', () => {
  let st = register('thang', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 'old', tokens: 9000 }, NOW - 8 * 86_400_000, never).state
  st = handleUsage(st, { turnId: 'new', tokens: 1000 }, NOW, never).state
  assert.equal(Object.values(st.weekTokens).reduce((a, b) => a + b, 0), 1000)
})

test('reset giữ tên, khóa, tổng token, số lần chết; tăng số lần reset', () => {
  let st = register('thang', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 'a', tokens: 4000 }, NOW, never).state
  const r = handleReset(st, 'Kiếm Tu', 'Nữ')
  assert.equal(r.player.realm, 1)
  assert.equal(r.player.cls, 'Kiếm Tu')
  assert.equal(r.player.gender, 'Nữ')
  assert.equal(r.lifetimeTokens, 4000)
  assert.equal(r.resets, 1)
  assert.equal(r.keyHash, 'h')
})

test('bảng Tu vi xếp theo bậc rồi EXP', () => {
  const a = { ...register('a', 'Thể Tu', 'Nam', 'h'), player: { ...register('a', 'Thể Tu', 'Nam', 'h').player, realm: 5, exp: 10 } }
  const b = { ...register('b', 'Thể Tu', 'Nam', 'h'), player: { ...register('b', 'Thể Tu', 'Nam', 'h').player, realm: 5, exp: 99 } }
  const c = register('c', 'Thể Tu', 'Nam', 'h')
  const top = boards([a, b, c], NOW).tuVi
  assert.deepEqual(top.map(r => r.name), ['b', 'a', 'c'])
})

test('bảng Phượng hoàng xếp theo số lần chết', () => {
  const a = { ...register('a', 'Thể Tu', 'Nam', 'h'), deaths: 3 }
  const b = { ...register('b', 'Thể Tu', 'Nam', 'h'), deaths: 1 }
  assert.deepEqual(boards([b, a], NOW).phoenix.map(r => r.name), ['a', 'b'])
})

test('need(1) khớp đường cong đã chốt', () => {
  assert.equal(need(1), 8000)
})

import { versionAllowed, addRelease } from './logic.ts'

test('chỉ hai bản phát hành gần nhất được nhận', () => {
  const releases = ['v1.3.0', 'v1.2.0']
  assert.equal(versionAllowed(releases, 'v1.3.0'), true)
  assert.equal(versionAllowed(releases, 'v1.2.0'), true)
  assert.equal(versionAllowed(releases, 'v1.1.0'), false)
  assert.equal(versionAllowed(releases, ''), false)
  assert.equal(versionAllowed([], 'v1.3.0'), false)
})

test('thêm bản phát hành mới đẩy bản cũ nhất ra ngoài', () => {
  let r: string[] = []
  r = addRelease(r, 'v1.0.0')
  r = addRelease(r, 'v1.1.0')
  r = addRelease(r, 'v1.2.0')
  assert.deepEqual(r, ['v1.2.0', 'v1.1.0'])
  r = addRelease(r, 'v1.2.0')
  assert.deepEqual(r, ['v1.2.0', 'v1.1.0'])
})
