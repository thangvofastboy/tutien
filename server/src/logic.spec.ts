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

import { MAX_TOKENS_PER_TURN, validTurnId } from './logic.ts'

test('trần token mỗi lượt: phần vượt không được cộng', () => {
  let st = register('thang', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 'big', tokens: 999_000_000 }, NOW, never).state
  assert.equal(st.lifetimeTokens, MAX_TOKENS_PER_TURN)
})

test('turnId phải là chuỗi ngắn hợp lệ', () => {
  assert.equal(validTurnId('turn_abc-123'), true)
  assert.equal(validTurnId(''), false)
  assert.equal(validTurnId('x'.repeat(200)), false)
  assert.equal(validTurnId(42 as any), false)
})

import { publicBoard } from './logic.ts'

test('bảng công khai: chỉ hạng, tên, bậc và phần trăm — không lộ EXP hay token', () => {
  let a = register('a', 'Thể Tu', 'Nam', 'h')
  a = { ...a, player: { ...a.player, realm: 5, exp: 10 }, lifetimeTokens: 987_654 }
  const b = register('b', 'Thể Tu', 'Nam', 'h')
  const rows = publicBoard(boards([a, b], NOW).chamChi, 'chamchi', NOW)
  const json = JSON.stringify(rows)
  assert.equal(json.includes('987654'), false)
  assert.equal(json.includes('"exp"'), false)
  assert.equal(rows[0].rank, 1)
  assert.equal(rows[0].name, 'a')
  assert.equal(rows[0].score, 100)
})

test('bảng Tu vi hiện phần trăm tiến độ bậc', () => {
  let a = register('a', 'Thể Tu', 'Nam', 'h')
  a = { ...a, player: { ...a.player, realm: 1, exp: 4000 } }
  const rows = publicBoard(boards([a], NOW).tuVi, 'tu-vi', NOW)
  assert.equal(rows[0].score, 50)
})

import { MAX_TOKENS_PER_HOUR, MAX_TOKENS_PER_DAY, FLAG_AT } from './logic.ts'

test('trần mỗi giờ: phần vượt không được cộng', () => {
  let st = register('g', 'Thể Tu', 'Nam', 'h')
  for (let i = 0; i < 3; i++) st = handleUsage(st, { turnId: `h${i}`, tokens: 4_000_000 }, NOW + i * 1000, never).state
  assert.equal(st.lifetimeTokens, MAX_TOKENS_PER_HOUR)
})

test('trần mỗi ngày: phần vượt không được cộng', () => {
  let st = register('d', 'Thể Tu', 'Nam', 'h')
  for (let i = 0; i < 6; i++) st = handleUsage(st, { turnId: `d${i}`, tokens: 5_000_000 }, NOW + i * 3_600_000, never).state
  for (let i = 0; i < 6; i++) st = handleUsage(st, { turnId: `e${i}`, tokens: 5_000_000 }, NOW + (6 + i) * 3_600_000, never).state
  assert.equal(st.weekTokens[DAY_KEY(NOW)] <= MAX_TOKENS_PER_DAY, true)
})

test('lượt vượt trần mỗi lượt cộng điểm nghi ngờ', () => {
  let st = register('s', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 'big', tokens: 9_000_000 }, NOW, never).state
  assert.equal(st.suspicion >= 3, true)
})

test('5 lượt liên tiếp giống hệt nhau cộng điểm nghi ngờ', () => {
  let st = register('r', 'Thể Tu', 'Nam', 'h')
  for (let i = 0; i < 6; i++) st = handleUsage(st, { turnId: `r${i}`, tokens: 1234 }, NOW + i * 60_000, never).state
  assert.equal(st.suspicion >= 2, true)
})

test('lượt đến gần như cùng lúc (dưới 50 ms) cộng điểm nghi ngờ', () => {
  let st = register('b', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 'b1', tokens: 1000 }, NOW, never).state
  st = handleUsage(st, { turnId: 'b2', tokens: 2000 }, NOW + 10, never).state
  assert.equal(st.suspicion >= 1, true)
})

test('bị đánh dấu: EXP vẫn tăng nhưng không vào thiên phạt và bị ẩn khỏi bảng', () => {
  let st = register('f', 'Thể Tu', 'Nam', 'h')
  st = { ...st, suspicion: FLAG_AT }
  st = handleUsage(st, { turnId: 'f1', tokens: 5_000_000 }, NOW, never).state
  assert.equal(st.player.trib, undefined)
  assert.equal(st.player.exp < need(1), true)
  assert.equal(boards([st], NOW).tuVi.length, 0)
})

import { recordFail, isLocked } from './logic.ts'

test('sai khóa 20 lần trong một giờ thì bị khóa tạm, sang giờ sau thì mở', () => {
  let st = register('k', 'Thể Tu', 'Nam', 'h')
  for (let i = 0; i < 19; i++) st = recordFail(st, NOW + i)
  assert.equal(isLocked(st, NOW + 100), false)
  st = recordFail(st, NOW + 200)
  assert.equal(isLocked(st, NOW + 300), true)
  assert.equal(isLocked(st, NOW + 3_600_000 + 1000), false)
})
