// hooks/views.ts — chữ hiển thị cho các lệnh mở rộng (spec 18, 20, 25). Hàm thuần, không lộ số EXP hay token (spec 19.6).
import { REALM_NAMES, type Player } from './rules'
import { statusText, stateIcon, timeLeft } from './display'

const BLOCKS = ' ▁▂▃▄▅▆▇█'

// Biểu đồ cột 14 ngày bằng ký tự khối (spec 18.6), cao 1 dòng, theo phần trăm so với ngày cao nhất.
export function historyChart(days: { day: string; pct: number }[]): string[] {
  const cols = days.map(d => BLOCKS[Math.round((Math.max(0, Math.min(100, d.pct)) / 100) * 8)])
  const first = days[0]?.day.slice(5) ?? ''
  const last = days[days.length - 1]?.day.slice(5) ?? ''
  return [`📊 Tu luyện 14 ngày (so với ngày nhiều nhất)`, `   ${cols.join(' ')}`, `   ${first}${' '.repeat(Math.max(1, cols.length * 2 - first.length - last.length - 1))}${last}`]
}

export type Status = {
  quest: { pct: number; done: number }
  bicanh: string | null
  holiday: { name: string; pct: number; done: boolean } | null
  pills: { bag: string[]; active: string[] }
  beQuanUntil: number | null
  linhThach: number
  badges: string[]
  artifacts: string[]
  floor: number
  streak: number
  tamma: { pct: number; until: number } | null
  tammaWins: number
  congrats: number
  devices: number
  equipped: string | null
  linhCan?: { id: string; name: string; icon: string } | null
  kyNgo?: { title: string } | null
  congPhap?: { points: number }
  luanDao?: { wins: number; losses: number }
}
export type SocialInfo = {
  tong: { name: string; role: string; weekPct: number; paused: boolean } | null
  companion: string | null
  partner: string | null
  invites: { from: string; kind: string }[]
  title: string | null
  event: { active: boolean; name: string; desc: string }
  master?: string | null
  disciples?: (string | null)[]
  linhMach?: boolean
}

const ART_NAMES: Record<string, string> = { e: 'Tụ Linh Bình', t: 'Phá Kiếp Phù', d: 'Hộ Mệnh Ngọc', E: 'Tụ Linh Bình Hiếm', T: 'Phá Kiếp Phù Hiếm', D: 'Hộ Mệnh Ngọc Hiếm' }
export const artifactNames = (a: string[]) => {
  const n: Record<string, number> = {}
  for (const k of a) n[k] = (n[k] ?? 0) + 1
  return Object.entries(n).map(([k, c]) => `${ART_NAMES[k] ?? k}${c > 1 ? ` ×${c}` : ''}`).join(', ')
}

export function statusLines(name: string, p: Player, s: Status | undefined, soc: SocialInfo | undefined, now: number): string[] {
  const out = [`${stateIcon(p)} ${name}${soc?.title ? ` 👑 ${soc.title}` : ''} · ${p.cls} · ${p.gender}`, `   ${statusText(p, now)}`]
  if (!s) return out
  if (s.beQuanUntil) out.push(`🧘 Đang bế quan, còn ${timeLeft(now, s.beQuanUntil)}`)
  if (s.tamma) out.push(`👹 Tâm Ma đang rình: xua đuổi ${s.tamma.pct}%, còn ${timeLeft(now, s.tamma.until)}`)
  out.push(`📅 Nhiệm vụ ngày: ${s.quest.pct}% · đã xong ${s.quest.done} lần (10 lần được một pháp bảo)`)
  if (s.bicanh) out.push(`🌀 ${s.bicanh}`)
  if (s.holiday) out.push(`🎊 ${s.holiday.name}: ${s.holiday.done ? 'đã nhận thưởng' : `${s.holiday.pct}%`}`)
  if (soc?.tong) out.push(`🏯 ${soc.tong.name} · ${soc.tong.role} · nhiệm vụ tuần ${soc.tong.weekPct}%${soc.tong.paused ? ' · bonus chức vụ đang tạm dừng' : ''}`)
  else out.push('🍃 Tán tu: +0,5% EXP')
  if (soc?.companion) out.push(`🤝 Bạn đồng hành: ${soc.companion}`)
  if (soc?.partner) out.push(`💞 Đạo lữ: ${soc.partner}`)
  for (const i of soc?.invites ?? []) out.push(i.kind === 'su-do' ? `🙇 ${i.from} xin bái sư: /tutien nhan-do ${i.from}` : `💌 ${i.from} mời làm ${i.kind === 'ban' ? 'bạn đồng hành' : 'đạo lữ'}: /tutien ${i.kind} chap-nhan ${i.from}`)
  if (soc?.linhMach) out.push('⛲ Tông đang giữ Linh Mạch: +0,5% EXP')
  if (soc?.master) out.push(`🧑‍🏫 Sư phụ: ${soc.master} (+0,5% EXP)`)
  if (soc?.disciples?.length) out.push(`🧑‍🎓 Đồ đệ: ${soc.disciples.join(', ')}`)
  if (s.linhCan) out.push(`🌈 ${s.linhCan.icon} ${s.linhCan.name}`)
  if (s.streak) out.push(`🔥 Chuỗi tu luyện ${s.streak} ngày liên tục`)
  if (s.congPhap?.points) out.push(`📖 Còn ${s.congPhap.points} điểm công pháp: /tutien cong-phap`)
  if (s.kyNgo) out.push(`🎲 Kỳ ngộ đang chờ: ${s.kyNgo.title} → /tutien ky-ngo`)
  if (soc?.event.active) out.push(`☯️ ${soc.event.name}: ${soc.event.desc}`)
  if (s.artifacts.length) out.push(`🎁 Pháp bảo: ${artifactNames(s.artifacts)}`)
  if (s.pills.bag.length || s.pills.active.length) out.push(`⚗️ Đan: ${[...s.pills.active.map(x => `${x} (đang dùng)`), ...s.pills.bag].join(', ')}`)
  out.push(`💎 Linh thạch: ${s.linhThach} · 🗼 Tháp tầng ${s.floor} · 🔥 ${s.streak} ngày liên tục · 🗡️ diệt Tâm Ma ${s.tammaWins} lần`)
  if (s.badges.length) out.push(`🏅 ${s.badges.length} huy hiệu · 🎉 được chúc mừng ${s.congrats} lần`)
  if (s.devices > 1) out.push(`🔗 ${s.devices} máy dùng chung nhân vật này`)
  return out
}

export function findLines(f: any, now: number): string[] {
  const out = [`🔎 ${f.name}${f.title ? ` 👑 ${f.title}` : ''} · ${f.cls} · ${f.gender}`, `   ${f.realmName} · ${f.pct}% tiến độ · tháp tầng ${f.floor}`]
  if (f.trib) out.push(`   ⚡ Đang thiên phạt ${f.trib.pctTrib}%, còn ${timeLeft(now, f.trib.deadline)}`)
  if (f.persona) out.push(`   💬 Tính cách: ${f.persona}`)
  if (f.tong) out.push(`   🏯 ${f.tong.name} · ${f.tong.role}`)
  if (f.badges?.length) out.push(`   🏅 ${f.badges.length} huy hiệu`)
  return out
}

export function libraryLines(lib: any, have: { artifacts: string[]; badges: string[]; inventory: string[] } | null): string[] {
  const mark = (ok: boolean) => (have ? (ok ? '✅' : '⬜') : '•')
  const out = ['📚 Thư Viện Tu Tiên', '', '🎁 Pháp bảo']
  for (const [k, v] of Object.entries<any>(lib.artifacts)) out.push(`  ${mark(!!have?.artifacts.includes(k))} ${v.name}: ${v.desc}`)
  out.push('', '⚗️ Đan dược (/tutien luyen-dan <loại>)')
  for (const [k, v] of Object.entries<any>(lib.pills)) out.push(`  • ${v.name} (${k}): ${v.desc}`)
  out.push('', '🏯 Chức vụ tông môn')
  for (const v of Object.values<any>(lib.roles)) out.push(`  • ${v.name}: ${v.desc}, bậc tối thiểu ${v.minRealm}, ${v.slots > 10 ? 'không giới hạn' : `${v.slots} chỗ`}`)
  out.push('', '🏅 Huy hiệu')
  for (const [k, v] of Object.entries<any>(lib.badges)) out.push(`  ${mark(!!have?.badges.includes(k))} ${v.name}: ${v.desc}`)
  out.push('', '🛍️ Chợ phường thị (/tutien cho)')
  for (const [k, v] of Object.entries<any>(lib.shop)) out.push(`  ${mark(!!have?.inventory.includes(k))} ${v.name}${v.buyable ? `: ${v.price} linh thạch (${k})` : ': phần thưởng lễ hội'}`)
  out.push('', '🌀 Bí cảnh: tháng (ghi danh ngày 1–2, /tutien bicanh) và lễ hội (tự động)')
  for (const h of lib.holidays ?? []) out.push(`  🎊 ${h.name}: ${h.days[0]}${h.days.length > 1 ? ` → ${h.days[h.days.length - 1]}` : ''}`)
  return out
}

export const realmGroup = (realm: number) => REALM_NAMES[Math.floor((realm - 1) / 3) * 3].replace(' Sơ Kỳ', '')
