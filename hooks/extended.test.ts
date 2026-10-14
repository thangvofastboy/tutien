import { expect, test } from 'claude-code/testing'
import { historyChart, statusLines, findLines, libraryLines, artifactNames } from './views'
import { breakCheck, sumTranscript, personaSection } from './session'
import { accountFromConfig } from './api'
import { boardLines } from './pane'
import { webState } from './web'
import { newPlayer } from './rules'
import { holidaysOf, vnDay, upcomingHolidays } from './holidays'

test('biểu đồ 14 ngày bằng ký tự khối', () => {
  const days = Array.from({ length: 14 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, pct: i * 8 }))
  const lines = historyChart(days)
  expect(lines[1]).toContain('█')
  expect(lines[2]).toContain('10-01')
})

test('trạng thái mở rộng: nhiệm vụ, tông, pháp bảo, không lộ số token', () => {
  const s = { quest: { pct: 40, done: 3 }, bicanh: null, holiday: null, pills: { bag: ['Đan Tốc Tu'], active: [] }, beQuanUntil: null, linhThach: 15, badges: ['kim-dan'], artifacts: ['e', 'e', 'T'], floor: 2, streak: 5, tamma: null, tammaWins: 1, congrats: 0, devices: 2, equipped: null }
  const soc = { tong: { name: 'Thanh Vân', role: 'Đệ Tử', weekPct: 30, paused: true }, companion: 'b', partner: null, invites: [{ from: 'c', kind: 'dao-lu' }], title: null, event: { active: true, name: 'Thiên Đạo Khoan Dung', desc: 'x' } }
  const text = statusLines('ThangVo', newPlayer('Kiếm Tu', 'Nam'), s, soc, 0).join('\n')
  expect(text).toContain('Nhiệm vụ ngày: 40%')
  expect(text).toContain('bonus chức vụ đang tạm dừng')
  expect(text).toContain('Tụ Linh Bình ×2')
  expect(text).toContain('/tutien dao-lu chap-nhan c')
  expect(text).toContain('2 máy')
  expect(/\d{4,}/.test(text.replace(/2026|\d{2}-\d{2}/g, ''))).toBe(false)
  expect(artifactNames(['D'])).toBe('Hộ Mệnh Ngọc Hiếm')
})

test('tìm bạn tu và thư viện', () => {
  const f = findLines({ name: 'A', cls: 'Ma Tu', gender: 'Nữ', realmName: 'Kim Đan Sơ Kỳ', pct: 10, floor: 2, trib: null, persona: 'Lầy Lội', tong: { name: 'T', role: 'Đệ Tử' }, badges: ['x'] }, 0)
  expect(f.join('\n')).toContain('Lầy Lội')
  const lib = { artifacts: { e: { name: 'Tụ Linh Bình', desc: '+0,5%' } }, pills: {}, roles: {}, badges: { a: { name: 'B', desc: 'c' } }, shop: { k: { name: 'Khung', price: 3, buyable: true } }, holidays: [] }
  const l = libraryLines(lib, { artifacts: ['e'], badges: [], inventory: [] }).join('\n')
  expect(l).toContain('✅ Tụ Linh Bình')
  expect(l).toContain('⬜ B')
})

test('nhắc nghỉ sau 2 giờ liên tục; nghỉ hơn 20 phút thì đếm lại', () => {
  const H = 3_600_000
  expect(breakCheck(undefined, undefined, 0).remind).toBe(false)
  expect(breakCheck(0, 2 * H - 60_000, 2 * H).remind).toBe(true)
  expect(breakCheck(0, H, 2 * H).remind).toBe(false)
})

test('đối chiếu transcript: cộng đúng ngày, bỏ trùng theo id', () => {
  const line = (id: string, ts: string, n: number) => JSON.stringify({ requestId: 'r', timestamp: ts, message: { id, usage: { input_tokens: n, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 999 } } })
  const text = [line('a', '2026-10-14T05:00:00Z', 100), line('a', '2026-10-14T05:00:00Z', 100), line('b', '2026-10-13T05:00:00Z', 50), 'không phải json'].join('\n')
  expect(sumTranscript(text, '2026-10-14', new Set())).toBe(101)
})

test('mã tài khoản Claude chỉ lấy accountUuid hợp lệ', () => {
  expect(accountFromConfig(JSON.stringify({ oauthAccount: { accountUuid: '123e4567-e89b-12d3-a456-426614174000', emailAddress: 'x@y' } }))).toBe('123e4567-e89b-12d3-a456-426614174000')
  expect(accountFromConfig('{}')).toBe('')
  expect(accountFromConfig('rác')).toBe('')
})

test('persona cho Claude chỉ khi bật trong cài đặt', async () => {
  const fake = (vals: Record<string, unknown>) => ({ store: { get: async (k: string) => vals[k] } })
  expect(await personaSection(fake({ 'tutien.persona': 'lay-loi' }) as any)).toBe(null)
  const on = await personaSection(fake({ 'tutien.claudePersona': 'on', 'tutien.persona': 'lam-loi', 'tutien.name': 'ThangVo' }) as any)
  expect(on).toContain('ThangVo')
  expect(on).toContain('Lầy Lội')
  expect(on).toContain('độ chính xác')
})

test('bảng trong pane: 5 người đầu và hàng của mình; web mini kèm bảng', () => {
  const rows = [1, 2, 3, 4, 5, 6].map(n => ({ rank: n, name: `p${n}`, cls: 'Ma Tu', realm: 3, score: 10 })).concat([{ rank: 9, name: 'Me', cls: 'Ma Tu', realm: 2, score: 5 }])
  const l = boardLines(rows, 'me')
  expect(l.length).toBe(6)
  expect(l[0].text.startsWith('🥇')).toBe(true)
  expect(l[5].mine).toBe(true)
  const w: any = webState('Me', newPlayer('Ma Tu', 'Nam'), 0, rows)
  expect(w.board.find((r: any) => r.me).name).toBe('Me')
})

test('lịch lễ: Tết 2026 năm ngày, ngày giờ Việt Nam', () => {
  expect(holidaysOf(2026).find(h => h.name === 'Tết Nguyên Đán')?.days.length).toBe(5)
  expect(vnDay(Date.parse('2026-10-14T18:00:00Z'))).toBe('2026-10-15')
  expect(upcomingHolidays(Date.parse('2026-08-25T00:00:00Z'), 10).some(h => h.name === 'Quốc Khánh')).toBe(true)
})
