// hooks/web.ts — mini web Tu Tiên (/tutien web): mod chạy web/server.js bằng node, ghi trạng thái ra web/state.json.
import { REALM_NAMES, type Player } from './rules'
import { percentExp, percentTrib, statusText, stateIcon, timeLeft, barColor } from './display'

export const WEB_PORT = 7340
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`

export type WebBoardRow = { rank: number; name: string; cls: string; realm: number; score: number }

export function webState(name: string, p: Player | undefined, now: number, board: WebBoardRow[] = []) {
  if (!p) return { registered: false, board }
  return {
    registered: true,
    name,
    cls: p.cls,
    gender: p.gender,
    realm: p.realm,
    realmName: REALM_NAMES[p.realm - 1],
    icon: stateIcon(p),
    status: statusText(p, now),
    percent: p.trib ? percentTrib(p, now) : percentExp(p),
    trib: p.trib ? { left: timeLeft(now, p.trib.deadline) } : null,
    danger: barColor(p, now) === 'danger',
    image: `assets/realms/${p.cls}/${p.gender}/${String(p.realm).padStart(2, '0')}.png`,
    board: board.map(r => ({ ...r, realmName: REALM_NAMES[r.realm - 1] ?? '', me: r.name.toLowerCase() === name.toLowerCase() })),
  }
}

// Tiến trình node sống theo module: tải lại mod hoặc hết phiên thì server dừng.
let proc: any = null

export const webRunning = () => proc !== null

export async function writeWebState($: any, p: Player | undefined, board: WebBoardRow[] = []): Promise<void> {
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? ''
  await $.fs.write(`${$.plugin.root}/web/state.json`, JSON.stringify(webState(name, p, Date.now(), board)))
}

// Chạy server và đợi dòng "listening"; trả về lỗi nếu node thiếu hoặc cổng bận.
export async function startWeb($: any, p: Player | undefined): Promise<{ ok: boolean; text: string }> {
  await writeWebState($, p)
  if (proc) return { ok: true, text: `Mini web đang chạy: ${WEB_URL}` }
  const child = $.process.spawn({ argv: ['node', `${$.plugin.root}/web/server.js`, String(WEB_PORT), $.plugin.root] })
  proc = child
  return new Promise(resolve => {
    let said = false
    let err = ''
    const say = (r: { ok: boolean; text: string }) => { if (!said) { said = true; resolve(r) } }
    void (async () => {
      try {
        for await (const piece of child) {
          if ('text' in piece) {
            if (piece.stream === 'stdout' && piece.text.includes('tutien-web listening')) say({ ok: true, text: `Mini web đã chạy: ${WEB_URL}` })
            if (piece.stream === 'stderr') err += piece.text
          }
        }
      } catch (e) {
        err ||= String(e)
      } finally {
        if (proc === child) proc = null
        say({ ok: false, text: `Không chạy được mini web (cần node trong PATH, cổng ${WEB_PORT} còn trống).\n${err.slice(0, 400)}` })
      }
    })()
  })
}

export async function stopWeb(): Promise<boolean> {
  if (!proc) return false
  const child = proc
  proc = null
  void child.return?.()
  return true
}
