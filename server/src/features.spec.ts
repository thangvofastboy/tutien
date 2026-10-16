import test from 'node:test'
import assert from 'node:assert/strict'
import { register, handleUsage, type State } from './logic.ts'
import { maybeKyNgo, resolveKyNgo, kyNgoView, learn, resetCongPhap, featureExtra, streakStep, duel, KY_NGO, KY_NGO_PER_DAY, RESET_COST } from './features.ts'
import { tongWar, teamWeek, baiSu, nhanDo, suDoHuy, ctxFor, emptySocial, tongCreate, tongJoin, type Snap } from './social.ts'
import { vnDay } from '../../hooks/holidays.ts'

const NOW = Date.UTC(2026, 9, 14, 12)
const DAY = 86_400_000
const fresh = (): State => register('thang', 'Kiếm Tu', 'Nam', 'h')
const always = () => 0

test('kỳ ngộ: gặp khi đủ token, không chồng kỳ ngộ, tối đa 3 lần mỗi ngày', () => {
  const st = fresh()
  assert.equal(maybeKyNgo(st, 1000, NOW, always).hit, false) // ít token quá
  const a = maybeKyNgo(st, 50_000, NOW, always)
  assert.equal(a.hit, true)
  assert.ok(KY_NGO[a.kyNgo!.id])
  assert.equal(maybeKyNgo({ ...st, ...a }, 50_000, NOW, always).hit, false) // đang chờ
  assert.equal(maybeKyNgo({ ...st, kyNgoDay: { day: vnDay(NOW), n: KY_NGO_PER_DAY } }, 50_000, NOW, always).hit, false)
  assert.equal(kyNgoView({ kyNgo: { id: 'linh-thao', at: NOW } }, NOW + DAY + 1), null) // hết hạn
})

test('kỳ ngộ: chọn hướng thì nhận kết quả, xóa kỳ ngộ đang chờ', () => {
  const st = { ...fresh(), kyNgo: { id: 'linh-thao', at: NOW } }
  assert.ok(resolveKyNgo(st, 'c', NOW, always).error)
  const r = resolveKyNgo(st, 'b', NOW, always) // w=7 đầu tiên: +8 linh thạch
  assert.equal(r.state!.linhThach, 8)
  assert.equal(r.state!.kyNgo, undefined)
  assert.match(r.text!, /Thương lái/)
  assert.ok(resolveKyNgo({ ...st, kyNgo: undefined }, 'a', NOW, always).error)
})

test('kỳ ngộ: Mộc Linh Căn nhân linh thạch 1,5', () => {
  const r = resolveKyNgo({ ...fresh(), linhCan: 'moc', kyNgo: { id: 'linh-thao', at: NOW } }, 'b', NOW, always)
  assert.equal(r.state!.linhThach, 12)
})

test('công pháp: học tốn điểm, có trần, tẩy tủy hoàn điểm và tốn linh thạch', () => {
  const st = { ...fresh(), player: { ...fresh().player, realm: 3 } } // 2 điểm
  const a = learn(st, 'kiem-y')
  assert.deepEqual(a.congPhap, { points: 1, learned: { 'kiem-y': 1 } })
  const b = learn({ ...st, congPhap: a.congPhap }, 'kiem-y')
  assert.equal(b.congPhap!.points, 0)
  assert.ok(learn({ ...st, congPhap: b.congPhap }, 'van-kiep').error)
  assert.ok(learn(st, 'khong-co').error)
  assert.equal(featureExtra({ congPhap: b.congPhap }).pillExp, 0.006)
  assert.ok(resetCongPhap({ ...st, congPhap: b.congPhap, linhThach: 0 }).error)
  const r = resetCongPhap({ ...st, congPhap: b.congPhap, linhThach: RESET_COST + 1 })
  assert.deepEqual(r.congPhap, { points: 2, learned: {} })
  assert.equal(r.linhThach, 1)
})

test('công pháp: đột phá cho thêm một điểm', () => {
  let st = fresh()
  st = { ...st, player: { ...st.player, exp: 0, trib: { startedAt: NOW, deadline: NOW + DAY, required: 10, earned: 0 } } }
  const out = handleUsage(st, { turnId: 'bt', tokens: 100 }, NOW, () => 0.99)
  assert.ok(out.events.includes('breakthrough'))
  assert.equal(out.state.congPhap!.points, 1)
})

test('chuỗi ngày: nhận thưởng ở mốc 3 và 7, đứt chuỗi thì mở lại mốc', () => {
  const history: State['history'] = {}
  for (let i = 0; i < 7; i++) history[vnDay(NOW - i * DAY)] = { t: 1000, e: 1 }
  const r = streakStep({ ...fresh(), history }, NOW, always)
  assert.deepEqual(r.state.streakClaimed, [3, 7])
  assert.equal(r.state.linhThach, 5)
  assert.equal(r.state.player!.artifacts.length, 1)
  assert.deepEqual(r.events, ['streak:3', 'streak:7'])
  const again = streakStep({ ...fresh(), history, streakClaimed: [3, 7] }, NOW, always)
  assert.deepEqual(again.events, [])
  const broken = streakStep({ ...fresh(), history: { [vnDay(NOW)]: { t: 1, e: 0 } }, streakClaimed: [3, 7] }, NOW, always)
  assert.deepEqual(broken.state.streakClaimed, [])
})

test('luận đạo: bậc cao thắng, linh căn tương khắc cộng điểm', () => {
  const r = duel({ name: 'A', realm: 10, artifacts: 0 }, { name: 'B', realm: 2, artifacts: 0 }, always)
  assert.equal(r.win, true)
  assert.match(r.log.at(-1)!, /A thắng/)
  const k = duel({ name: 'A', realm: 5, artifacts: 0, linhCan: 'thuy' }, { name: 'B', realm: 5, artifacts: 0, linhCan: 'hoa' }, always)
  assert.ok(k.log.some(l => l.includes('khắc')))
})

const snap = (name: string, realm: number, wk = 0, lwk = 0): Snap => ({ name, realm, wk, lwk, mo: 0, lmo: 0 })

test('tông chiến: tông thắng tuần trước có Linh Mạch', () => {
  let s = tongCreate(emptySocial(), 'Thanh Van', 'a', 10).s!
  s = tongJoin(s, 'Thanh Van', 'b').s!
  s = tongCreate(s, 'Ma Giao', 'c', 10).s!
  s = tongJoin(s, 'Ma Giao', 'd').s!
  const snaps = [snap('a', 10, 5, 100), snap('b', 1, 5, 100), snap('c', 10, 50, 10), snap('d', 1, 0, 0)]
  const w = tongWar(s, snaps)
  assert.equal(w.lastWinner, 'Thanh Van')
  assert.equal(w.standings[0].name, 'Ma Giao')
  const withMach = ctxFor(s, snaps, 'a', NOW).exp!
  const without = ctxFor(s, snaps, 'c', NOW).exp!
  assert.ok(withMach > without)
})

test('thiên kiếp đồng tâm: đủ mốc tuần thì cả team được bonus', () => {
  assert.equal(teamWeek([snap('a', 1, 1)]).done, false)
  const snaps = [snap('a', 1, 20_000_000), snap('b', 1, 1)]
  assert.equal(teamWeek(snaps).done, true)
  assert.equal(ctxFor(emptySocial(), snaps, 'b', NOW).pillExp, 0.01)
  assert.ok(ctxFor(emptySocial(), snaps, 'b', NOW).teamWeek)
})

test('sư đồ: bái sư, nhận đồ, đồ đệ được bonus, hủy được', () => {
  const s0 = emptySocial()
  assert.ok(baiSu(s0, snap('de', 1), snap('su', 3), NOW).error) // sư phụ chưa đủ bậc
  const s1 = baiSu(s0, snap('de', 1), snap('su', 9), NOW).s!
  assert.ok(nhanDo(s1, 'su', 'khac').error)
  const s2 = nhanDo(s1, 'su', 'de').s!
  assert.equal(s2.masters!.de, 'su')
  const base = ctxFor(s0, [snap('de', 1)], 'de', NOW).exp!
  assert.ok(ctxFor(s2, [snap('de', 1)], 'de', NOW).exp! > base)
  assert.deepEqual(suDoHuy(s2, 'su').s!.masters, {})
})
