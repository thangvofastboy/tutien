// hooks/session.ts — việc lúc mở phiên và giữa các lượt: tài khoản Claude, hộp thư, lời nhắc, tóm tắt khi quay lại,
// đối chiếu transcript (spec 20.1, 21.4, 25), và persona cho Claude.
import { callServer, accountFromConfig } from './api'
import { personaById } from './persona'
import { REALM_NAMES } from './rules'
import { timeLeft } from './display'
import { vnDay } from './holidays'

const DAY = 86_400_000
const today0 = (now: number) => vnDay(now).slice(0, 7)
const COMMUNITY_LINES = [
  'Thiên đạo mở tiệc trà, mời cả tông môn uống một chén linh khí.',
  'Senior gật đầu: "Cả team cùng tu thì đan điền nào cũng vững."',
  'Tâm Ma Trễ Deadline xin nghỉ phép một tháng vì không chịu nổi sự chăm chỉ của các ngươi.',
]
const HOUR = 3_600_000

async function home($: any): Promise<string> {
  const r = await $.process.run(['printenv', 'HOME'], { timeoutMs: 10_000 }).catch(() => null)
  return r && r.exitCode === 0 ? r.stdout.trim() : ''
}

// Mã tài khoản Claude của máy này (oauthAccount.accountUuid). Nhân vật gắn với tài khoản lúc tạo.
export async function loadAccount($: any): Promise<void> {
  const h = await home($)
  if (!h) return
  const text = await $.fs.read(`${h}/.claude.json`).catch(() => '')
  const id = accountFromConfig(String(text))
  if (id) await $.store.set('tutien.account', id)
}

async function chat($: any): Promise<boolean> {
  return ((await $.store.get('tutien.chatlines')) as string | undefined) !== 'off'
}

// Hộp thư (chúc mừng, lời mời, thông báo tông), nhắc thiên phạt, tóm tắt khi vắng từ 3 ngày.
export async function sessionNotes($: any, now = Date.now()): Promise<void> {
  const r = await callServer<{ player: any; status: any; social: any }>($, '/status')
  if (!r.ok || !r.data) return
  const { player, status } = r.data
  const lines: string[] = []

  const lastSeen = (await $.store.get('tutien.lastSeen')) as number | undefined
  if (lastSeen && now - lastSeen >= 3 * DAY) {
    const team = await $.http.fetch(`https://tutien.thang-vo.workers.dev/team`, { method: 'GET' }).then((x: any) => (x.ok ? JSON.parse(x.text) : null)).catch(() => null)
    lines.push(`🏡 Chào mừng trở lại sau ${Math.floor((now - lastSeen) / DAY)} ngày. Đạo hữu đang ở ${REALM_NAMES[player.realm - 1]}.`)
    if (team?.recent?.length) lines.push(`   ✨ Vừa đột phá: ${team.recent.slice(0, 5).map((x: any) => x.name).join(', ')}`)
    if (status.bicanh) lines.push(`   🌀 ${status.bicanh}`)
    if (team?.holidays?.length) lines.push(`   🎊 Lễ hội sắp tới: ${team.holidays[0].name} (${team.holidays[0].days[0]})`)
  }
  await $.store.set('tutien.lastSeen', now)

  // Thử thách cộng đồng (spec 20.2): team đạt mục tiêu tháng trước thì tháng này có bộ thoại đặc biệt.
  const month = today0(now)
  if ((await $.store.get('tutien.communityShown')) !== month) {
    const t = await $.http.fetch(`https://tutien.thang-vo.workers.dev/team`, { method: 'GET' }).then((x: any) => (x.ok ? JSON.parse(x.text) : null)).catch(() => null)
    if (t?.community?.rewardActive) {
      lines.push(`🎆 Cả team đã đạt Thử Thách Cộng Đồng tháng trước! ${COMMUNITY_LINES[Math.floor(now / DAY) % COMMUNITY_LINES.length]}`)
      await $.store.set('tutien.communityShown', month)
    }
  }

  // Nhắc thiên phạt sắp hết hạn: còn dưới 12 giờ và chưa đủ, mỗi ngày một lần.
  const today = vnDay(now)
  if (player.trib && player.trib.deadline - now < 12 * HOUR && player.trib.earned < player.trib.required
    && (await $.store.get('tutien.tribReminded')) !== today) {
    lines.push(`⏰ Thiên phạt còn ${timeLeft(now, player.trib.deadline)} mà mới được ${Math.floor((player.trib.earned / player.trib.required) * 100)}%. Cố lên!`)
    await $.store.set('tutien.tribReminded', today)
  }

  const seenAt = ((await $.store.get('tutien.inboxSeen')) as number | undefined) ?? 0
  const fresh = (status.inbox ?? []).filter((m: { at: number }) => m.at > seenAt)
  for (const m of fresh) lines.push(`📬 ${m.text}`)
  if (fresh.length) await $.store.set('tutien.inboxSeen', fresh[fresh.length - 1].at)
  for (const i of r.data.social?.invites ?? []) lines.push(`💌 ${i.from} mời đạo hữu làm ${i.kind === 'ban' ? 'bạn đồng hành' : 'đạo lữ'}: /tutien ${i.kind} chap-nhan ${i.from}`)

  if (lines.length && (await chat($))) $.ui.log(lines.join('\n'))
  for (const m of fresh) $.ui.toast(m.text)
}

// Nhắc nghỉ (spec 20.1): dùng liên tục hơn 2 giờ (các lượt cách nhau dưới 20 phút) thì nhắc một dòng.
export function breakCheck(start: number | undefined, last: number | undefined, now: number): { start: number; remind: boolean } {
  const s = last === undefined || now - last > 20 * 60_000 || start === undefined ? now : start
  return now - s >= 2 * HOUR ? { start: now, remind: true } : { start: s, remind: false }
}
const BREAK_LINES = [
  '☕ Đã tu liên tục hơn 2 giờ. Uống nước đi đạo hữu, đan điền cũng cần nghỉ.',
  '🧘 Hơn 2 giờ rồi. Đứng dậy vươn vai, linh khí sẽ chờ.',
  '👀 Mắt đạo hữu đỏ như đèn báo lỗi rồi. Nghỉ 5 phút nhé.',
]
export async function breakReminder($: any, now = Date.now()): Promise<void> {
  const r = breakCheck((await $.store.get('tutien.workStart')) as number | undefined, (await $.store.get('tutien.lastTurn')) as number | undefined, now)
  await $.store.set('tutien.workStart', r.start)
  await $.store.set('tutien.lastTurn', now)
  if (r.remind && (await chat($))) $.ui.log(BREAK_LINES[Math.floor(now / 60_000) % BREAK_LINES.length])
}

// ---- Đối chiếu transcript (spec 21.4): cộng token hôm qua từ ~/.claude/projects, chỉ gửi một con số ----
export function sumTranscript(text: string, day: string, seen: Set<string>): number {
  let total = 0
  for (const line of text.split('\n')) {
    if (!line.includes('"usage"')) continue
    let o: any
    try { o = JSON.parse(line) } catch { continue }
    const u = o?.message?.usage
    if (!u || typeof o.timestamp !== 'string' || vnDay(Date.parse(o.timestamp)) !== day) continue
    const id = `${o.message?.id ?? ''}:${o.requestId ?? ''}`
    if (seen.has(id)) continue
    seen.add(id)
    total += (Number(u.input_tokens) || 0) + (Number(u.output_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0)
  }
  return total
}
export async function reconcile($: any, now = Date.now()): Promise<void> {
  const day = vnDay(now - DAY)
  if ((await $.store.get('tutien.reconciled')) === day) return
  // Đã tính cho ngày này mà gửi lỗi: chỉ gửi lại con số, không đọc lại transcript.
  const cached = (await $.store.get('tutien.reconcileTotal')) as { day: string; total: number } | undefined
  let total = cached?.day === day ? cached.total : -1
  if (total < 0) {
    const h = await home($)
    if (!h) return
    const root = `${h}/.claude/projects`
    const seen = new Set<string>()
    const since = Date.parse(`${day}T00:00:00+07:00`) // file sửa trước đầu ngày cần tính thì không có lượt của ngày đó
    total = 0
    const walk = async (dir: string, depth: number): Promise<void> => {
      for (const e of await $.fs.list(dir).catch(() => [])) {
        const p = `${dir}/${e.name}`
        if (e.kind === 'directory' && depth < 3) await walk(p, depth + 1)
        else if (e.name.endsWith('.jsonl') && e.mtimeMs >= since) total += sumTranscript(String(await $.fs.read(p).catch(() => '')), day, seen)
      }
    }
    await walk(root, 0)
    await $.store.set('tutien.reconcileTotal', { day, total })
  }
  const r = await callServer($, '/reconcile', { day, tokens: total })
  if (r.ok) await $.store.set('tutien.reconciled', day)
}

// ---- Persona cho Claude (bật trong cài đặt): tính cách nhân vật thành giọng của Claude ----
export async function personaSection($: any): Promise<string | null> {
  if ((await $.store.get('tutien.claudePersona')) !== 'on') return null
  const id = (await $.store.get('tutien.persona')) as string | undefined
  if (!id || id === 'none') return null
  const name = ((await $.store.get('tutien.name')) as string | undefined) ?? 'đạo hữu'
  const p = personaById(id)
  const lines = p ? p.lines.slice(0, 3) : (((await $.store.get('tutien.personaLines')) as string[] | null) ?? []).slice(0, 3)
  const label = p ? `${p.name} (${p.catchphrase})` : 'tùy chỉnh'
  return [
    `Trò chơi Tu Tiên Ký: người dùng là tu sĩ "${name}". Khi trò chuyện, hãy nói theo tính cách nhân vật của họ: ${label}.`,
    lines.length ? `Ví dụ giọng điệu: ${lines.map(l => `"${l}"`).join(' ')}` : '',
    'Chỉ đổi giọng điệu và cách xưng hô cho vui; nội dung kỹ thuật, độ chính xác và an toàn giữ nguyên như bình thường. Không nhắc đến trò chơi trừ khi người dùng hỏi.',
  ].filter(Boolean).join('\n')
}
