import { atom, read, update } from 'claude-code'
import { callServer } from './api'
import { statusText, percentExp } from './display'
import { REALM_NAMES, type Player } from './rules'
import { tribEffect, overlayFrame, effectActive } from './effects'
import { paneLine } from './persona'
import { bandLines } from './band'
import { SETTINGS, withDefaults } from './settings'
import { STEPS, initWizard, advance, type Wizard } from './start'
import { PROLOGUE, CLASS_ORIGINS, STARTER_QUESTS } from './story'
import { CLASSES, GENDERS } from './rules'
import { PERSONAS } from './persona'
import { SERVER } from './api'

const PANE = 'tu-tien'
const me = atom({ plugin: 'tutien', key: 'me' } as const, undefined as Player | undefined)
const effect = atom({ plugin: 'tutien', key: 'effect' } as const, null as { kind: string; until: number } | null)
const tick = atom({ plugin: 'tutien', key: 'tick' } as const, 0)
const settingsTick = atom({ plugin: 'tutien', key: 'settingsTick' } as const, 0)
const wizard = atom({ plugin: 'tutien', key: 'wizard' } as const, { step: 0 } as Wizard)
const wizardError = atom({ plugin: 'tutien', key: 'wizardError' } as const, null as string | null)
const typed = atom({ plugin: 'tutien', key: 'typed' } as const, 0)

async function setting($: any, key: string): Promise<string | undefined> {
  return (await $.store.get(key)) as string | undefined
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
  for (const ev of events) {
    const fx = tribEffect(ev)
    if (fx) await showEffect($, fx.kind, fx.ms)
  }
}

// Ảnh bậc: assets/realms/<lớp>/<giới>/NN-F.png (khung 1). Khung hào quang được chọn theo đồng hồ.
export const realmImage = (root: string, p: Player) =>
  `${root}/assets/realms/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.png`

// Các hàm dưới đây được register.ts gọi (engine chỉ nạp một module hooks mỗi plugin).
// Cập nhật nhân vật trong pane từ phản hồi server (sau mỗi lượt, đăng ký, reset, đổi ngoại hình).
export async function setPlayer($: any, player: Player): Promise<void> {
  await update($, me, () => player)
  await $.store.set('tutien.realm', player.realm)
  await showStatus($, player)
}

// Dòng trạng thái dưới ô nhập (luôn hiện): tên, cảnh giới, tiến độ hoặc thời gian thiên phạt.
export async function showStatus($: any, player: Player | undefined): Promise<void> {
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  if (!player || !name || (await setting($, 'tutien.statusline')) === 'off') return $.ui.status(undefined)
  const [top, bottom] = bandLines(name, player, Date.now())
  $.ui.status(`${top} · ${bottom}`)
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
        <Text>{top}</Text>
        <Text dimColor>{bottom}</Text>
      </Box>
    </Box>
  )
}

export async function refreshPane($: any): Promise<void> {
  const res = await callServer<{ player: Player }>($, '/me').catch(() => undefined)
  if (res?.ok && res.data) await setPlayer($, res.data.player)
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
  const { Box, Text, Image, Raster } = $.ui.resolve(e)
  const p = await read($, me)
  if (!p) return <Text dimColor>Chưa ghi danh. Dùng /tutien register.</Text>

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
  if (mode === 'image') {
    const file = realmImage($.plugin.root, p)
    if (await $.fs.stat(file).then(() => true, () => false)) {
      art = <Image key="realm" source={{ file, format: 'png' }} columns={24} rows={12} alt={alt} />
    }
  } else if (mode === 'raster') {
    const cells = await $.fs.read(realmCells($.plugin.root, p)).catch(() => null)
    if (cells) art = <Raster key="realm" columns={CELL_COLS} rows={CELL_ROWS} cells={String(cells).trim()} />
  }

  return (
    <Box flexDirection="column">
      {overlay}
      {art}
      <Text>{statusText(p, Date.now())}</Text>
      <Text italic>{line}</Text>
      <Text dimColor>Tiến độ bậc: {percentExp(p)}%</Text>
    </Box>
  )
}

// Pane Cài đặt (/tutien setting): mỗi mục một Select; chọn là lưu ngay vào $.store.
export const SETTINGS_ID = 'tu-tien-settings'

export async function renderSettings($: any, e: any) {
  const { Box, Text, Select } = $.ui.resolve(e)
  await read($, settingsTick) // đăng ký vẽ lại khi có thay đổi
  const stored: Record<string, unknown> = {}
  for (const s of SETTINGS) stored[s.key] = await $.store.get(s.key)
  const values = withDefaults(stored)
  return (
    <Box flexDirection="column">
      <Text bold>Cài đặt Tu Tiên</Text>
      {SETTINGS.map(s => (
        <Select
          key={s.key}
          label={s.label}
          options={s.options}
          value={values[s.key]}
          onSelect={(v: string) => {
            void (async () => {
              await $.store.set(s.key, v)
              await update($, settingsTick, (n: number) => n + 1)
              if (s.key === 'tutien.statusline' || s.key === 'tutien.band') {
                const p = await read($, me)
                await showStatus($, p)
              }
            })()
          }}
        />
      ))}
      <Text dimColor>Thay đổi được lưu ngay trên máy này.</Text>
    </Box>
  )
}

// Ghi danh lên server (dùng chung cho /tutien register và bước xác nhận của /tutien start).
export async function registerPlayer($: any, r: { name: string; cls: string; gender: string }): Promise<{ ok: boolean; text: string }> {
  const res = await $.http.fetch(`${SERVER}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tutien-version': String((await $.store.get('tutien.version')) ?? '') },
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
  const { Box, Text, Button, Select, Input } = $.ui.resolve(e)
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

  const header = <Text dimColor>Bước {w.step + 1}/{STEPS.length}</Text>
  const error = err ? <Text color="red">{err}</Text> : null
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
        <Text bold>Chọn lớp nhân vật</Text>
        {CLASSES.map(c => <Text key={`o-${c}`} dimColor>{c}: {CLASS_ORIGINS[c]}</Text>)}
        <Select key="cls" label="Lớp" options={CLASSES.map(c => ({ value: c, label: c }))} value={w.cls} onSelect={(v: string) => go(v)} />
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'gender') {
    return (
      <Box flexDirection="column">
        {header}
        <Text bold>Chọn giới</Text>
        <Select key="gender" label="Giới" options={GENDERS.map(g => ({ value: g, label: g }))} value={w.gender} onSelect={(v: string) => go(v)} />
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'name') {
    return (
      <Box flexDirection="column">
        {header}
        <Text bold>Đặt đạo hiệu</Text>
        <Input key="name" label="Tên" placeholder="ví dụ ThangVo" value={w.name} onSubmit={(v: string) => go(v)} />
        <Text dimColor>1–24 ký tự: chữ, số, gạch dưới hoặc gạch ngang. Nhấn Enter để tiếp.</Text>
        {error}{backBtn}
      </Box>
    )
  }
  if (step === 'persona') {
    const options = [{ value: 'none', label: 'Không' }, ...PERSONAS.map(p => ({ value: p.id, label: `${p.name}: ${p.catchphrase}` }))]
    return (
      <Box flexDirection="column">
        {header}
        <Text bold>Chọn tính cách (giọng nói của nhân vật)</Text>
        <Select key="persona" label="Tính cách" options={options} value={w.persona} onSelect={(v: string) => go(v)} />
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
        <Text bold>Chọn cách hiển thị nhân vật</Text>
        <Select key="display" label="Hiển thị" options={options} value={w.display} onSelect={(v: string) => go(v)} />
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
      <Text bold>{finished ? 'Đã ghi danh! Hành trình bắt đầu.' : 'Xác nhận nhân vật'}</Text>
      <Text>Đạo hiệu: {w.name} · Lớp: {w.cls} · Giới: {w.gender}</Text>
      <Text dimColor>Tính cách: {w.persona === 'none' ? 'Không' : w.persona} · Hiển thị: {w.display}</Text>
      {finished
        ? STARTER_QUESTS.map(q => <Text key={q.title} dimColor>{q.title}</Text>)
        : <Box flexDirection="row"><Button key="ok" onPress={confirm}>Ghi danh</Button>{backBtn}</Box>}
      {error}
    </Box>
  )
}
