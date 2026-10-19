import { atom, read, update } from 'claude-code'
import { callServer, SERVER } from './api'
import { statusText, percentExp, stateIcon, toneOf, timeLeft } from './display'
import { REALM_NAMES, type Player } from './rules'
import { tribEffect, overlayFrame, effectActive } from './effects'
import { paneLine } from './persona'
import { bandLines } from './band'
import { realmColor, gradientRuns, meter, rankColor, EVENT_BANNERS } from './look'
import { SETTINGS, COMMAND_GROUPS, OPEN_COMMANDS, type Setting, PANEL_BG, THEMES, TEXT_SIZES, withDefaults } from './settings'
import { STEPS, STEP_STYLE, initWizard, advance, type Wizard } from './start'
import { PROLOGUE, CLASS_ORIGINS, STARTER_QUESTS } from './story'
import { CLASSES, GENDERS } from './rules'
import { PERSONAS, personaById } from './persona'
import { webRunning, writeWebState } from './web'
import { greetingLines, eventLines } from './chat'
import { lineColor } from './features'
import { fxSvg, kyNgoScene, KY_NGO_ASCII, type FxKind } from './art'
import { runTutien } from './register'

const PANE = 'tu-tien'
export const me = atom({ plugin: 'tutien', key: 'me' } as const, undefined as Player | undefined)
const effect = atom({ plugin: 'tutien', key: 'effect' } as const, null as { kind: string; until: number } | null)
const tick = atom({ plugin: 'tutien', key: 'tick' } as const, 0)
// Bảng Tu vi rút gọn cho pane và web mini; làm mới cùng lúc với nhân vật.
export type BoardRow = { rank: number; name: string; cls: string; realm: number; score: number }
const board = atom({ plugin: 'tutien', key: 'board' } as const, [] as BoardRow[])
// Nhiệm vụ ngày, bí cảnh, Tâm Ma, tông (spec 18.4): dòng phụ trong pane.
type Info = {
  quest: number; bicanh: string | null; tamma: number | null; tong: string | null
  streak?: number; linhCan?: { name: string; icon: string } | null; cpPoints?: number
  kyNgo?: { id: string; title: string; desc: string; a: string; b: string } | null
}
const info = atom({ plugin: 'tutien', key: 'info' } as const, null as Info | null)
// Kết quả nút lệnh nhanh: hiện ngay trong panel (không chỉ trong khung chat).
type Action = { label: string; arg: string }
type Out = { title: string; text: string; card?: string; actions?: Action[] }
const quickOut = atom({ plugin: 'tutien', key: 'quickOut' } as const, null as Out | null)
// Hiện kết quả trong thẻ của panel và pane Cài đặt; `card` là SVG (thẻ khoe nhân vật).
export async function showOut($: any, title: string, text: string, card?: string, actions?: Action[]): Promise<void> {
  await update($, quickOut, () => ({ title, text, card, actions }))
}
const settingsTick = atom({ plugin: 'tutien', key: 'settingsTick' } as const, 0)
const wizard = atom({ plugin: 'tutien', key: 'wizard' } as const, { step: 0 } as Wizard)
const wizardError = atom({ plugin: 'tutien', key: 'wizardError' } as const, null as string | null)
const typed = atom({ plugin: 'tutien', key: 'typed' } as const, 0)

async function setting($: any, key: string): Promise<string | undefined> {
  return (await $.store.get(key)) as string | undefined
}

// Theme và cỡ chữ đang chọn; giá trị lạ thì về mặc định.
async function look($: any) {
  const [theme, size] = await Promise.all([setting($, 'tutien.theme'), setting($, 'tutien.textsize')])
  return {
    th: THEMES[theme ?? ''] ?? THEMES['mac-dinh'],
    sz: TEXT_SIZES[size ?? ''] ?? TEXT_SIZES.vua,
  }
}

// Ảnh nhân vật đã đọc từ đĩa, theo đường dẫn file: pane vẽ lại mỗi 250 ms khi có hiệu ứng, không đọc lại file.
// ponytail: bộ nhớ đệm không giới hạn thời gian; tối đa 32 ảnh (9 ảnh của /tutien start + vài ảnh bậc), đầy thì xóa hết.
const artCache = new Map<string, string | null>()
async function cachedRead(file: string, load: () => Promise<string | null>): Promise<string | null> {
  if (artCache.has(file)) return artCache.get(file)!
  const v = await load()
  if (v === null) return null
  if (artCache.size >= 32) artCache.clear()
  artCache.set(file, v)
  return v
}

// Bật hiệu ứng thiên phạt rồi tự tắt sau đúng thời lượng (spec 14). Khung hình đổi mỗi 250 ms.
// Chỉ một bộ đếm khung hình chạy một lúc; hiệu ứng mới thay hiệu ứng cũ.
let fxTimer: { cancel: () => void } | null = null
export async function showEffect($: any, kind: string, ms: number): Promise<void> {
  if ((await setting($, 'tutien.effects')) === 'off') return
  const until = Date.now() + ms
  await update($, effect, () => ({ kind, until }))
  fxTimer?.cancel()
  const timer = $.clock.every(250, () => void update($, tick, (t: number) => t + 1))
  fxTimer = timer
  $.clock.after(ms, () => {
    if (fxTimer === timer) { timer.cancel(); fxTimer = null }
    // Chỉ tắt nếu vẫn là hiệu ứng của lần gọi này (hiệu ứng sau không bị tắt sớm).
    void update($, effect, (cur: { kind: string; until: number } | null) => (cur && cur.until === until ? null : cur))
  })
}

// Nhận sự kiện từ server (/usage) và bật hiệu ứng tương ứng.
export async function applyEvents($: any, events: string[]): Promise<void> {
  const chat = (await setting($, 'tutien.chatlines')) !== 'off'
  for (const ev of events) {
    const fx = tribEffect(ev)
    if (fx) await showEffect($, fx.kind, fx.ms)
    const lines = eventLines(ev, Date.now())
    if (chat && lines.length) $.ui.log(lines.join('\n'))
  }
}

// Lời chào khi mở phiên, vài dòng trong khung chat (giống dòng chào của Claude Code).
export async function logGreeting($: any): Promise<void> {
  if ((await setting($, 'tutien.chatlines')) === 'off') return
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  const p = await read($, me)
  if (!name || !p) return
  $.ui.log(greetingLines(name, p, new Date()).join('\n'))
}

// Ảnh bậc: assets/realms/<lớp>/<giới>/NN-F.png (khung 1). Khung hào quang được chọn theo đồng hồ.
// Ảnh nhân vật cho bề mặt không có Raster: PNG nhúng trong SVG, giữ nét pixel khi phóng to.
// smooth: phóng to có làm mịn (nội suy) thay vì giữ nét pixel; size: cạnh ảnh theo px.
// Pane vẽ lại mỗi 250 ms khi có hiệu ứng: giữ lại SVG vừa dựng (ảnh tự chọn có thể tới 1,4 MB base64).
let lastSprite: { b64: string; smooth: boolean; size: number; svg: string } | null = null
function spriteOf(b64: string, smooth: boolean, size: number): string {
  if (lastSprite && lastSprite.b64 === b64 && lastSprite.smooth === smooth && lastSprite.size === size) return lastSprite.svg
  lastSprite = { b64, smooth, size, svg: svgSprite(b64, smooth, size) }
  return lastSprite.svg
}
export const svgSprite = (b64: string, smooth = false, size = 192) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}"><image href="data:image/png;base64,${b64}" width="96" height="96" style="image-rendering:${smooth ? 'auto' : 'pixelated'}"/></svg>`
// Cỡ ảnh theo bội nguyên của 96 px nên giữ nét; 'to' lấp gần hết bề ngang panel.
export const ART_SIZES: Record<string, number> = { nho: 96, vua: 192, lon: 288, to: 384 }

// Ảnh nhân vật tự chọn (/tutien hinh): dùng chung mọi bậc, chỉ lưu trên máy này.
// Svg dùng base64 lưu trong store; Raster dùng ô màu do scripts/avatar.py dựng; chế độ Image đọc lại file gốc nếu còn.
export const AVATAR_MAX_B64 = 1_400_000
export const isPngBase64 = (b64: unknown): b64 is string => typeof b64 === 'string' && b64.startsWith('iVBORw0KGgo') && b64.length <= AVATAR_MAX_B64
async function avatarOf($: any): Promise<{ b64: string; file: string | null; cells: string | null } | null> {
  const [b64, file, cells] = await Promise.all([$.store.get('tutien.avatar'), $.store.get('tutien.avatarFile'), $.store.get('tutien.avatarCells')])
  return isPngBase64(b64) ? { b64, file: typeof file === 'string' ? file : null, cells: typeof cells === 'string' ? cells : null } : null
}
export async function setAvatar($: any, b64: string | null, file: string | null, cells: string | null = null): Promise<void> {
  await $.store.set('tutien.avatar', b64)
  await $.store.set('tutien.avatarFile', file)
  await $.store.set('tutien.avatarCells', cells)
  artCache.clear() // bỏ kết quả stat cũ của file ảnh
  await update($, settingsTick, (n: number) => n + 1)
  if (webRunning()) await writeWebState($, await read($, me), await read($, board))
}

export const realmImage = (root: string, p: Player) =>
  `${root}/assets/realms/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.png`

// Các hàm dưới đây được register.ts gọi (engine chỉ nạp một module hooks mỗi plugin).
// Cập nhật nhân vật trong pane từ phản hồi server (sau mỗi lượt, đăng ký, reset, đổi ngoại hình).
export async function setPlayer($: any, player: Player): Promise<void> {
  await update($, me, () => player)
  await $.store.set('tutien.player', player) // để session mới và /clear có ngay nhân vật, khỏi chờ server
  await $.store.set('tutien.realm', player.realm)
  await showStatus($, player)
  if (webRunning()) await writeWebState($, player, await read($, board))
}

// Dòng trạng thái dưới ô nhập (luôn hiện): tên, cảnh giới, tiến độ hoặc thời gian thiên phạt.
export async function showStatus($: any, player: Player | undefined): Promise<void> {
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  if (!player || !name || (await setting($, 'tutien.statusline')) !== 'on') return $.ui.status(undefined)
  const [top, bottom] = bandLines(name, player, Date.now())
  $.ui.status(`${stateIcon(player)} ${top} · ${bottom}`)
}

// Khung phía trên ô nhập (dải AbovePrompt), kiểu khung của terminal-polish: viền bo tròn màu theo trạng thái,
// tiêu đề tô dải màu tiên khí rồi các ô thông tin trên một hàng. Vẽ cả phần của plugin bên dưới (next) để không che mod khác.
export async function renderBand($: any, e: any, next: any) {
  await read($, settingsTick) // đổi cài đặt (tắt khung, đổi theme) thì vẽ lại ngay
  let below: any = null
  try { below = await next(e) } catch { /* không có gì bên dưới (môi trường test) */ }
  if ((await setting($, 'tutien.band')) === 'off') return below
  const { Box, Text } = $.ui.resolve(e)
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  const p = await read($, me)
  const inf = await read($, info)
  const fx = await read($, effect)
  const now = Date.now()
  const { th } = await look($)
  const tone = toneOf(p, now)
  const seg = (key: string, text: string, color?: string, bold?: boolean) => <Text key={key} color={color} bold={bold}>{text}</Text>
  const dot = (key: string) => <Text key={key} dimColor>│</Text>
  const parts: any[] = []
  if (!p) {
    parts.push(seg('reg', 'Chưa ghi danh · /tutien start', tone))
  } else {
    const rc = realmColor(p.realm)
    parts.push(seg('who', `${stateIcon(p)} ${name || 'Tu tiên'} · ${p.cls}`, th.quote))
    parts.push(dot('d1'), seg('realm', `✦ ${REALM_NAMES[p.realm - 1]}`, rc, true))
    if (p.trib) {
      parts.push(dot('d2'), seg('trib', `⚡ Thiên phạt ${Math.floor((p.trib.earned / p.trib.required) * 100)}% · còn ${timeLeft(now, p.trib.deadline)}`, 'warning', true))
    } else {
      const pct = percentExp(p)
      const m = meter(pct)
      parts.push(dot('d2'), seg('bar', m.filled, rc), seg('rest', m.rest, 'subtle'), seg('pct', ` ${pct}%`, rc, true))
    }
    if (inf) parts.push(dot('d3'), seg('quest', `📅 ${inf.quest}%`, '#4fc3f7'))
    if (inf?.tamma !== null && inf?.tamma !== undefined) parts.push(dot('d4'), seg('tamma', `👹 ${inf.tamma}%`, '#ea80fc'))
  }
  const banner = effectActive(fx, now) ? EVENT_BANNERS[fx!.kind] : undefined
  return (
    <Box flexDirection="column" width={e.props.bodyColumns}>
      <Box flexDirection="column" borderStyle="round" borderColor={p ? realmColor(p.realm) : tone} paddingX={1}>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          <Box flexDirection="row">{gradientRuns('◆ Tu Tiên').map((r, i) => <Text key={`t${i}`} bold color={r.color}>{r.ch}</Text>)}</Box>
          {parts}
        </Box>
        {banner ? <Text bold color={banner.color}>{banner.text}</Text> : null}
      </Box>
      {below}
    </Box>
  )
}

// Các mục panel ẩn/hiện được bằng hàng nút cuối panel; mặc định đều bật.
const VIS: { key: string; label: string }[] = [
  { key: 'tutien.portrait', label: 'Ảnh' }, { key: 'tutien.tu', label: 'Tu Luyện' }, { key: 'tutien.quest', label: 'Nhiệm Vụ' },
  { key: 'tutien.board', label: 'Bảng Tu Vi' }, { key: 'tutien.kyngo', label: 'Kỳ Ngộ' }, { key: 'tutien.quick', label: 'Nút nhanh' },
]
// Bấm nút: đang bật thì tắt, đang tắt thì bật; lưu rồi vẽ lại panel.
async function toggleSetting($: any, key: string, on: boolean): Promise<void> {
  await $.store.set(key, on ? 'off' : 'on')
  await update($, settingsTick, (n: number) => n + 1)
}

// Atom `me` mất khi /clear hoặc mở session mới: nạp lại nhân vật đã lưu trước khi hỏi server.
export async function seedPlayer($: any): Promise<void> {
  const p = (await $.store.get('tutien.player')) as Player | undefined
  if (p && !(await read($, me))) await update($, me, () => p)
}

export async function refreshPane($: any): Promise<void> {
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  // Hai yêu cầu độc lập: gửi song song.
  const [res, top] = await Promise.all([
    callServer<{ player: Player; status?: any; social?: any }>($, '/me').catch(() => undefined),
    $.http.fetch(`${SERVER}/leaderboard?board=tu-vi&me=${encodeURIComponent(name)}`, { method: 'GET' }).catch(() => null),
  ])
  if (res?.ok && res.data?.status) {
    const s = res.data.status
    await update($, info, () => ({
      quest: s.quest?.pct ?? 0, bicanh: s.bicanh ?? null, tamma: s.tamma?.pct ?? null, tong: res.data!.social?.tong?.name ?? null,
      streak: s.streak ?? 0, linhCan: s.linhCan ? { name: s.linhCan.name, icon: s.linhCan.icon } : null, cpPoints: s.congPhap?.points ?? 0,
      kyNgo: s.kyNgo ? { id: s.kyNgo.id, title: s.kyNgo.title, desc: s.kyNgo.desc, a: s.kyNgo.a, b: s.kyNgo.b } : null,
    }))
  }
  if (top?.ok) {
    let rows: BoardRow[] = []
    try { rows = (JSON.parse(top.text) as { rows?: BoardRow[] }).rows ?? [] } catch { /* bảng lỗi: giữ trống */ }
    await update($, board, () => (Array.isArray(rows) ? rows.slice(0, 11) : []))
  }
  if (res?.ok && res.data) await setPlayer($, res.data.player)
}

// Các dòng bảng xếp hạng: 5 người đầu, thêm hàng của mình nếu ở ngoài.
export function boardLines(rows: BoardRow[], me: string): { text: string; mine: boolean; rank: number }[] {
  const mine = (r: BoardRow) => r.name.toLowerCase() === me.toLowerCase()
  const medal = (n: number) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : `${n}.`)
  const show = [...rows.filter(r => r.rank <= 5), ...rows.filter(r => r.rank > 5 && mine(r))]
  return show.map(r => ({ text: `${medal(r.rank)} ${r.name} · ${REALM_NAMES[r.realm - 1] ?? ''} · ${r.score}%`, mine: mine(r), rank: r.rank }))
}

export const PANE_ID = PANE

export const CELL_COLS = 48
export const CELL_ROWS = 24
export const realmCells = (root: string, p: Player) =>
  `${root}/assets/cells/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.b64`

// Chế độ hiển thị: image (terminal hỗ trợ đồ họa), raster (ô nửa khối, chạy mọi nơi), text.
export const displayMode = (v: unknown): 'image' | 'raster' | 'text' =>
  v === 'image' || v === 'text' ? v : 'raster'

// Nút lệnh nhanh: bấm là chạy đúng lệnh như gõ /tutien <lệnh>, kết quả hiện trong khung chat.
const QUICK = [
  { arg: 'status', label: '📈 Trạng thái' },
  { arg: 'top', label: '🏆 Bảng xếp hạng' },
  { arg: 'history', label: '📊 Lịch sử' },
  { arg: 'team', label: '👥 Team' },
  { arg: 'chuoi', label: '🔥 Chuỗi ngày' },
  { arg: 'cong-phap', label: '📖 Công pháp' },
  { arg: 'the', label: '🪪 Thẻ khoe' },
  { arg: 'setting', label: '⚙️ Cài đặt' },
]
function runQuick($: any, arg: string, label?: string) {
  void (async () => {
    const title = label ?? QUICK.find(q => q.arg === arg)?.label ?? arg
    const opens = OPEN_COMMANDS.includes(arg)
    if (!opens) await update($, quickOut, () => ({ title, text: '⏳ Đang tải…' }))
    // Gọi thẳng hàm xử lý /tutien, không đi vòng qua $.command.run.
    const r = await runTutien($, arg).catch(() => undefined)
    if (opens) return // mở pane khác
    const text = String(r?.text ?? '').trim() || 'Không có dữ liệu.'
    // Lệnh đã tự hiện thẻ (kèm ảnh) thì giữ nguyên.
    await update($, quickOut, (cur: any) => ((cur?.card || cur?.actions) && cur.text === text ? cur : { title, text }))
  })()
}

// Thẻ kết quả: mỗi dòng tô màu theo icon đầu dòng, có ảnh nếu là thẻ khoe.
function outCard(els: any, $: any, out: Out, size?: string) {
  const { Box, Text, Button, Svg } = els
  return (
    <Box key="out" flexDirection="column" borderStyle="round" borderColor="#79c0ff" paddingX={1}>
      <Text size={size} bold color="#79c0ff">{out.title}</Text>
      {out.card && Svg ? <Svg key="card" alt={out.title} width={360} height={192} source={out.card} /> : null}
      {out.text.split('\n').map((t, i) => <Text key={`o-${i}`} size={size} color={lineColor(t)}>{t || ' '}</Text>)}
      {Button ? (
        <Box key="out-btns" flexDirection="row" flexWrap="wrap" gap={1}>
          {(out.actions ?? []).map(a => <Button key={`act:${a.arg}`} onPress={() => runQuick($, a.arg, out.title)}>{a.label}</Button>)}
          <Button key="out-close" onPress={() => void update($, quickOut, () => null)}>✖ Đóng</Button>
        </Box>
      ) : null}
    </Box>
  )
}

// Hiệu ứng nào có khung SVG: các hiệu ứng mới, và thiên phạt cũ mượn khung gần giống.
const FX_SVG_OF: Record<string, FxKind | undefined> = {
  kyngo: 'kyngo', sparkle: 'sparkle', fire: 'fire', meteor: 'meteor', scroll: 'scroll', ult: 'ult', win: 'win', lose: 'lose', treasure: 'treasure', badge: 'badge',
  gold: 'ult', lightning: 'meteor', rain: 'lose',
}

export async function renderPane($: any, e: any) {
  const { Box, Text, Image, Raster, Svg, Button } = $.ui.resolve(e)
  const p = await read($, me)
  if (!p) {
    // Đã có khóa là đã ghi danh, chỉ là chưa tải xong từ server.
    return (await $.store.get('tutien.key'))
      ? <Text dimColor>⏳ Đang tải nhân vật…</Text>
      : <Text dimColor>🌱 Chưa ghi danh. Dùng /tutien start.</Text>
  }

  const alt = `${REALM_NAMES[p.realm - 1]} (${p.cls}, ${p.gender})`
  const fx = await read($, effect)
  const t = await read($, tick)
  // Terminal: một dòng chữ chạy theo nhịp. Desktop, web, điện thoại: thêm khung hoạt ảnh SVG (hạt bay, sao băng, lửa).
  const fxArt = fx && e.surface !== 'terminal' && Svg ? FX_SVG_OF[fx.kind] : undefined
  const overlay = effectActive(fx, Date.now()) && fx
    ? (
      <Box key="fx" flexDirection="column" alignItems="center">
        {fxArt ? <Svg key={`fx-${t % 12}`} alt={fx.kind} width={360} height={180} source={fxSvg(fxArt, t)} /> : null}
        <Text>{overlayFrame(fx.kind as any, t)}</Text>
      </Box>
    )
    : null
  const active = effectActive(fx, Date.now()) ? fx!.kind : null
  await read($, settingsTick) // đổi cài đặt thì vẽ lại ngay
  // Đọc mọi cài đặt một lượt, song song.
  const [persona, personaLines, display, panelbg, compactSetting, { th, sz }] = await Promise.all([
    $.store.get('tutien.persona'), $.store.get('tutien.personaLines'), $.store.get('tutien.display'),
    setting($, 'tutien.panelbg'), setting($, 'tutien.compact'), look($),
  ])
  const line = paneLine(
    { realm: p.realm, tribActive: !!p.trib, died: active === 'red', tribFailed: active === 'rain', breakthrough: active === 'gold' },
    (persona as string | null) ?? null,
    (personaLines as string[] | null) ?? null,
    Math.floor(Date.now() / 60_000),
  )
  const mode = displayMode(display)
  const custom = await avatarOf($)
  const [artSize, smooth] = await Promise.all([setting($, 'tutien.artsize'), setting($, 'tutien.artsmooth')])
  const artPx = ART_SIZES[artSize ?? ''] ?? ART_SIZES.vua
  // Terminal chỉ có cỡ thường và 'nho' (một nửa mỗi chiều); các cỡ lớn hơn chỉ dành cho Svg.
  const half = artSize === 'nho'
  const raster = (cells: string) => half
    ? <Raster key="realm" columns={CELL_COLS / 2} rows={CELL_ROWS / 2} cells={shrinkCells(cells, CELL_COLS, CELL_ROWS)} />
    : <Raster key="realm" columns={CELL_COLS} rows={CELL_ROWS} cells={cells} />
  let art: any = <Text>{alt}</Text>
  if (mode !== 'text' && e.surface !== 'terminal' && Svg) {
    // Claude Code Desktop và app điện thoại không vẽ Raster/Image (chỉ là fragment rỗng): vẽ ảnh PNG qua Svg.
    const file = realmImage($.plugin.root, p)
    const b64 = custom?.b64 ?? await cachedRead(`png:${file}`, () => $.fs.read(file, { as: 'bytes' }).then((x: any) => x?.base64 ?? null, () => null))
    if (b64) art = <Svg key="realm" alt={alt} width={artPx} height={artPx} source={spriteOf(b64, smooth === 'on', artPx)} />
  } else if (mode === 'raster' && custom?.cells && Raster) {
    art = raster(custom.cells)
  } else if ((mode === 'image' || (mode === 'raster' && custom && !custom.cells)) && Image) {
    // Ảnh tự chọn cũ (đặt trước khi có ô màu) chỉ vẽ được bằng Image; đặt lại bằng /tutien hinh để có ô màu.
    const file0 = custom?.file
    const own = file0 && (await cachedRead(`stat:${file0}`, () => $.fs.stat(file0).then(() => 'ok', () => null))) ? file0 : null
    const file = own ?? realmImage($.plugin.root, p)
    if (own || await cachedRead(`stat:${file}`, () => $.fs.stat(file).then(() => 'ok', () => null))) {
      art = <Image key="realm" source={{ file, format: 'png' }} columns={half ? 12 : 24} rows={half ? 6 : 12} alt={alt} />
    }
  } else if (mode === 'raster' && Raster) {
    const file = realmCells($.plugin.root, p)
    const cells = await cachedRead(`cells:${file}`, () => $.fs.read(file).then((x: any) => (x ? String(x).trim() : null), () => null))
    if (cells) art = raster(cells)
  }

  const bg = PANEL_BG[panelbg ?? 'terminal']
  const compact = compactSetting === 'on'
  const vis = Object.fromEntries(await Promise.all(VIS.map(async v => [v.key, (await setting($, v.key)) !== 'off'] as const)))
  const inf = await read($, info)
  const out = await read($, quickOut)
  const lines = boardLines(await read($, board), ((await $.store.get('tutien.name')) as string | undefined) ?? '')
  const now = Date.now()
  const rc = realmColor(p.realm)
  const pct = percentExp(p)
  const m = meter(pct, 16)
  const banner = active ? EVENT_BANNERS[active] : undefined
  // Thẻ: khung bo tròn có tiêu đề, màu viền theo theme.
  const card = (key: string, title: string, color: string, body: any[]) => (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      <Text size={sz.title} bold color={color}>{title}</Text>
      {body}
    </Box>
  )
  const quest: any[] = []
  if (inf) quest.push(<Text key="q" size={sz.body} color="#4fc3f7">📅 Nhiệm vụ ngày: {inf.quest}%{inf.tong ? ` · 🏯 ${inf.tong}` : ''}</Text>)
  if (inf?.bicanh) quest.push(<Text key="bc" size={sz.body} color="#80cbc4">🌀 {inf.bicanh}</Text>)
  if (inf?.tamma !== null && inf?.tamma !== undefined) quest.push(<Text key="tm" size={sz.body} color="#ea80fc">👹 Xua đuổi Tâm Ma: {inf.tamma}%</Text>)
  return (
    <Box flexDirection="column" backgroundColor={bg} gap={1}>
      {overlay}
      {banner ? <Text size={sz.title} bold color={banner.color}>{banner.text}</Text> : null}
      {vis['tutien.portrait'] ? (
        <Box flexDirection="column" alignItems="center" borderStyle="round" borderColor={rc} paddingX={1}>
          <Text size={sz.title} bold color={rc}>✦ {REALM_NAMES[p.realm - 1]} ✦</Text>
          {art}
          <Text size={sz.body} color={th.quote}>{p.cls} · {p.gender}</Text>
        </Box>
      ) : null}
      {vis['tutien.tu'] ? card('tu', '☯ Tu Luyện', th.title, [
        <Text key="st" size={sz.body} color={toneOf(p, now)}>{stateIcon(p)} {statusText(p, now)}</Text>,
        <Text key="ln" size={sz.body} italic color={th.quote}>💬 {line}</Text>,
        ...(inf && (inf.streak || inf.linhCan || inf.cpPoints) ? [
          <Box key="ft" flexDirection="row" flexWrap="wrap" gap={1}>
            {inf.streak ? <Text size={sz.body} color="#ffa657">{inf.streak >= 7 ? '🔥🔥' : '🔥'} {inf.streak} ngày</Text> : null}
            {inf.linhCan ? <Text size={sz.body} color="#d2a8ff">{inf.linhCan.icon} {inf.linhCan.name}</Text> : null}
            {inf.cpPoints ? <Text size={sz.body} color="#ffd54f">📖 {inf.cpPoints} điểm công pháp</Text> : null}
          </Box>,
        ] : []),
        <Box key="mt" flexDirection="row">
          <Text size={sz.body} dimColor>📈 Tiến độ bậc: </Text>
          <Text size={sz.body} color={rc}>{m.filled}</Text>
          <Text size={sz.body} color="subtle">{m.rest}</Text>
          <Text size={sz.body} bold color={rc}> {pct}%</Text>
        </Box>,
      ]) : null}
      {!compact && vis['tutien.quest'] && quest.length ? card('nv', '📜 Nhiệm Vụ', '#4fc3f7', quest) : null}
      {!compact && vis['tutien.board'] && lines.length ? card('bxh', '🏆 Bảng Tu Vi', '#ffd54f', lines.map(l => (
        <Text key={`b-${l.text}`} size={sz.body} color={l.mine ? th.mine : rankColor(l.rank)} bold={l.mine || l.rank <= 3}>{l.text}</Text>
      ))) : null}
      {inf?.kyNgo && vis['tutien.kyngo'] ? card('kn','🎲 Kỳ Ngộ', '#56d4dd', [
        <Text key="kt" size={sz.body} bold color="#56d4dd">{inf.kyNgo.title}</Text>,
        e.surface !== 'terminal' && Svg
          ? <Svg key="ks" alt={inf.kyNgo.title} width={360} height={180} source={kyNgoScene(inf.kyNgo.id)} />
          : <Box key="ka" flexDirection="column">{(KY_NGO_ASCII[inf.kyNgo.id] ?? []).map((l, i) => <Text key={`ka-${i}`} color="#56d4dd">{l}</Text>)}</Box>,
        <Text key="kd" size={sz.body} italic>{inf.kyNgo.desc}</Text>,
        Button ? (
          <Box key="kb" flexDirection="row" flexWrap="wrap" gap={1}>
            <Button key="kyngo:a" onPress={() => runQuick($, 'ky-ngo a', inf.kyNgo!.title)}>🅰️ {inf.kyNgo.a}</Button>
            <Button key="kyngo:b" onPress={() => runQuick($, 'ky-ngo b', inf.kyNgo!.title)}>🅱️ {inf.kyNgo.b}</Button>
          </Box>
        ) : <Text key="kh" size={sz.body} dimColor>/tutien ky-ngo a · /tutien ky-ngo b</Text>,
      ]) : null}
      {out ? outCard($.ui.resolve(e), $, out, sz.body) : null}
      {Button && vis['tutien.quick'] ? (
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {QUICK.map(q => <Button key={`quick:${q.arg}`} onPress={() => runQuick($, q.arg)}>{q.label}</Button>)}
        </Box>
      ) : null}
      {Button ? (
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {VIS.map(v => <Button key={`vis:${v.key}`} onPress={() => void toggleSetting($, v.key, vis[v.key])}>{vis[v.key] ? '✓' : '✗'} {v.label}</Button>)}
          <Button key="vis:compact" onPress={() => void toggleSetting($, 'tutien.compact', compact)}>{compact ? '✓' : '✗'} Gọn</Button>
        </Box>
      ) : null}
    </Box>
  )
}

// Ô chọn: Select khi bề mặt có; app điện thoại chưa có Select nên dùng một hàng nút, nút đang chọn có dấu ✓.
type Opt = { value: string; label: string }
// App điện thoại chưa vẽ Select và Input (bảng phần tử của nó không có hai thành phần này).
function resolveUi($: any, e: any) {
  const els = $.ui.resolve(e)
  return e.surface === 'mobile' ? { ...els, Select: undefined, Input: undefined } : els
}
export function choice(els: any, c: { key: string; label: string; options: Opt[]; value?: string; onSelect: (v: string) => void }) {
  const { Box, Text, Button, Select } = els
  if (Select) return <Select key={c.key} label={c.label} options={c.options} value={c.value} onSelect={c.onSelect} />
  return (
    <Box key={c.key} flexDirection="column">
      <Text bold>{c.label}</Text>
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        {c.options.map(o => (
          <Button key={`${c.key}:${o.value}`} onPress={() => c.onSelect(o.value)}>{o.value === c.value ? `✓ ${o.label}` : o.label}</Button>
        ))}
      </Box>
    </Box>
  )
}

// Mục cài đặt: tiêu đề có icon và màu, mỗi lựa chọn là một nút bấm bằng chuột; nút đang chọn có dấu ✓.
function settingChoice(els: any, s: Setting, c: { value?: string; onSelect: (v: string) => void }) {
  const { Box, Text, Button } = els
  const cur = s.options.find(o => o.value === c.value)
  return (
    <Box key={s.key} flexDirection="column" borderStyle="round" borderColor={s.color} paddingX={1}>
      <Text bold color={s.color}>{s.icon} {s.label}</Text>
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        {s.options.map(o => (
          <Button key={`${s.key}:${o.value}`} onPress={() => c.onSelect(o.value)}>{o.value === c.value ? '✓ ' : ''}{o.icon ? `${o.icon} ` : ''}{o.label}</Button>
        ))}
      </Box>
      {cur ? <Text dimColor color={s.color}>Đang chọn: {cur.icon ?? ''} {cur.label}</Text> : null}
    </Box>
  )
}

// Pane Cài đặt (/tutien setting): mỗi mục một thẻ nút bấm; chọn là lưu ngay vào $.store.
export const SETTINGS_ID = 'tu-tien-settings'

export async function renderSettings($: any, e: any) {
  const els = resolveUi($, e)
  const { Box, Text } = els
  await read($, settingsTick) // đăng ký vẽ lại khi có thay đổi
  const stored: Record<string, unknown> = {}
  const got = await Promise.all(SETTINGS.map(s => $.store.get(s.key)))
  SETTINGS.forEach((s, i) => { stored[s.key] = got[i] })
  const values = withDefaults(stored)
  const { th, sz } = await look($)
  const out = await read($, quickOut)
  const { Button } = els
  return (
    <Box flexDirection="column">
      <Text size={sz.title} bold color={th.title}>⚙️ Cài đặt Tu Tiên</Text>
      {Button ? COMMAND_GROUPS.map(g => (
        <Box key={`cmd:${g.title}`} flexDirection="column" borderStyle="round" borderColor={g.color} paddingX={1}>
          <Text bold color={g.color}>{g.title}</Text>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {g.items.map(i => <Button key={`cmd:${i.arg}`} onPress={() => runQuick($, i.arg, i.label)}>{i.label}</Button>)}
          </Box>
        </Box>
      )) : null}
      {out ? outCard(els, $, out) : null}
      {SETTINGS.map(s => settingChoice(els, s, {
          value: values[s.key],
          onSelect: (v: string) => {
            void (async () => {
              if (s.key === 'tutien.persona') {
                // Tùy chỉnh cần bộ thoại do /tutien persona tuy-chinh tạo; chưa có thì chỉ hướng dẫn.
                if (v === 'tuy-chinh' && !((await $.store.get('tutien.personaLines')) as string[] | null)?.length) {
                  $.ui.toast('Gõ /tutien persona tuy-chinh <mô tả> để tạo tính cách tùy chỉnh.')
                  return
                }
                if (v !== 'tuy-chinh') await $.store.set('tutien.personaLines', null)
                // Server lưu chuỗi; chuỗi rỗng là không có tính cách. Tùy chỉnh chỉ lưu trên máy này.
                if (v !== 'tuy-chinh') await callServer($, '/profile', { persona: personaById(v)?.name ?? '' }).catch(() => null)
              }
              await $.store.set(s.key, v)
              await update($, settingsTick, (n: number) => n + 1)
              if (s.key === 'tutien.statusline' || s.key === 'tutien.band') {
                const p = await read($, me)
                await showStatus($, p)
              }
            })()
          },
        }))}
      <Text size={sz.body} dimColor>💾 Thay đổi được lưu ngay trên máy này.</Text>
    </Box>
  )
}

// Ghi danh lên server (dùng chung cho /tutien register và bước xác nhận của /tutien start).
export async function registerPlayer($: any, r: { name: string; cls: string; gender: string }): Promise<{ ok: boolean; text: string }> {
  const res = await $.http.fetch(`${SERVER}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tutien-version': String((await $.store.get('tutien.version')) ?? ''), 'x-tutien-account': String((await $.store.get('tutien.account')) ?? '') },
    body: JSON.stringify(r),
  }).catch(() => null)
  if (!res) return { ok: false, text: 'Không kết nối được server.' }
  if (res.status === 409) return { ok: false, text: `Tên "${r.name}" đã có người dùng.` }
  if (res.status === 426) return { ok: false, text: 'Bản mod đã cũ. Chạy /tutien update trước.' }
  if (!res.ok) return { ok: false, text: `Đăng ký thất bại (${res.status}).` }
  await $.store.set('tutien.key', JSON.parse(res.text).key)
  await $.store.set('tutien.name', r.name)
  await refreshPane($)
  return { ok: true, text: `Đã ghi danh ${r.name}: ${r.cls}, ${r.gender}. Khóa đã lưu trên máy này.` }
}

// /tutien ten <đạo hiệu>: đặt tên ở bước "Đặt đạo hiệu" khi bề mặt không có ô nhập (app điện thoại).
export async function submitWizardName($: any, name: string): Promise<string> {
  const cur = await read($, wizard)
  if (STEPS[cur.step] !== 'name') return 'Chỉ dùng được ở bước "Đặt đạo hiệu" của /tutien start.'
  const out = advance(cur, name)
  await update($, wizard, () => out.w)
  await update($, wizardError, () => out.error ?? null)
  return out.error ? out.error : `Đã đặt đạo hiệu ${name}. Tiếp tục trong pane.`
}

// /tutien start: mở pane, đặt lại các bước và chạy chữ lời mở đầu.
export const START_ID = 'tu-tien-start'

export async function startWizard($: any): Promise<void> {
  await update($, wizard, () => initWizard())
  await update($, wizardError, () => null)
  await update($, typed, () => 0)
  await $.ui.open({ id: START_ID, title: 'Tu Tiên Ký' })
  const reduced = (await setting($, 'tutien.effects')) === 'off'
  if (reduced) {
    await update($, typed, () => PROLOGUE.length)
    return
  }
  const timer = $.clock.every(30, () => {
    void update($, typed, (n: number) => {
      if (n >= PROLOGUE.length) {
        timer.cancel()
        return n
      }
      return Math.min(PROLOGUE.length, n + 3)
    })
  })
}

// Thu nhỏ cells Raster đi một nửa mỗi chiều (lấy ô chẵn): ảnh thu nhỏ cho bước chọn lớp/giới trên terminal.
// Mỗi ô là 12 byte (3 u32), chép nguyên byte nên không phụ thuộc thứ tự byte của máy.
export function shrinkCells(b64: string, cols: number, rows: number): string {
  const src = atob(b64)
  const w = cols >> 1, h = rows >> 1
  let out = ''
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y * 2) * cols + x * 2) * 12
      out += src.slice(i, i + 12)
    }
  }
  return btoa(out)
}

// Ảnh minh họa cho bước chọn lớp và giới: PNG khung 1 qua Svg (desktop, điện thoại), cells thu nhỏ qua Raster (terminal).
async function stepArt($: any, e: any, pairs: { key: string; label: string; cls: string; gender: string }[]) {
  const { Box, Text, Svg, Raster } = $.ui.resolve(e)
  const useSvg = e.surface !== 'terminal' && !!Svg
  const arts = await Promise.all(pairs.map(async p => {
    if (useSvg) {
      const file = `${$.plugin.root}/assets/realms/${p.cls}/${p.gender}/01.png`
      const b64 = await cachedRead(`png:${file}`, () => $.fs.read(file, { as: 'bytes' }).then((x: any) => x?.base64 ?? null, () => null))
      return b64 ? <Svg key={`art-${p.key}`} alt={p.label} width={96} height={96} source={svgSprite(b64)} /> : null
    }
    if (!Raster) return null
    const file = `${$.plugin.root}/assets/cells/${p.cls}/${p.gender}/01.b64`
    const cells = await cachedRead(`thumb:${file}`, () => $.fs.read(file).then(
      (x: any) => (x ? shrinkCells(String(x).trim(), CELL_COLS, CELL_ROWS) : null), () => null))
    return cells ? <Raster key={`art-${p.key}`} columns={CELL_COLS / 2} rows={CELL_ROWS / 2} cells={cells} /> : null
  }))
  return (
    <Box flexDirection="row" flexWrap="wrap" gap={2}>
      {pairs.map((p, i) => <Box key={p.key} flexDirection="column">{arts[i]}<Text dimColor>{p.label}</Text></Box>)}
    </Box>
  )
}

export async function renderStart($: any, e: any) {
  const els = resolveUi($, e)
  const { Box, Text, Button, Input } = els
  const w = await read($, wizard)
  const err = await read($, wizardError)
  const step = STEPS[w.step]
  const style = STEP_STYLE[step]

  function go(value: string | null) {
    void (async () => {
      const cur = await read($, wizard)
      const out = advance(cur, value)
      await update($, wizard, () => out.w)
      await update($, wizardError, () => out.error ?? null)
    })()
  }
  function back() {
    void update($, wizard, (x: Wizard) => ({ ...x, step: Math.max(0, x.step - 1) }))
  }

  const header = <Text bold color={style.color}>{style.icon} Bước {w.step + 1}/{STEPS.length}</Text>
  const error = err ? <Text color="error">⚠️ {err}</Text> : null
  const backBtn = w.step > 0 ? <Button key="back" onPress={back}>Quay lại</Button> : null

  if (step === 'story') {
    const n = await read($, typed)
    const done = n >= PROLOGUE.length
    return (
      <Box flexDirection="column">
        {header}
        <Text color="remember">{PROLOGUE.slice(0, n)}</Text>
        <Box flexDirection="row">
          {!done ? <Button key="skip" onPress={() => void update($, typed, () => PROLOGUE.length)}>Hiện hết</Button> : null}
          <Button key="next" onPress={() => go(null)}>Tiếp</Button>
        </Box>
      </Box>
    )
  }
  if (step === 'class') {
    return (
      <Box flexDirection="column">
        {header}
        <Text bold color={style.color}>Chọn lớp nhân vật</Text>
        {await stepArt($, e, CLASSES.map(c => ({ key: c, label: c, cls: c, gender: 'Nam' })))}
        {CLASSES.map(c => <Text key={`o-${c}`} dimColor>{c}: {CLASS_ORIGINS[c]}</Text>)}
        {choice(els, { key: 'cls', label: 'Lớp', options: CLASSES.map(c => ({ value: c, label: c })), value: w.cls, onSelect: go })}
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'gender') {
    return (
      <Box flexDirection="column">
        {header}
        <Text bold color={style.color}>Chọn giới</Text>
        {w.cls ? await stepArt($, e, GENDERS.map(g => ({ key: g, label: g, cls: w.cls!, gender: g }))) : null}
        {choice(els, { key: 'gender', label: 'Giới', options: GENDERS.map(g => ({ value: g, label: g })), value: w.gender, onSelect: go })}
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'name') {
    return (
      <Box flexDirection="column">
        {header}
        <Text bold color={style.color}>Đặt đạo hiệu</Text>
        {Input
          ? <Input key="name" label="Tên" placeholder="ví dụ ThangVo" value={w.name} onSubmit={(v: string) => go(v)} />
          : <Text>Gõ <Text bold>/tutien ten &lt;đạo hiệu&gt;</Text> vào ô chat để đặt tên (app điện thoại chưa có ô nhập trong pane).</Text>}
        <Text dimColor>1–24 ký tự: chữ, số, gạch dưới hoặc gạch ngang.{Input ? ' Nhấn Enter để tiếp.' : ''}</Text>
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'persona') {
    const options = [{ value: 'none', label: 'Không' }, ...PERSONAS.map(p => ({ value: p.id, label: `${p.name}: ${p.catchphrase}` }))]
    return (
      <Box flexDirection="column">
        {header}
        <Text bold color={style.color}>Chọn tính cách (giọng nói của nhân vật)</Text>
        {choice(els, { key: 'persona', label: 'Tính cách', options, value: w.persona, onSelect: go })}
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'display') {
    const options = [
      { value: 'raster', label: 'Ô màu (chạy trên mọi terminal)' },
      { value: 'image', label: 'Ảnh (kitty, WezTerm, Ghostty)' },
      { value: 'text', label: 'Chỉ chữ' },
    ]
    return (
      <Box flexDirection="column">
        {header}
        <Text bold color={style.color}>Chọn cách hiển thị nhân vật</Text>
        {choice(els, { key: 'display', label: 'Hiển thị', options, value: w.display, onSelect: go })}
        {error}{backBtn}
      </Box>
    )
  }
  // confirm
  function confirm() {
    void (async () => {
      const cur = await read($, wizard)
      await $.store.set('tutien.persona', cur.persona ?? 'none')
      await $.store.set('tutien.display', cur.display ?? 'raster')
      const r = await registerPlayer($, { name: cur.name!, cls: cur.cls!, gender: cur.gender! })
      await update($, wizardError, () => (r.ok ? null : r.text))
      if (r.ok) await update($, wizard, (x: Wizard) => ({ ...x, step: STEPS.length - 1, done: true }))
    })()
  }
  const finished = w.done === true
  return (
    <Box flexDirection="column">
      {header}
      <Text bold color={finished ? 'success' : style.color}>{finished ? '✅ Đã ghi danh! Hành trình bắt đầu.' : 'Xác nhận nhân vật'}</Text>
      <Text>Đạo hiệu: <Text bold color="suggestion">{w.name}</Text> · Lớp: <Text color="success">{w.cls}</Text> · Giới: {w.gender}</Text>
      <Text dimColor>Tính cách: {w.persona === 'none' ? 'Không' : w.persona} · Hiển thị: {w.display}</Text>
      {finished
        ? STARTER_QUESTS.map(q => <Text key={q.title} color="warning">📌 {q.title}</Text>)
        : <Box flexDirection="row"><Button key="ok" onPress={confirm}>Ghi danh</Button>{backBtn}</Box>}
      {error}
    </Box>
  )
}
