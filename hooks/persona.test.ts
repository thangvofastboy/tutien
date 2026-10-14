import { expect, test } from 'claude-code/testing'
import { PERSONAS, personaById, buildPersonaPrompt, parsePersonaLines, pickPersonaLine } from './persona'

test('có đủ 7 persona, mỗi cái có tên, câu cửa miệng và thoại', () => {
  expect(PERSONAS.length).toBe(7)
  for (const p of PERSONAS) {
    expect(p.id.length).toBeGreaterThan(0)
    expect(p.catchphrase.length).toBeGreaterThan(0)
    expect(p.lines.length).toBeGreaterThanOrEqual(5)
  }
  expect(personaById('lam-loi')?.name).toBe('Lầy Lội')
  expect(personaById('khong-co')).toBe(null)
})

test('prompt tự nhập: cắt mô tả ở 200 ký tự và yêu cầu đúng 15 câu', () => {
  const long = 'x'.repeat(500)
  const prompt = buildPersonaPrompt(long)
  expect(prompt.includes('x'.repeat(200))).toBe(true)
  expect(prompt.includes('x'.repeat(201))).toBe(false)
  expect(prompt.includes('15')).toBe(true)
})

test('phân tích phản hồi model: bỏ dòng rỗng, cắt câu quá 120 ký tự, tối đa 15 câu', () => {
  const raw = ['', 'Câu một.', '  ', 'a'.repeat(200), ...Array.from({ length: 20 }, (_, i) => `Câu ${i}.`)].join('\n')
  const lines = parsePersonaLines(raw)
  expect(lines.length).toBe(15)
  expect(lines.every(l => l.length <= 120)).toBe(true)
  expect(lines.includes('')).toBe(false)
})

test('trộn thoại persona với thoại chung ở tỷ lệ 50/50 (tất định theo seed)', () => {
  const persona = personaById('lam-loi')!
  const common = ['chung một', 'chung hai', 'chung ba']
  const picks = Array.from({ length: 100 }, (_, i) => pickPersonaLine(persona, i, common))
  const own = picks.filter(p => persona.lines.includes(p)).length
  expect(own).toBe(50)
})

import { paneLine } from './persona'

test('thoại pane: có persona thì nửa số lần là thoại persona; thoại tùy chỉnh được ưu tiên', () => {
  const state = { realm: 5 }
  const a = paneLine(state, 'lanh-lung', null, 0)
  expect(personaById('lanh-lung')!.lines.includes(a)).toBe(true)
  const custom = ['Câu riêng một.', 'Câu riêng hai.']
  expect(custom.includes(paneLine(state, 'tuy-chinh', custom, 2))).toBe(true)
  expect(typeof paneLine(state, null, null, 3)).toBe('string')
  expect(/[一-鿿]/.test(paneLine(state, 'cuong-code', null, 1))).toBe(false)
})
