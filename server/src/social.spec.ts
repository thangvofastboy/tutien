import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptySocial, tongCreate, tongJoin, tongLeave, tongAppoint, tongWeek, ctxFor, invite, accept, unpair, memberOf,
  canCongrats, seasonStep, titleOf, community, teamProgress, tongBoard, thienDaoEvent, renameSocial, type Snap,
} from './social.ts'

const WED = Date.parse('2026-10-14T03:00:00Z') // thứ Tư, giờ Việt Nam
const snap = (name: string, realm: number, extra: Partial<Snap> = {}): Snap => ({ name, realm, wk: 0, lwk: 0, mo: 0, lmo: 0, ...extra })

test('tông: lập cần bậc 10, tối đa 10 người, tông chủ không rời khi còn người', () => {
  let s = emptySocial()
  assert.ok(tongCreate(s, 'Thanh Vân', 'a', 9).error)
  s = tongCreate(s, 'Thanh Vân', 'a', 10).s!
  for (let i = 0; i < 9; i++) s = tongJoin(s, 'thanh vân', `m${i}`).s!
  assert.ok(tongJoin(s, 'Thanh Vân', 'z').error)
  assert.ok(tongLeave(s, 'a').error)
  assert.equal(memberOf(s, 'M3')?.role, 'de-tu')
})

test('bổ nhiệm: chỉ tông chủ, đủ bậc, giới hạn số chỗ', () => {
  let s = tongCreate(emptySocial(), 'Tx', 'a', 10).s!
  s = tongJoin(s, 'Tx', 'b').s!
  s = tongJoin(s, 'Tx', 'c').s!
  assert.ok(tongAppoint(s, 'b', 'c', 'chan-truyen', 1).error)
  assert.ok(tongAppoint(s, 'a', 'b', 'pho-tong-chu', 5).error)
  s = tongAppoint(s, 'a', 'b', 'pho-tong-chu', 7).s!
  assert.ok(tongAppoint(s, 'a', 'c', 'pho-tong-chu', 7).error)
})

test('bonus: tán tu +0,5%; chức vụ bị tạm dừng khi tuần trước tông chưa đạt; đồng hành +0,5%', () => {
  assert.equal(ctxFor(emptySocial(), [snap('x', 1)], 'x', WED).exp, 0.005)
  let s = tongCreate(emptySocial(), 'Tx', 'a', 10).s!
  s = { ...s, tongs: { tx: { ...s.tongs.tx, createdAt: WED - 30 * 86_400_000 } } }
  assert.equal(ctxFor(s, [snap('a', 10, { lwk: 0 })], 'a', WED).exp, 0)
  assert.equal(ctxFor(s, [snap('a', 10, { lwk: 3_000_000 })], 'a', WED).exp, 0.01)
  let c = invite(emptySocial(), 'x', 'y', 'ban', WED).s!
  c = accept(c, 'y', 'x', 'ban').s!
  assert.equal(ctxFor(c, [snap('x', 1), snap('y', 1, { lastAt: WED - 1000 })], 'x', WED).exp, 0.01)
  assert.ok(unpair(c, 'x', 'ban').s)
})

test('nhiệm vụ tuần tông: mục tiêu 2 triệu × số thành viên, người dưới 400.000 bị ghi tên', () => {
  let s = tongCreate(emptySocial(), 'Tx', 'a', 10).s!
  s = tongJoin(s, 'Tx', 'b').s!
  const w = tongWeek(s.tongs.tx, [snap('a', 10, { wk: 2_000_000, lwk: 3_900_000 }), snap('b', 1, { lwk: 100_000 })])
  assert.equal(w.target, 4_000_000)
  assert.equal(w.pct, 50)
  assert.equal(w.lastOk, true)
  assert.deepEqual(w.weak, ['b'])
})

test('đạo lữ một người; chúc mừng trong 24 giờ; mùa; cộng đồng; tiến độ team; Thiên Đạo cuối tuần', () => {
  let s = invite(emptySocial(), 'x', 'y', 'dao-lu', WED).s!
  s = accept(s, 'y', 'x', 'dao-lu').s!
  assert.ok(invite(s, 'x', 'z', 'dao-lu', WED).error)
  assert.equal(canCongrats(snap('y', 4, { lastBreakthroughAt: WED - 3600_000 }), WED), true)
  assert.equal(canCongrats(snap('y', 4, { lastBreakthroughAt: WED - 2 * 86_400_000 }), WED), false)
  const q4 = Date.parse('2026-10-05T03:00:00Z')
  assert.equal(seasonStep(emptySocial(), 'Top', q4).seasons['2026-Q3'], undefined) // mùa trước server chưa có ai
  const season = seasonStep({ ...emptySocial(), seen: ['2026-Q3'] }, 'Top', q4)
  assert.equal(season.seasons['2026-Q3'], 'Top')
  assert.equal(titleOf(season, 'top', q4), 'Quán Quân 2026-Q3')
  assert.equal(community([snap('a', 1, { lmo: 100_000_000 })]).rewardActive, true)
  assert.equal(teamProgress([snap('a', 33), snap('b', 0)]), 50)
  assert.equal(thienDaoEvent(WED).active, false)
  assert.equal(thienDaoEvent(Date.parse('2026-10-17T03:00:00Z')).active, true)
  assert.equal(tongBoard(tongCreate(emptySocial(), 'Tx', 'a', 10).s!, [snap('a', 12)])[0].power, 12)
})

test('đổi tên cập nhật tông, đồng hành, đạo lữ, lời mời', () => {
  let s = tongCreate(emptySocial(), 'Tx', 'old', 10).s!
  s = accept(invite(s, 'old', 'y', 'ban', WED).s!, 'y', 'old', 'ban').s!
  const r = renameSocial(s, 'old', 'New')
  assert.equal(r.tongs.tx.owner, 'New')
  assert.equal(r.companions['y'], 'new')
  assert.equal(memberOf(r, 'new')?.role, 'tong-chu')
})

import { congratsOnce } from './social.ts'
test('chúc mừng: mỗi người một lần cho mỗi lần đột phá', () => {
  const a = congratsOnce(emptySocial(), 'x', 'y', 123)
  assert.ok(a.s)
  assert.ok(congratsOnce(a.s!, 'X', 'Y', 123).error)
  assert.ok(congratsOnce(a.s!, 'x', 'y', 456).s)
})
