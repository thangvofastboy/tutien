import { atom, read, update } from 'claude-code'
import { callServer, SERVER } from './api'
import { statusText, percentExp, stateIcon, toneOf } from './display'
import { REALM_NAMES, type Player } from './rules'
import { tribEffect, overlayFrame, effectActive } from './effects'
import { paneLine } from './persona'
import { bandLines, classIcon } from './band'
import { SETTINGS, PANEL_BG, THEMES, TEXT_SIZES, withDefaults } from './settings'
import { STEPS, initWizard, advance, type Wizard } from './start'
import { PROLOGUE, CLASS_ORIGINS, STARTER_QUESTS } from './story'
import { CLASSES, GENDERS } from './rules'
import { PERSONAS } from './persona'
import { webRunning, writeWebState } from './web'
import { greetingLines, eventLines } from './chat'

const PANE = 'tu-tien'
export const me = atom({ plugin: 'tutien', key: 'me' } as const, undefined as Player | undefined)
const effect = atom({ plugin: 'tutien', key: 'effect' } as const, null as { kind: string; until: number } | null)
const tick = atom({ plugin: 'tutien', key: 'tick' } as const, 0)
// Bảng Tu vi rút gọn cho pane và web mini; làm mới cùng lúc với nhân vật.
export type BoardRow = { rank: number; name: string; cls: string; realm: number; score: number }
const board = atom({ plugin: 'tutien', key: 'board' } as const, [] as BoardRow[])
// Nhiệm vụ ngày, bí cảnh, Tâm Ma, tông (spec 18.4): dòng phụ trong pane.
type Info = { quest: number; bicanh: string | null; tamma: number | null; tong: string | null }
const info = atom({ plugin: 'tutien', key: 'info' } as const, null as Info | null)
const settingsTick = atom({ plugin: 'tutien', key: 'settingsTick' } as const, 0)
const wizard = atom({ plugin: 'tutien', key: 'wizard' } as const, { step: 0 } as Wizard)
const wizardError = atom({ plugin: 'tutien', key: 'wizardError' } as const, null as string | null)
const typed = atom({ plugin: 'tutien', key: 'typed' } as const, 0)

async function setting($: any, key: string): Promise<string | undefined> {
  return (await $.store.get(key)) as string | undefined
}

// Theme và cỡ chữ đang chọn; giá trị lạ thì về mặc định.
async function look($: any) {
  return {
    th: THEMES[(await setting($, 'tutien.theme')) ?? ''] ?? THEMES['mac-dinh'],
    sz: TEXT_SIZES[(await setting($, 'tutien.textsize')) ?? ''] ?? TEXT_SIZES.vua,
  }
}

// Bật hiệu ứng thiên phạt rồi tự tắt sau đúng thời lượng (spec 14). Khung hình đổi mỗi 250 ms.
export async function showEffect($: any, kind: string, ms: number): Promise<void> {
  if ((await setting($, 'tutien.effects')) === 'off') return
  await update($, effect, () => ({ kind, until: Date.now() + ms }))
  const timer = $.clock.every(250, () => void update($, tick, (t: number) => t + 1))
  $.clock.after(ms, () => {
    timer.cancel()
    void update($, effect, () => null) // tắt hiệu ứng và vẽ lại pane
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
export const svgSprite = (b64: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="192" height="192"><image href="data:image/png;base64,${b64}" width="96" height="96" style="image-rendering:pixelated"/></svg>`

export const realmImage = (root: string, p: Player) =>
  `${root}/assets/realms/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.png`

// Các hàm dưới đây được register.ts gọi (engine chỉ nạp một module hooks mỗi plugin).
// Cập nhật nhân vật trong pane từ phản hồi server (sau mỗi lượt, đăng ký, reset, đổi ngoại hình).
export async function setPlayer($: any, player: Player): Promise<void> {
  await update($, me, () => player)
  await $.store.set('tutien.realm', player.realm)
  await showStatus($, player)
  if (webRunning()) await writeWebState($, player, await read($, board))
}

// Dòng trạng thái dưới ô nhập (luôn hiện): tên, cảnh giới, tiến độ hoặc thời gian thiên phạt.
export async function showStatus($: any, player: Player | undefined): Promise<void> {
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  if (!player || !name || (await setting($, 'tutien.statusline')) === 'off') return $.ui.status(undefined)
  const [top, bottom] = bandLines(name, player, Date.now())
  $.ui.status(`${stateIcon(player)} ${top} · ${bottom}`)
}

// Khung chữ nhỏ căn phải phía trên ô nhập (dải AbovePrompt).
export async function renderBand($: any, e: any, next: any) {
  if ((await setting($, 'tutien.band')) === 'off') return next(e)
  const { Box, Text } = $.ui.resolve(e)
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  const p = await read($, me)
  const [top, bottom] = bandLines(name || 'Tu tiên', p, Date.now())
  return (
    <Box flexDirection="row" justifyContent="flex-end">
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold color="suggestion">{classIcon(p?.cls ?? '')} {top}</Text>
        <Text color={toneOf(p, Date.now())}>{p ? stateIcon(p) : '✦'} {bottom}</Text>
      </Box>
    </Box>
  )
}

export async function refreshPane($: any): Promise<void> {
  const res = await callServer<{ player: Player; status?: any; social?: any }>($, '/me').catch(() => undefined)
  if (res?.ok && res.data?.status) {
    const s = res.data.status
    await update($, info, () => ({ quest: s.quest?.pct ?? 0, bicanh: s.bicanh ?? null, tamma: s.tamma?.pct ?? null, tong: res.data!.social?.tong?.name ?? null }))
  }
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  const top = await $.http.fetch(`${SERVER}/leaderboard?board=tu-vi&me=${encodeURIComponent(name)}`, { method: 'GET' }).catch(() => null)
  if (top?.ok) {
    let rows: BoardRow[] = []
    try { rows = (JSON.parse(top.text) as { rows?: BoardRow[] }).rows ?? [] } catch { /* bảng lỗi: giữ trống */ }
    await update($, board, () => (Array.isArray(rows) ? rows.slice(0, 11) : []))
  }
  if (res?.ok && res.data) await setPlayer($, res.data.player)
}

// Các dòng bảng xếp hạng: 5 người đầu, thêm hàng của mình nếu ở ngoài.
export function boardLines(rows: BoardRow[], me: string): { text: string; mine: boolean }[] {
  const mine = (r: BoardRow) => r.name.toLowerCase() === me.toLowerCase()
  const medal = (n: number) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : `${n}.`)
  const show = [...rows.filter(r => r.rank <= 5), ...rows.filter(r => r.rank > 5 && mine(r))]
  return show.map(r => ({ text: `${medal(r.rank)} ${r.name} · ${REALM_NAMES[r.realm - 1] ?? ''} · ${r.score}%`, mine: mine(r) }))
}

export const PANE_ID = PANE

export const CELL_COLS = 48
export const CELL_ROWS = 24
export const realmCells = (root: string, p: Player) =>
  `${root}/assets/cells/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.b64`

// Chế độ hiển thị: image (terminal hỗ trợ đồ họa), raster (ô nửa khối, chạy mọi nơi), text.
export const displayMode = (v: unknown): 'image' | 'raster' | 'text' =>
  v === 'image' || v === 'text' ? v : 'raster'

export async function renderPane($: any, e: any) {
  const { Box, Text, Image, Raster, Svg } = $.ui.resolve(e)
  const p = await read($, me)
  if (!p) return <Text dimColor>🌱 Chưa ghi danh. Dùng /tutien register.</Text>

  const alt = `${REALM_NAMES[p.realm - 1]} (${p.cls}, ${p.gender})`
  const fx = await read($, effect)
  const overlay = effectActive(fx, Date.now()) && fx
    ? <Text>{overlayFrame(fx.kind as any, await read($, tick))}</Text>
    : null
  const active = effectActive(fx, Date.now()) ? fx!.kind : null
  const line = paneLine(
    { realm: p.realm, tribActive: !!p.trib, died: active === 'red', tribFailed: active === 'rain', breakthrough: active === 'gold' },
    ((await $.store.get('tutien.persona')) as string | null) ?? null,
    ((await $.store.get('tutien.personaLines')) as string[] | null) ?? null,
    Math.floor(Date.now() / 60_000),
  )
  const mode = displayMode(await $.store.get('tutien.display'))
  let art: any = <Text>{alt}</Text>
  if (mode !== 'text' && e.surface !== 'terminal' && Svg) {
    // Claude Code Desktop và app điện thoại không vẽ Raster/Image (chỉ là fragment rỗng): vẽ ảnh PNG qua Svg.
    const png = await $.fs.read(realmImage($.plugin.root, p), { as: 'bytes' }).catch(() => null)
    if (png?.base64) art = <Svg key="realm" alt={alt} width={192} height={192} source={svgSprite(png.base64)} />
  } else if (mode === 'image' && Image) {
    const file = realmImage($.plugin.root, p)
    if (await $.fs.stat(file).then(() => true, () => false)) {
      art = <Image key="realm" source={{ file, format: 'png' }} columns={24} rows={12} alt={alt} />
    }
  } else if (mode === 'raster' && Raster) {
    const cells = await $.fs.read(realmCells($.plugin.root, p)).catch(() => null)
    if (cells) art = <Raster key="realm" columns={CELL_COLS} rows={CELL_ROWS} cells={String(cells).trim()} />
  }

  await read($, settingsTick) // đổi cài đặt thì vẽ lại ngay
  const bg = PANEL_BG[(await setting($, 'tutien.panelbg')) ?? 'terminal']
  const { th, sz } = await look($)
  const inf = await read($, info)
  const lines = boardLines(await read($, board), ((await $.store.get('tutien.name')) as string | undefined) ?? '')
  return (
    <Box flexDirection="column" backgroundColor={bg}>
      {overlay}
      {art}
      <Text size={sz.title} color={toneOf(p, Date.now())}>{stateIcon(p)} {statusText(p, Date.now())}</Text>
      <Text size={sz.body} italic color={th.quote}>💬 {line}</Text>
      <Text size={sz.body} dimColor>📈 Tiến độ bậc: {percentExp(p)}%</Text>
      {inf ? <Text size={sz.body} dimColor>📅 Nhiệm vụ ngày: {inf.quest}%{inf.tong ? ` · 🏯 ${inf.tong}` : ''}</Text> : null}
      {inf?.bicanh ? <Text size={sz.body} dimColor>🌀 {inf.bicanh}</Text> : null}
      {inf?.tamma !== null && inf?.tamma !== undefined ? <Text size={sz.body} color="error">👹 Xua đuổi Tâm Ma: {inf.tamma}%</Text> : null}
      {lines.length ? <Text size={sz.title} bold color={th.title}>🏆 Bảng Tu Vi</Text> : null}
      {lines.map(l => <Text key={`b-${l.text}`} size={sz.body} color={l.mine ? th.mine : undefined} bold={l.mine}>{l.text}</Text>)}
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

// Pane Cài đặt (/tutien setting): mỗi mục một Select; chọn là lưu ngay vào $.store.
export const SETTINGS_ID = 'tu-tien-settings'

export async function renderSettings($: any, e: any) {
  const els = resolveUi($, e)
  const { Box, Text } = els
  await read($, settingsTick) // đăng ký vẽ lại khi có thay đổi
  const stored: Record<string, unknown> = {}
  for (const s of SETTINGS) stored[s.key] = await $.store.get(s.key)
  const values = withDefaults(stored)
  const { th, sz } = await look($)
  return (
    <Box flexDirection="column">
      <Text size={sz.title} bold color={th.title}>⚙️ Cài đặt Tu Tiên</Text>
      {SETTINGS.map(s => choice(els, {
          key: s.key,
          label: s.label,
          options: s.options,
          value: values[s.key],
          onSelect: (v: string) => {
            void (async () => {
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

export async function renderStart($: any, e: any) {
  const els = resolveUi($, e)
  const { Box, Text, Button, Input } = els
  const w = await read($, wizard)
  const err = await read($, wizardError)
  const step = STEPS[w.step]

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

  const header = <Text dimColor>🧭 Bước {w.step + 1}/{STEPS.length}</Text>
  const error = err ? <Text color="error">⚠️ {err}</Text> : null
  const backBtn = w.step > 0 ? <Button key="back" onPress={back}>Quay lại</Button> : null

  if (step === 'story') {
    const n = await read($, typed)
    const done = n >= PROLOGUE.length
    return (
      <Box flexDirection="column">
        {header}
        <Text>{PROLOGUE.slice(0, n)}</Text>
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
        <Text bold color="suggestion">🎭 Chọn lớp nhân vật</Text>
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
        <Text bold color="suggestion">⚥ Chọn giới</Text>
        {choice(els, { key: 'gender', label: 'Giới', options: GENDERS.map(g => ({ value: g, label: g })), value: w.gender, onSelect: go })}
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'name') {
    return (
      <Box flexDirection="column">
        {header}
        <Text bold color="suggestion">✍️ Đặt đạo hiệu</Text>
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
        <Text bold color="suggestion">💬 Chọn tính cách (giọng nói của nhân vật)</Text>
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
        <Text bold color="suggestion">🖼️ Chọn cách hiển thị nhân vật</Text>
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
      <Text bold color={finished ? 'success' : 'suggestion'}>{finished ? '✅ Đã ghi danh! Hành trình bắt đầu.' : '📋 Xác nhận nhân vật'}</Text>
      <Text>Đạo hiệu: {w.name} · Lớp: {w.cls} · Giới: {w.gender}</Text>
      <Text dimColor>Tính cách: {w.persona === 'none' ? 'Không' : w.persona} · Hiển thị: {w.display}</Text>
      {finished
        ? STARTER_QUESTS.map(q => <Text key={q.title} color="warning">📌 {q.title}</Text>)
        : <Box flexDirection="row"><Button key="ok" onPress={confirm}>Ghi danh</Button>{backBtn}</Box>}
      {error}
    </Box>
  )
}
