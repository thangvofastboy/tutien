import { atom, read, update } from 'claude-code'
import { callServer } from './api'
import { statusText, percentExp } from './display'
import { REALM_NAMES, type Player } from './rules'

const PANE = 'tu-tien'
const me = atom({ plugin: 'tutien', key: 'me' } as const, undefined as Player | undefined)

// Ảnh bậc: assets/realms/<lớp>/<giới>/NN-F.png (khung 1). Khung hào quang được chọn theo đồng hồ.
export const realmImage = (root: string, p: Player, frame = 1) =>
  `${root}/assets/realms/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}-${frame}.png`

// Các hàm dưới đây được register.ts gọi (engine chỉ nạp một module hooks mỗi plugin).
export async function refreshPane($: any): Promise<void> {
  const res = await callServer<{ player: Player }>($, '/me').catch(() => undefined)
  if (res?.ok && res.data) await update($, me, () => res.data!.player)
}

export const PANE_ID = PANE

export async function renderPane($: any, e: any) {
  const { Box, Text, Image } = $.ui.resolve(e)
  const p = await read($, me)
  if (!p) return <Text dimColor>Chưa ghi danh. Dùng /tutien register.</Text>

  const file = realmImage($.plugin.root, p, 1)
  const hasImage = await $.fs.stat(file).then(() => true, () => false)
  const alt = `${REALM_NAMES[p.realm - 1]} (${p.cls}, ${p.gender})`

  return (
    <Box flexDirection="column">
      {hasImage
        ? <Image key="realm" source={{ file, format: 'png' }} columns={24} rows={12} alt={alt} />
        : <Text>{alt}</Text>}
      <Text>{statusText(p, Date.now())}</Text>
      <Text dimColor>Tiến độ bậc: {percentExp(p)}%</Text>
    </Box>
  )
}
