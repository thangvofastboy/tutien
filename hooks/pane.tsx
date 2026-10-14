import { atom, read, update } from 'claude-code'
import { callServer } from './api'
import { statusText, percentExp } from './display'
import { REALM_NAMES, type Player } from './rules'
import { tribEffect, overlayFrame, effectActive } from './effects'
import { paneLine } from './persona'
import { bandLines } from './band'
import { SETTINGS, withDefaults } from './settings'

const PANE = 'tu-tien'
const me = atom({ plugin: 'tutien', key: 'me' } as const, undefined as Player | undefined)
const effect = atom({ plugin: 'tutien', key: 'effect' } as const, null as { kind: string; until: number } | null)
const tick = atom({ plugin: 'tutien', key: 'tick' } as const, 0)
const settingsTick = atom({ plugin: 'tutien', key: 'settingsTick' } as const, 0)

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
