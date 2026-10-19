import { expect, test } from 'claude-code/testing'
import { LINES, REALM_GROUPS, realmGroup, pickLine } from './lines'

test('11 đại cảnh giới, mỗi cái có nhóm thoại riêng', () => {
  expect(REALM_GROUPS.length).toBe(11)
  for (const g of REALM_GROUPS) expect(Array.isArray((LINES.realm as any)[g])).toBe(true)
  expect(realmGroup(1)).toBe('Luyện Khí')
  expect(realmGroup(33)).toBe('Tiên Đế')
})

test('pickLine luôn trả về chuỗi cho mọi bậc và mọi seed', () => {
  for (let r = 1; r <= 33; r++) {
    for (let s = 0; s < 40; s++) expect(typeof pickLine({ realm: r }, s)).toBe('string')
  }
})

test('cùng seed thì cùng câu (pane vẽ lại liên tục không làm câu nhảy); có nhóm câu vui', () => {
  for (let s = 0; s < 50; s++) expect(pickLine({ realm: 5 }, s)).toBe(pickLine({ realm: 5 }, s))
  expect(LINES.funny.length).toBeGreaterThanOrEqual(30)
  const seen = new Set<string>()
  for (let s = 0; s < 400; s++) seen.add(pickLine({ realm: 5 }, s))
  expect([...seen].some(l => (LINES.funny as readonly string[]).includes(l))).toBe(true)
})
