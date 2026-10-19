import test from 'node:test'
import assert from 'node:assert/strict'
import { register, handleUsage, mergeStates, type State } from './logic.ts'
import { maybeKyNgo, resolveKyNgo, kyNgoView, learn, resetCongPhap, featureExtra, streakStep, streakDays, duel, congPhapOf, treeView, KY_NGO, KY_NGO_PER_DAY, RESET_COST } from './features.ts'
import { cpEffects, TREES } from './congphap.ts'
import { tongWar, teamWeek, baiSu, nhanDo, suDoHuy, ctxFor, emptySocial, tongCreate, tongJoin, removeSocial, type Snap } from './social.ts'
import { vnDay } from '../../hooks/holidays.ts'
import { need } from '../../hooks/rules.ts'

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

test('công pháp: mỗi lớp một cây riêng, học tốn điểm, có trần, tẩy tủy hoàn điểm', () => {
  const st = { ...fresh(), player: { ...fresh().player, realm: 3 } } // Kiếm Tu, 2 điểm
  const a = learn(st, 'nhat-kiem')
  assert.deepEqual(a.congPhap, { points: 1, learned: { 'nhat-kiem': 1 } })
  assert.match(a.text!, /Thanh Trúc Phong Vân Kiếm/)
  assert.match(a.text!, /Phàm Nhân Tu Tiên/)
  assert.ok(learn(st, 'huyet-ma').error) // công pháp của Ma Tu
  const b = learn({ ...st, congPhap: a.congPhap }, 'nhat-kiem')
  assert.equal(b.congPhap!.points, 0)
  assert.ok(learn({ ...st, congPhap: b.congPhap }, 'kiem-tam').error) // hết điểm
  assert.equal(featureExtra({ ...st, congPhap: b.congPhap }).pillExp, 0.006)
  assert.ok(resetCongPhap({ ...st, congPhap: b.congPhap, linhThach: 0 }).error)
  const r = resetCongPhap({ ...st, congPhap: b.congPhap, linhThach: RESET_COST + 1 })
  assert.deepEqual(r.congPhap, { points: 2, learned: {} })
  assert.equal(r.linhThach, 1)
})

test('công pháp: tuyệt kỹ cần đủ 6 tầng; đổi lớp thì hoàn điểm công pháp lớp cũ', () => {
  const st = { ...fresh(), congPhap: { points: 5, learned: { 'nhat-kiem': 3, 'kiem-tam': 2 } } }
  assert.match(learn(st, 'van-kiem').error!, /6 tầng/)
  const six = learn(st, 'kiem-tam').congPhap!
  const ult = learn({ ...st, congPhap: six }, 'van-kiem')
  assert.match(ult.text!, /TUYỆT KỸ/)
  const ma = { ...st, player: { ...st.player, cls: 'Ma Tu' } }
  assert.deepEqual(congPhapOf(ma), { points: 10, learned: {} })
  assert.equal(treeView(ma).school, 'Nhật Nguyệt Thần Giáo')
  assert.equal(treeView(ma).schoolFrom, 'Tiếu Ngạo Giang Hồ')
  assert.equal(treeView(ma).skills.length, 5)
  assert.ok(cpEffects({ ...st, congPhap: { points: 0, learned: { 'kiem-tam': 2 } } }).duel === 8)
})

test('công pháp: lớp nào cũng có 4 công pháp thường và 1 tuyệt kỹ', () => {
  for (const [cls, t] of Object.entries(TREES)) {
    const sk = Object.values(t.skills)
    assert.equal(sk.length, 5, cls)
    assert.equal(sk.filter(s => s.ult).length, 1, cls)
    for (const x of sk) assert.ok(x.from && x.flavor, `${cls}: ${x.name} cần ghi xuất xứ và lời đùa`)
  }
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

test('chuỗi ngày: đếm tiếp qua 90 ngày nhờ bộ đếm đã lưu, tới được mốc 100', () => {
  const history: State['history'] = {}
  for (let i = 0; i < 90; i++) history[vnDay(NOW - i * DAY)] = { t: 1000, e: 1 }
  const st = { ...fresh(), history, streakRun: { day: vnDay(NOW - DAY), n: 99 }, streakClaimed: [3, 7, 14, 30] }
  assert.equal(streakDays(st, NOW), 100)
  const r = streakStep(st, NOW, always)
  assert.ok(r.events.includes('streak:100'))
  assert.ok(r.state.badges!.includes('dao-tam'))
  assert.equal(streakDays({ ...fresh(), streakRun: { day: vnDay(NOW - DAY), n: 99 } }, NOW), 0) // hôm nay chưa tu
})

test('kỳ ngộ: EXP đi qua luật thường, đủ EXP thì khởi động thiên phạt (không nhảy bậc)', () => {
  const st = { ...fresh(), kyNgo: { id: 'ao-canh', at: NOW } }
  const r = resolveKyNgo({ ...st, player: { ...st.player, exp: need(1) - 1 } }, 'a', NOW, always)
  assert.ok(r.events!.includes('tribulation-started'))
  assert.equal(r.state!.player!.realm, 1)
  // Đang thiên phạt: EXP hóa thành linh thạch.
  const t = resolveKyNgo({ ...st, player: { ...st.player, trib: { startedAt: NOW, deadline: NOW + DAY, required: 10, earned: 0 } } }, 'a', NOW, always)
  assert.equal(t.state!.linhThach, 5)
})

test('gộp nhân vật: pháp bảo đi qua trần, bậc nhảy lên cho điểm công pháp', () => {
  const main = fresh()
  const old = { ...fresh(), player: { ...fresh().player, realm: 4, artifacts: Array(40).fill('e') } }
  const m = mergeStates(main, old)
  assert.ok(m.player.artifacts.length < 40)
  assert.ok((m.linhThach ?? 0) > 0)
  assert.equal(m.congPhap!.points, m.player.realm - 1)
})

test('bị đánh dấu thì không nhận thưởng chuỗi ngày', () => {
  const history: State['history'] = {}
  for (let i = 1; i < 7; i++) history[vnDay(NOW - i * DAY)] = { t: 1000, e: 1 }
  const out = handleUsage({ ...fresh(), history, suspicion: 100 }, { turnId: 'f', tokens: 1000 }, NOW, always)
  assert.ok(!out.events.some(e => e.startsWith('streak:')))
})

test('gộp xong: tên cũ rời tông, đạo lữ, sư đồ; tông chủ cũ nhường cho người còn lại', () => {
  let s = tongCreate(emptySocial(), 'Thanh Van', 'cu', 10).s!
  s = tongJoin(s, 'Thanh Van', 'b').s!
  s = { ...s, partners: { cu: 'c', c: 'cu' }, masters: { cu: 'su' } }
  const r = removeSocial(s, 'cu')
  assert.deepEqual(Object.keys(r.tongs['thanh van'].members), ['b'])
  assert.equal(r.tongs['thanh van'].owner, 'b')
  assert.deepEqual(r.partners, {})
  assert.deepEqual(r.masters, {})
})

test('gộp lúc đang thiên phạt: EXP dư vào kho, độ kiếp xong thì rót dần vào bậc mới', () => {
  const main = fresh()
  main.player = { ...main.player, exp: need(1), trib: { startedAt: NOW, deadline: NOW + DAY, required: 10, earned: 0 } }
  const old = { ...fresh(), player: { ...fresh().player, realm: 3, exp: 0 } }
  const m = mergeStates(main, old)
  assert.equal(m.player.realm, 1)
  assert.equal(m.expBank, need(1) + need(2))
  // Lượt kế: vượt thiên phạt → bậc 2, kho rót đủ trần bậc 2 → thiên phạt bậc 2 bắt đầu, còn lại need(1) trong kho.
  const out = handleUsage(m, { turnId: 'k', tokens: 100 }, NOW, () => 0.99)
  assert.ok(out.events.includes('breakthrough'))
  assert.ok(out.events.includes('tribulation-started'))
  assert.equal(out.state.player.realm, 2)
  assert.equal(out.state.expBank, need(1))
})

test('chuỗi ngày: sáng nay chưa tu lượt nào thì vẫn giữ chuỗi tới hôm qua, không báo 0', () => {
  const history: State['history'] = {}
  for (let i = 1; i <= 5; i++) history[vnDay(NOW - i * DAY)] = { t: 1000, e: 1 } // 5 ngày trước, hôm nay trống
  assert.equal(streakDays({ ...fresh(), history }, NOW), 5)
  history[vnDay(NOW)] = { t: 1000, e: 1 }
  assert.equal(streakDays({ ...fresh(), history }, NOW), 6)
  delete history[vnDay(NOW - DAY)] // hôm qua bỏ: chuỗi đứt
  delete history[vnDay(NOW)]
  assert.equal(streakDays({ ...fresh(), history }, NOW), 0)
})
