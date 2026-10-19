import test from 'node:test'
import assert from 'node:assert/strict'
import { register, handleUsage } from './logic.ts'
import {
  recordDay, lastDays, streak, questStep, QUEST_TOKENS, bicanhJoin, bicanhStep, holidayStep, craftPill, usePill,
  beQuanStart, floorsStep, topFloor, giftStep, GIFT_DAILY_CAP, sellArtifact, buyItem, reconcileStep, journal, weekKey, capReached, grantArtifact,
} from './extras.ts'
import { newPlayer, applyUsage, effects } from '../../hooks/rules.ts'
import { vnDay, holidaysOf, holidayOn } from '../../hooks/holidays.ts'

const DAY = 86_400_000
const T0 = Date.parse('2026-10-01T03:00:00Z') // 10:00 giờ Việt Nam, ngày 1 tháng 10
const never = () => 0.99

test('lịch sử: cộng theo ngày UTC+7, chỉ giữ 90 ngày, 14 ngày gần nhất đủ ngày trống', () => {
  let h = recordDay({}, T0 - 100 * DAY, 5, 0, [])
  h = recordDay(h, T0, 1000, 1, ['breakthrough'])
  h = recordDay(h, T0, 500, 0, [])
  assert.equal(Object.keys(h).length, 1)
  assert.equal(h[vnDay(T0)].t, 1500)
  assert.equal(h[vnDay(T0)].ev?.breakthrough, 1)
  assert.equal(lastDays(h, T0, 14).length, 14)
  assert.equal(streak(h, T0), 1)
})

test('nhiệm vụ ngày: 500.000 token tính một lần mỗi ngày; 10 lần thì có thưởng', () => {
  let h = recordDay({}, T0, QUEST_TOKENS, 0, [])
  let r = questStep(h, { done: 9 }, T0)
  assert.equal(r.completed, true)
  assert.equal(r.reward, true)
  r = questStep(r.history, r.quest, T0)
  assert.equal(r.completed, false)
})

test('bí cảnh tháng: ghi danh ngày 1–2, đủ 7 ngày mỗi ngày 1 triệu thì hoàn thành, thiếu một ngày thì thất bại', () => {
  const p = newPlayer('Kiếm Tu', 'Nam')
  const j = bicanhJoin(undefined, p, T0)
  assert.equal(j.bicanh?.status, 'joined')
  assert.ok(bicanhJoin(undefined, p, T0 + 3 * DAY).error)
  let h: any = {}
  for (let d = 0; d < 7; d++) h = recordDay(h, T0 + d * DAY, 1_000_000, 0, [])
  assert.equal(bicanhStep(j.bicanh, h, T0 + 7 * DAY).result, 'done')
  const miss = { ...h }
  delete miss[vnDay(T0 + 2 * DAY)]
  assert.equal(bicanhStep(j.bicanh, miss, T0 + 4 * DAY).result, 'failed')
})

test('lễ hội: Quốc khánh 2 ngày cần 6 triệu; token khi đang thiên phạt không tính', () => {
  const qk = Date.parse('2026-09-01T03:00:00Z')
  assert.equal(holidayOn(vnDay(qk))?.name, 'Quốc Khánh')
  let r = holidayStep({}, qk, 3_000_000, true)
  assert.deepEqual(r.holidays, {})
  r = holidayStep({}, qk, 3_000_000, false)
  r = holidayStep(r.holidays, qk + DAY, 3_000_000, false)
  assert.equal(r.done?.name, 'Quốc Khánh')
  assert.ok(holidaysOf(2026).some(h => h.name === 'Tết Nguyên Đán'))
})

test('luyện đan: tiêu pháp bảo cùng loại, túi tối đa 2, Tốc Tu 14 ngày một lần, một viên hiệu lực', () => {
  let p = { ...newPlayer('Kiếm Tu', 'Nam'), artifacts: ['e', 'e', 'e', 'd'] as any }
  let c = craftPill(p, undefined, 'toc-tu')
  assert.deepEqual(c.p?.artifacts, ['e', 'e', 'd'])
  c = craftPill(c.p!, c.pills, 'toc-tu')
  assert.ok(craftPill(c.p!, c.pills, 'ho-the').error)
  const u = usePill(c.p!, c.pills, 'toc-tu', T0)
  assert.equal(u.pills?.active?.tocTuUntil, T0 + DAY)
  assert.ok(usePill(c.p!, u.pills, 'toc-tu', T0 + 2 * DAY).error)
  assert.ok(craftPill(newPlayer('Kiếm Tu', 'Nam'), undefined, 'ho-the').error)
})

test('bế quan: 1–14 ngày, không khi đang thiên phạt, tối đa 2 lần mỗi quý; trong bế quan không nhận EXP', () => {
  const p = newPlayer('Kiếm Tu', 'Nam')
  assert.ok(beQuanStart(undefined, p, 15, T0).error)
  const a = beQuanStart(undefined, p, 3, T0)
  assert.equal(a.beQuan?.until, T0 + 3 * DAY)
  const b = beQuanStart({ log: [T0, T0 + 1] }, p, 3, T0 + 5 * DAY)
  assert.ok(b.error)
  let st = { ...register('a', 'Kiếm Tu', 'Nam', 'h'), beQuan: a.beQuan }
  st = handleUsage(st, { turnId: 'x', tokens: 100_000 }, T0 + 1000, never).state
  assert.equal(st.player.exp, 0)
})

test('tháp thử luyện, đạo lữ, chợ, đối chiếu, nhật ký', () => {
  const f = floorsStep({}, 7, T0)
  assert.equal(topFloor(f), 2)
  const g = giftStep(undefined, 50_000, T0)
  assert.equal(g.give, GIFT_DAILY_CAP)
  assert.equal(giftStep(g.gift, 10, T0).give, 0)
  const s = sellArtifact({ ...newPlayer('Kiếm Tu', 'Nam'), artifacts: ['T'] }, 0, 'T')
  assert.equal(s.linhThach, 25)
  assert.ok(buyItem([], 10, 'khung-may').error)
  assert.deepEqual(buyItem([], 30, 'khung-may').inventory, ['khung-may'])
  const h = recordDay({}, T0, 5_000_000, 0, [])
  assert.equal(reconcileStep(h, [], vnDay(T0), 1_000_000).suspicious, true)
  assert.equal(reconcileStep(h, [], vnDay(T0), 4_900_000).suspicious, false)
  assert.ok(journal(h, T0)[0].includes('Nhật Ký'))
  assert.equal(weekKey(Date.parse('2026-10-15T03:00:00Z')), '2026-10-12')
})

test('pháp bảo vượt trần tự đổi thành linh thạch', () => {
  const p = { ...newPlayer('Kiếm Tu', 'Nam'), artifacts: ['E'] as any }
  assert.equal(capReached(p, 'e'), true)
  const g = grantArtifact(p, 'e', 0)
  assert.equal(g.converted, true)
  assert.equal(g.linhThach, 10)
})

test('bonus ngoài: chức vụ chung trần pháp bảo; đan Tốc Tu và sự kiện Thiên Đạo ngoài trần', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), artifacts: ['e', 'e', 'e'] as any }
  assert.equal(effects(p, { exp: 0.01 }).expMult, effects(p).expMult)
  assert.ok(Math.abs(effects(p, { pillExp: 0.1 }).expMult - effects(p).expMult - 0.1) < 1e-9)
  assert.ok(effects(newPlayer('Thể Tu', 'Nam'), { eventTrib: 0.1 }).tribMult < 1)
  assert.equal(effects(newPlayer('Thể Tu', 'Nam'), { halfDeath: true }).deathChance, 0.01)
  assert.equal(applyUsage(newPlayer('Thể Tu', 'Nam'), 100_000, T0, never, { pillExp: 0.1 }).p.exp, 110)
})

test('lượt chat: nhiệm vụ ngày, thành tựu, lịch sử được cập nhật', () => {
  let st = register('a', 'Thể Tu', 'Nam', 'h')
  const out = handleUsage(st, { turnId: 'q', tokens: 600_000 }, T0, never)
  assert.ok(out.events.includes('quest-done'))
  assert.equal(out.state.quest?.done, 1)
  assert.equal(out.state.history?.[vnDay(T0)].t, 600_000)
  assert.equal(out.gainedExp, 600)
})

test('hai lượt liên tiếp: lịch sử, nhiệm vụ, đan tiếp tục cập nhật (không bị trạng thái cũ ghi đè)', () => {
  let st: any = register('a', 'Thể Tu', 'Nam', 'h')
  st = handleUsage(st, { turnId: 'one', tokens: 300_000 }, T0, never).state
  st = { ...st, pills: { bag: [], active: { hoThe: true } } }
  const out = handleUsage(st, { turnId: 'two', tokens: 300_000 }, T0 + 1000, never)
  assert.equal(out.state.history?.[vnDay(T0)].t, 600_000)
  assert.equal(out.state.quest?.done, 1)
  assert.ok(out.events.includes('quest-done'))
})

import { handleGift, FLAG_AT } from './logic.ts'
test('quà đạo lữ: không nhận khi bế quan, đang thiên phạt hoặc bị đánh dấu; bình thường thì cộng EXP', () => {
  const base: any = register('b', 'Thể Tu', 'Nam', 'h')
  assert.ok(handleGift(base, 100, T0, never).state.player.exp > 0)
  assert.equal(handleGift({ ...base, beQuan: { until: T0 + DAY, log: [] } }, 100, T0, never).given, 0)
  assert.equal(handleGift({ ...base, suspicion: FLAG_AT }, 100, T0, never).given, 0)
  const trib = { ...base, player: { ...base.player, trib: { startedAt: 0, deadline: T0 + DAY, required: 10, earned: 0 } } }
  assert.equal(handleGift(trib, 100, T0, never).given, 0)
})

import { renameLock } from './logic.ts'
import { acceptRow } from './social.ts'
test('đổi tên: khóa ngay trong DO; lần thứ hai cùng lúc bị từ chối; 7 ngày một lần', () => {
  const st: any = register('c', 'Thể Tu', 'Nam', 'h')
  const a = renameLock(st, T0)
  assert.equal(a.error, undefined)
  assert.ok(renameLock(a.state, T0 + 10).error)
  assert.ok(renameLock({ ...st, renamedAt: T0 - DAY }, T0).error)
  assert.equal(renameLock({ ...a.state, renaming: undefined }, T0 + 120_000).error, undefined)
})
test('roster bỏ qua hàng của tên đã đổi đi, trừ khi có người ghi danh lại tên đó', () => {
  assert.equal(acceptRow(['old'], 'Old', false), false)
  assert.equal(acceptRow(['old'], 'Old', true), true)
  assert.equal(acceptRow([], 'X', false), true)
})

test('luyện đan: tên loại trùng thuộc tính Object (constructor) bị từ chối, không ném', () => {
  assert.ok(craftPill(newPlayer('Kiếm Tu', 'Nam'), undefined, 'constructor' as any).error)
})
