// hooks/features.ts — linh căn, kỳ ngộ, luận đạo, chuỗi ngày, công pháp, tông chiến, sư đồ, thẻ khoe, truyện tuần.
import { callServer, SERVER } from './api'
import { REALM_NAMES, type Player } from './rules'
import { realmColor } from './look'

type Res = { ok: boolean; status: number; data?: any; error?: string; upgrade?: boolean }
const fail = (r: Res) =>
  r.upgrade ? 'Server chưa nhận phiên bản mod này. Chạy /tutien update.' : r.status === 0 ? '🌱 Chưa ghi danh. Dùng /tutien start.' : (r.error ?? '☁️ Server đang bế quan, thử lại sau.')
const say = (r: Res) => (r.ok ? (r.data?.text ?? 'Xong.') : fail(r))

export const FEATURE_HELP = [
  '/tutien ky-ngo [a|b]                     🎲 xem và chọn kỳ ngộ',
  '/tutien linh-can                         🌈 linh căn ngũ hành của đạo hữu',
  '/tutien luan-dao <tên>                   ⚔️ luận đạo với đạo hữu khác (3 trận mỗi ngày)',
  '/tutien chuoi                            🔥 chuỗi ngày tu luyện và mốc thưởng',
  '/tutien cong-phap [hoc <id> | tay-tuy]   📖 cây công pháp',
  '/tutien tong-chien                       🏯 tông chiến tuần, Linh Mạch, Thiên Kiếp Đồng Tâm',
  '/tutien bai-su <tên> · nhan-do <tên> · su-do [huy]   🧑‍🏫 sư đồ',
  '/tutien the                              🪪 thẻ khoe nhân vật (ảnh SVG)',
  '/tutien truyen-tuan                      📜 truyện tu tiên tuần này, do Claude chấp bút',
].join('\n')

// ---------- Linh căn: đếm loại việc qua mỗi lần gọi tool ----------
export type Element = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho'
export const ELEMENTS: Record<Element, { name: string; icon: string; desc: string; color: string }> = {
  kim: { name: 'Kim Linh Căn', icon: '🗡️', desc: 'TypeScript, Go, Rust, Java… kiếm tu của code: +0,5% EXP', color: '#e3b341' },
  thuy: { name: 'Thủy Linh Căn', icon: '💧', desc: 'Python, SQL, dữ liệu chảy như suối: −1% token thiên phạt', color: '#79c0ff' },
  hoa: { name: 'Hỏa Linh Căn', icon: '🔥', desc: 'Chiến binh terminal: kỳ ngộ đến thường hơn', color: '#ff7b72' },
  tho: { name: 'Thổ Linh Căn', icon: '⛰️', desc: 'Viết test vững như núi: −0,05% tỷ lệ tử vong', color: '#d29922' },
  moc: { name: 'Mộc Linh Căn', icon: '🌿', desc: 'Tài liệu, giao diện xanh tươi: linh thạch kỳ ngộ ×1,5', color: '#56d364' },
}
const EXT: Record<string, Element> = {
  ts: 'kim', tsx: 'kim', js: 'kim', jsx: 'kim', mjs: 'kim', go: 'kim', rs: 'kim', java: 'kim', kt: 'kim', cs: 'kim', cpp: 'kim', c: 'kim', h: 'kim', swift: 'kim', rb: 'kim', php: 'kim',
  py: 'thuy', ipynb: 'thuy', r: 'thuy', sql: 'thuy', csv: 'thuy', json: 'thuy', parquet: 'thuy',
  md: 'moc', mdx: 'moc', txt: 'moc', html: 'moc', css: 'moc', scss: 'moc', vue: 'moc', svelte: 'moc', yml: 'moc', yaml: 'moc',
  sh: 'hoa', bash: 'hoa', zsh: 'hoa', ps1: 'hoa', dockerfile: 'hoa',
}
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']
export function classify(tool: string, input: Record<string, unknown>): Element | null {
  if (tool === 'Bash') return 'hoa'
  if (!EDIT_TOOLS.includes(tool)) return null
  const path = String(input.file_path ?? input.notebook_path ?? '').toLowerCase()
  if (!path) return null
  if (/(^|[/._-])(test|tests|spec|__tests__)([/._-])/.test(path)) return 'tho'
  const base = path.split('/').pop() ?? ''
  if (base === 'dockerfile' || base === 'makefile') return 'hoa'
  return EXT[base.split('.').pop() ?? ''] ?? null
}
export const MIN_ACTIONS = 20
export function dominant(counts: Partial<Record<Element, number>>): Element | null {
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  if (total < MIN_ACTIONS) return null
  return (Object.entries(counts) as [Element, number][]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
}
// Gọi sau mỗi tool: cộng một điểm, cứ 10 lần thì xem linh căn có đổi không và báo server.
export async function trackTool($: any, tool: string, input: Record<string, unknown>): Promise<void> {
  const el = classify(tool, input)
  if (!el) return
  const counts = ((await $.store.get('tutien.linhCanCounts')) as Partial<Record<Element, number>> | undefined) ?? {}
  // Giữ tỉ lệ khi số lớn, để linh căn đổi được khi đạo hữu đổi việc.
  const next: Partial<Record<Element, number>> = { ...counts, [el]: (counts[el] ?? 0) + 1 }
  const total = Object.values(next).reduce((a, b) => a + (b ?? 0), 0)
  if (total > 500) for (const k of Object.keys(next) as Element[]) next[k] = Math.floor((next[k] ?? 0) / 2)
  await $.store.set('tutien.linhCanCounts', next)
  if (total % 10 !== 0) return
  const d = dominant(next)
  if (!d || d === (await $.store.get('tutien.linhCan'))) return
  const r = await callServer($, '/profile', { linhCan: d }).catch(() => null)
  if (!r?.ok) return
  await $.store.set('tutien.linhCan', d)
  if ((await $.store.get('tutien.chatlines')) !== 'off') $.ui.log(`🌈 Linh Căn Thức Tỉnh: ${ELEMENTS[d].icon} ${ELEMENTS[d].name}! ${ELEMENTS[d].desc}`)
}

// ---------- Chữ cho các lệnh ----------
const KHAC: Record<Element, Element> = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' }
const bar = (pct: number, w = 12) => '█'.repeat(Math.round((pct / 100) * w)) + '░'.repeat(w - Math.round((pct / 100) * w))
const STREAK_MARKS = [3, 7, 14, 30, 100]

export function linhCanLines(counts: Partial<Record<Element, number>>, current: Element | null): string[] {
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const out = [current ? `🌈 Linh căn: ${ELEMENTS[current].icon} ${ELEMENTS[current].name}` : `🌫️ Linh căn chưa thức tỉnh (cần ${MIN_ACTIONS} lần sửa file hoặc chạy lệnh, mới có ${total})`]
  if (current) out.push(`   ${ELEMENTS[current].desc}`, `   ⚔️ Khắc ${ELEMENTS[KHAC[current]].icon} ${ELEMENTS[KHAC[current]].name} khi luận đạo`)
  out.push('', '📊 Ngũ hành của đạo hữu:')
  for (const k of Object.keys(ELEMENTS) as Element[]) {
    const pct = total ? Math.round(((counts[k] ?? 0) / total) * 100) : 0
    out.push(`   ${ELEMENTS[k].icon} ${ELEMENTS[k].name.padEnd(14)} ${bar(pct)} ${pct}%`)
  }
  out.push('', '💡 Kim: code · Thủy: Python, dữ liệu · Hỏa: terminal · Thổ: test · Mộc: tài liệu, giao diện')
  return out
}

export function streakLines(n: number): string[] {
  const next = STREAK_MARKS.find(m => m > n)
  const flames = n >= 30 ? '🔥🔥🔥' : n >= 7 ? '🔥🔥' : n > 0 ? '🔥' : '🧊'
  return [
    `${flames} Chuỗi tu luyện: ${n} ngày liên tục`,
    n === 0 ? '   Hôm nay chưa tu. Lò đan nguội rồi, nhóm lửa lại đi đạo hữu!' : `   ${next ? `Còn ${next - n} ngày nữa tới mốc ${next}.` : 'Đạo tâm bất diệt, không còn mốc nào cản nổi!'}`,
    '',
    '🎁 Mốc thưởng:',
    ...[['3', '+5 linh thạch'], ['7', '+1 pháp bảo'], ['14', '+20 linh thạch'], ['30', '+1 pháp bảo hiếm'], ['100', '🏅 Đạo Tâm Bất Diệt']]
      .map(([d, r]) => `   ${n >= Number(d) ? '✅' : '⬜'} ${d.padStart(3)} ngày: ${r}`),
  ]
}

export const CONG_PHAP_LIST: { id: string; name: string; icon: string; desc: string }[] = [
  { id: 'kiem-y', name: 'Kiếm Ý Tâm Pháp', icon: '⚔️', desc: '+0,3% EXP mỗi tầng' },
  { id: 'van-kiep', name: 'Vạn Kiếp Bất Diệt Thể', icon: '🛡️', desc: '−1% token thiên phạt mỗi tầng' },
  { id: 'kim-cang', name: 'Kim Cang Hộ Mệnh', icon: '💎', desc: '−0,03% tỷ lệ tử vong mỗi tầng' },
  { id: 'thien-co', name: 'Thiên Cơ Thuật', icon: '🔮', desc: '+1% cơ hội kỳ ngộ mỗi tầng' },
  { id: 'tu-bao', name: 'Tụ Bảo Quyết', icon: '💰', desc: '+2 linh thạch mỗi kỳ ngộ, trận thắng' },
]
export function congPhapLines(cp: { points: number; learned: { id: string; n: number }[] }): string[] {
  const have = (id: string) => cp.learned.find(l => l.id === id)?.n ?? 0
  return [
    `📖 Tàng Kinh Các · điểm công pháp: ${cp.points} ${cp.points ? '✨' : '(đột phá để nhận thêm)'}`,
    '',
    ...CONG_PHAP_LIST.map(c => `   ${c.icon} ${c.name} ${'★'.repeat(have(c.id))}${'☆'.repeat(3 - have(c.id))} · ${c.desc}\n      → /tutien cong-phap hoc ${c.id}`),
    '',
    '🧪 Tẩy tủy (học lại từ đầu, hoàn điểm): /tutien cong-phap tay-tuy · 20 linh thạch',
  ]
}

export function warLines(t: any): string[] {
  const out = ['🏯 Tông Chiến Tuần Này', '']
  const st: any[] = t.war?.standings ?? []
  if (!st.length) out.push('   Chưa có tông nào đủ 2 người tham chiến. Rủ đồng môn đi: /tutien tong tao <tên>')
  for (const r of st) out.push(`   ${r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}.`} ${r.name} (${r.members} người) ${bar(r.pct, 10)} ${r.pct}%`)
  out.push('', t.war?.lastWinner ? `⛲ Linh Mạch tuần này thuộc về ${t.war.lastWinner}: cả tông +0,5% EXP` : '⛲ Linh Mạch đang vô chủ. Tuần sau ai sẽ giành?')
  const tw = t.teamWeek
  if (tw) out.push('', `☄️ Thiên Kiếp Đồng Tâm (cả team): ${bar(tw.pct)} ${tw.pct}%`, tw.done ? '   ✅ Đã đạt! Mọi người +1% EXP đến hết tuần.' : '   Cả team cùng tu đủ mốc tuần thì ai cũng +1% EXP.')
  return out
}

export function kyNgoLines(k: any): string[] {
  if (!k) return ['🍃 Không có kỳ ngộ nào đang chờ. Cơ duyên như bug: không tìm thì nó tự đến.']
  return [k.title, `   ${k.desc}`, '', `   🅰️ ${k.a}  → /tutien ky-ngo a`, `   🅱️ ${k.b}  → /tutien ky-ngo b`, '', '⏳ Kỳ ngộ tan biến sau 24 giờ.']
}

// ---------- Thẻ khoe nhân vật: SVG tự chứa ----------
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export function cardSvg(c: { name: string; p: Player; png: string | null; linhCan: Element | null; streak: number; badges: number; linhThach: number; tong: string | null; title: string | null }): string {
  const color = realmColor(c.p.realm)
  const lc = c.linhCan ? ELEMENTS[c.linhCan] : null
  const row = (y: number, label: string, value: string, fill = '#e6edf3') =>
    `<text x="250" y="${y}" font-size="15" fill="#8b949e">${esc(label)}</text><text x="370" y="${y}" font-size="15" fill="${fill}" font-weight="600">${esc(value)}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320" font-family="system-ui, sans-serif">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset="1" stop-color="#1e2a44"/></linearGradient></defs>
<rect width="600" height="320" rx="18" fill="url(#bg)"/><rect x="6" y="6" width="588" height="308" rx="14" fill="none" stroke="${color}" stroke-width="2"/>
<circle cx="125" cy="150" r="98" fill="none" stroke="${color}" stroke-opacity="0.5" stroke-width="3"/>
${c.png ? `<image href="data:image/png;base64,${c.png}" x="29" y="54" width="192" height="192" style="image-rendering:pixelated"/>` : `<text x="125" y="165" font-size="64" text-anchor="middle">🧘</text>`}
<text x="250" y="62" font-size="28" fill="${color}" font-weight="700">${esc(c.name)}</text>
<text x="250" y="90" font-size="16" fill="#c9d1d9">${esc(`✦ ${REALM_NAMES[c.p.realm - 1]} ✦`)}${c.title ? `  👑 ${esc(c.title)}` : ''}</text>
${row(130, '⚔️ Lớp', `${c.p.cls} · ${c.p.gender}`)}
${row(158, '🌈 Linh căn', lc ? `${lc.icon} ${lc.name}` : 'chưa thức tỉnh', lc?.color)}
${row(186, '🔥 Chuỗi ngày', `${c.streak} ngày`, '#ffa657')}
${row(214, '🎁 Pháp bảo', String(c.p.artifacts.length))}
${row(242, '🏅 Huy hiệu', String(c.badges), '#ffd54f')}
${row(270, '🏯 Tông môn', c.tong ?? 'tán tu tự do')}
<text x="300" y="304" font-size="12" fill="#6e7681" text-anchor="middle">Tu Tiên Ký · tu luyện bằng token Claude Code</text>
</svg>`
}

// ---------- Truyện tuần do Claude viết ----------
export function storyPrompt(name: string, p: Player, s: any, days: { day: string; pct: number }[], persona: string | null): string {
  const active = days.filter(d => d.pct > 0).length
  return [
    'Viết một đoạn truyện tu tiên ngắn (120–180 chữ, tiếng Việt), giọng hài hước, nhiều hình ảnh, xưng hô kiểu tu tiên.',
    'Lồng ghép chuyện lập trình (bug, deploy, code review…) như thể là pháp thuật. Không bịa số liệu ngoài dữ kiện dưới đây.',
    'Chỉ trả về đoạn truyện, có một tiêu đề ngắn ở dòng đầu bắt đầu bằng 📜.',
    '',
    `Nhân vật: ${name}, ${p.cls}, ${p.gender}, cảnh giới ${REALM_NAMES[p.realm - 1]}.`,
    persona ? `Tính cách: ${persona}.` : '',
    `Tuần này tu luyện ${active}/7 ngày gần nhất, chuỗi ${s?.streak ?? 0} ngày liên tục.`,
    s?.linhCan ? `Linh căn: ${s.linhCan.name}.` : '',
    p.trib ? 'Đang chịu thiên phạt.' : '',
    s?.tammaWins ? `Đã xua đuổi Tâm Ma ${s.tammaWins} lần.` : '',
    s?.luanDao ? `Luận đạo: thắng ${s.luanDao.wins}, thua ${s.luanDao.losses}.` : '',
    `Pháp bảo: ${p.artifacts.length}. Linh thạch: ${s?.linhThach ?? 0}.`,
  ].filter(Boolean).join('\n')
}
const weekId = (now: number) => {
  const d = new Date(now + 7 * 3_600_000)
  const dow = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10)
}

// Trả về chữ cho lệnh tính năng mới, hoặc null nếu không phải. `card` là SVG khi lệnh tạo thẻ;
// `player` và `events` để register.ts cập nhật panel (kỳ ngộ).
export async function runFeatures($: any, sub: string, rest: string[], tail: string): Promise<{ text: string; card?: string; player?: Player; events?: string[] } | null> {
  const arg = (i: number) => (rest[i] ?? '').trim()
  const status = () => callServer<{ player: Player; status: any; social: any }>($, '/status')
  switch (sub) {
    case 'ky-ngo': case 'kyngo': {
      if (arg(0)) {
        const r = await callServer<{ text: string; events: string[]; player: Player }>($, '/ky-ngo', { choice: arg(0).toLowerCase() })
        return { text: say(r), player: r.data?.player, events: (r.data?.events ?? []).filter(e => e !== 'ky-ngo-done') }
      }
      const r = await status()
      return { text: r.ok ? kyNgoLines(r.data?.status?.kyNgo).join('\n') : fail(r) }
    }
    case 'linh-can': case 'linhcan': {
      const counts = ((await $.store.get('tutien.linhCanCounts')) as Partial<Record<Element, number>> | undefined) ?? {}
      const cur = ((await $.store.get('tutien.linhCan')) as Element | undefined) ?? dominant(counts)
      return { text: linhCanLines(counts, cur ?? null).join('\n') }
    }
    case 'luan-dao': case 'luandao': {
      if (!tail) {
        const r = await status()
        const l = r.data?.status?.luanDao
        return { text: ['⚔️ Luận Đạo: /tutien luan-dao <tên đạo hữu>', '   Thắng +5 linh thạch, thua không mất gì (chỉ mất chút sĩ diện). Mỗi ngày 3 trận.', l ? `   📊 Hôm nay ${l.n}/3 trận · tổng thắng ${l.wins} · thua ${l.losses}` : ''].filter(Boolean).join('\n') }
      }
      return { text: say(await callServer($, '/luan-dao', { target: tail })) }
    }
    case 'chuoi': case 'streak': {
      const r = await status()
      return { text: r.ok ? streakLines(r.data?.status?.streak ?? 0).join('\n') : fail(r) }
    }
    case 'cong-phap': case 'congphap': {
      if (arg(0) === 'hoc') return { text: arg(1) ? say(await callServer($, '/cong-phap', { action: 'hoc', id: arg(1) })) : 'Dùng: /tutien cong-phap hoc <id>' }
      if (arg(0) === 'tay-tuy') return { text: say(await callServer($, '/cong-phap', { action: 'tay-tuy' })) }
      const r = await status()
      return { text: r.ok && r.data?.status?.congPhap ? congPhapLines(r.data.status.congPhap).join('\n') : fail(r) }
    }
    case 'tong-chien': case 'tongchien': {
      const res = await $.http.fetch(`${SERVER}/team`, { method: 'GET' }).catch(() => null)
      return { text: res?.ok ? warLines(JSON.parse(res.text)).join('\n') : '☁️ Server không phản hồi.' }
    }
    case 'bai-su': return { text: tail ? say(await callServer($, '/social', { op: 'bai-su', to: tail })) : 'Dùng: /tutien bai-su <tên sư phụ> (sư phụ từ bậc 7, cao hơn đạo hữu 3 bậc)' }
    case 'nhan-do': return { text: tail ? say(await callServer($, '/social', { op: 'nhan-do', from: tail })) : 'Dùng: /tutien nhan-do <tên đồ đệ>' }
    case 'su-do': {
      if (arg(0) === 'huy') return { text: say(await callServer($, '/social', { op: 'su-do-huy' })) }
      const r = await status()
      if (!r.ok) return { text: fail(r) }
      const soc = r.data?.social ?? {}
      const asks = (soc.invites ?? []).filter((i: any) => i.kind === 'su-do')
      return { text: [
        '🧑‍🏫 Sư Đồ',
        `   Sư phụ: ${soc.master ?? 'chưa có (đồ đệ được +0,5% EXP nhờ chỉ điểm)'}`,
        `   Đồ đệ: ${(soc.disciples ?? []).length ? soc.disciples.join(', ') : 'chưa có (mỗi lần đồ đệ đột phá, sư phụ +5 linh thạch)'}`,
        ...asks.map((i: any) => `   🙇 ${i.from} xin bái sư → /tutien nhan-do ${i.from}`),
        '', '💡 /tutien bai-su <tên> · /tutien nhan-do <tên> · /tutien su-do huy',
      ].join('\n') }
    }
    case 'the': case 'card': {
      const r = await status()
      if (!r.ok || !r.data) return { text: fail(r) }
      const name = ((await $.store.get('tutien.name')) as string) ?? ''
      const p = r.data.player
      const own = await $.store.get('tutien.avatar')
      const file = `${$.plugin.root}/assets/realms/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.png`
      const png = typeof own === 'string' ? own : ((await $.fs.read(file, { as: 'bytes' }).catch(() => null)) as any)?.base64 ?? null
      const svg = cardSvg({
        name, p, png, linhCan: r.data.status?.linhCan?.id ?? null, streak: r.data.status?.streak ?? 0,
        badges: (r.data.status?.badges ?? []).length, linhThach: r.data.status?.linhThach ?? 0, tong: r.data.social?.tong?.name ?? null, title: r.data.social?.title ?? null,
      })
      const dir = await $.session.cwd().catch(() => $.plugin.root)
      const out = `${dir}/tutien-the-${name}.svg`
      const saved = await $.fs.write(out, svg).then(() => true, () => false)
      return { text: saved ? `🪪 Thẻ tu tiên đã in xong: ${out}\n   Mở bằng trình duyệt hoặc kéo vào Slack để khoe với đồng môn!` : '🪪 Thẻ tu tiên (chưa lưu được file, xem trong panel).', card: svg }
    }
    case 'truyen-tuan': {
      const week = weekId(Date.now())
      const cached = (await $.store.get('tutien.weekStory')) as { week: string; text: string } | undefined
      if (cached?.week === week && arg(0) !== 'moi') return { text: `${cached.text}\n\n✍️ (Viết lại: /tutien truyen-tuan moi)` }
      const [r, h] = await Promise.all([status(), callServer<{ days: { day: string; pct: number }[] }>($, '/history')])
      if (!r.ok || !r.data) return { text: fail(r) }
      const name = ((await $.store.get('tutien.name')) as string) ?? ''
      const persona = ((await $.store.get('tutien.persona')) as string | undefined) ?? null
      const out = await $.model.complete({ model: 'haiku', prompt: storyPrompt(name, r.data.player, r.data.status, (h.data?.days ?? []).slice(-7), persona === 'none' ? null : persona) }).catch(() => null)
      const text = out && out.isAnswered ? String(out.text).trim() : ''
      if (!text) return { text: '🖋️ Bút lông của Claude bị khô mực. Thử lại sau nhé.' }
      await $.store.set('tutien.weekStory', { week, text })
      return { text }
    }
    default: return null
  }
}

// Màu cho từng dòng chữ trong panel, theo icon đầu dòng.
const LINE_COLORS: [RegExp, string][] = [
  [/^\s*(🏆|🥇|👑|✨|🎉|✅)/u, '#ffd54f'],
  [/^\s*(⚔️|💥|🔥|⚡|👹|😈)/u, '#ff7b72'],
  [/^\s*(🎁|💎|💰|🛍️|🪪)/u, '#f2cc60'],
  [/^\s*(🌿|🍃|🌱|📈|🟢)/u, '#7ee787'],
  [/^\s*(💧|🌀|📊|🏯|🧑‍🏫|🙇)/u, '#79c0ff'],
  [/^\s*(📖|📜|🔮|🌈|☄️|⛲)/u, '#d2a8ff'],
  [/^\s*(🥀|💀|🌧️|⚠️|🧊)/u, '#8b949e'],
  [/^\s*(🎲|➡️|🅰️|🅱️)/u, '#56d4dd'],
]
export const lineColor = (line: string): string | undefined => LINE_COLORS.find(([re]) => re.test(line))?.[1]
