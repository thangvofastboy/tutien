// server/src/web.ts — trang web Tu Tiên chỉ để xem (spec 26): HTML render sẵn, không framework, không lộ EXP hay token.
// Truy cập chỉ cho thành viên team: bật Cloudflare Access cho tên miền Worker (cấu hình ngoài code).
import { REALM_NAMES } from '../../hooks/rules.ts'
import { PROLOGUE, CHAPTERS, TITLE } from '../../hooks/story.ts'
import { upcomingHolidays } from '../../hooks/holidays.ts'
import { ARTIFACTS, PILLS, BADGES, SHOP } from './extras.ts'
import { ROLES } from './social.ts'
import type { Row } from './logic.ts'

type Deps = {
  allRows: () => Promise<(Row & { title?: string })[]>
  team: () => Promise<any>
  tong: (name: string) => Promise<any>
  assets?: Fetcher
  req: Request
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const MAJORS = ['Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh', 'Hóa Thần', 'Luyện Hư', 'Hợp Thể', 'Đại Thừa', 'Độ Kiếp', 'Chân Tiên', 'Tiên Đế']
const img = (r: { cls: string; gender: string; realm: number }) =>
  `/realms/${encodeURIComponent(r.cls)}/${encodeURIComponent(r.gender)}/${String(r.realm).padStart(2, '0')}.png`
const bar = (pct: number) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></i></div>`
const link = (name: string) => `<a href="/p/${encodeURIComponent(name)}">${esc(name)}</a>`

function page(title: string, body: string, refresh = false): Response {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${refresh ? '<meta http-equiv="refresh" content="60">' : ''}<title>${esc(title)} · Tu Tiên Ký</title>
<style>
:root{--bg:#0f0d17;--card:#1b1726;--line:#352d4a;--fg:#f3e9d2;--muted:#b8ab8f;--gold:#e8c46a;--jade:#5fd3a1;--pink:#f08bb4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,sans-serif}
header,main{max-width:900px;margin:0 auto;padding:16px}
nav{display:flex;flex-wrap:wrap;gap:6px 16px;border-bottom:1px solid var(--line);padding-bottom:12px}
nav a{color:var(--gold);text-decoration:none;font-weight:600}a{color:var(--jade)}
h1{color:var(--gold);margin:8px 0 0;font-size:1.8rem}h2{color:var(--gold);font-size:1.2rem;margin:24px 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.bar{height:10px;border-radius:99px;background:#2a2340;overflow:hidden;margin:6px 0}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--jade),var(--gold))}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left}th{color:var(--muted);font-size:.8rem}
.muted{color:var(--muted)}.sprite{width:192px;height:192px;image-rendering:pixelated}.chip{display:inline-block;border:1px solid var(--gold);color:var(--gold);border-radius:99px;padding:0 10px;margin:2px;font-size:.85rem}
.scroll{overflow-x:auto}.locked{opacity:.5}
</style></head><body><header><nav><a href="/">⚔️ Tổng quan</a><a href="/top">🏆 Bảng xếp hạng</a><a href="/thu-vien">📚 Thư viện</a><a href="/truyen">📜 Cốt truyện</a></nav><h1>${esc(title)}</h1></header><main>${body}</main></body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function boardTable(rows: { name: string; cls: string; realm: number; score: string }[]) {
  if (!rows.length) return '<p class="muted">Chưa có ai.</p>'
  return `<div class="scroll"><table><tr><th>#</th><th>Đạo hữu</th><th>Lớp</th><th>Cảnh giới</th><th>Điểm</th></tr>${rows.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${link(r.name)}</td><td>${esc(r.cls)}</td><td>${esc(REALM_NAMES[r.realm - 1] ?? '')}</td><td>${esc(r.score)}</td></tr>`).join('')}</table></div>`
}

export async function renderWeb(url: URL, d: Deps): Promise<Response | null> {
  let path: string
  try { path = decodeURIComponent(url.pathname) } catch { return null } // URL hỏng như /% thì để Worker trả 404
  if (path.startsWith('/realms/') && d.assets) return d.assets.fetch(d.req)

  if (path === '/') {
    const t = await d.team()
    const hol = upcomingHolidays(Date.now(), 45)
    return page('Tổng quan', `
<div class="card"><b>🌏 Tiến độ toàn team</b> · ${t.players} đạo hữu${bar(t.progress)}<span class="muted">${t.progress}% tổng đường tu của cả team</span></div>
<div class="card"><b>🤝 Thử thách cộng đồng tháng này</b>${bar(t.community.pct)}<span class="muted">${t.community.pct}% mục tiêu${t.community.rewardActive ? ' · Tháng này có bộ thoại đặc biệt!' : ''}</span></div>
<div class="card"><b>☯️ Sự kiện Thiên Đạo</b><br>${esc(t.event.name)}: ${esc(t.event.desc)}${t.event.active ? ' <span class="chip">Đang diễn ra</span>' : ''}</div>
<h2>✨ Vừa đột phá</h2><div class="card">${t.recent.length ? t.recent.map((r: any) => `${link(r.name)} → ${esc(REALM_NAMES[r.realm - 1])}`).join('<br>') : '<span class="muted">Tuần này chưa ai đột phá.</span>'}</div>
<h2>🌀 Bí cảnh</h2><div class="card">Bí cảnh tháng: ghi danh ngày 1–2, thử thách ngày 1–7 mỗi tháng.<br>${hol.map(h => `🎊 ${esc(h.name)}: ${esc(h.days[0])}${h.days.length > 1 ? ` → ${esc(h.days[h.days.length - 1])}` : ''}`).join('<br>') || '<span class="muted">Không có lễ hội trong 45 ngày tới.</span>'}</div>`, true)
  }

  if (path === '/top') {
    const rows = (await d.allRows()).filter(r => !r.flagged)
    const t = await d.team()
    const by = (cmp: (a: Row, b: Row) => number) => [...rows].sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name)).slice(0, 10)
    const maxLife = Math.max(1, ...rows.map(r => r.lifetimeTokens)), maxWeek = Math.max(1, ...rows.map(r => r.week))
    const majors = MAJORS.map((m, i) => ({ m, list: by((a, b) => b.realm - a.realm || b.pct - a.pct).filter(r => Math.floor((r.realm - 1) / 3) === i) })).filter(x => x.list.length)
    return page('Bảng xếp hạng', `
<div class="grid">
<div class="card"><h2>🏔️ Tu vi</h2>${boardTable(by((a, b) => b.realm - a.realm || b.exp - a.exp).map(r => ({ ...r, score: `${r.pct}%` })))}</div>
<div class="card"><h2>💪 Chăm chỉ</h2>${boardTable(by((a, b) => b.lifetimeTokens - a.lifetimeTokens).map(r => ({ ...r, score: `${Math.floor((r.lifetimeTokens / maxLife) * 100)}%` })))}</div>
<div class="card"><h2>📅 Tuần này</h2>${boardTable(by((a, b) => b.week - a.week).map(r => ({ ...r, score: `${Math.floor((r.week / maxWeek) * 100)}%` })))}</div>
<div class="card"><h2>🔥 Phượng hoàng</h2>${boardTable(by((a, b) => b.deaths - a.deaths).map(r => ({ ...r, score: `${r.deaths} lần` })))}</div>
<div class="card"><h2>🎁 Pháp bảo</h2>${boardTable(by((a, b) => b.artifacts - a.artifacts || b.realm - a.realm).map(r => ({ ...r, score: `${r.artifacts}` })))}</div>
<div class="card"><h2>🗼 Tháp Thử Luyện</h2>${boardTable(by((a, b) => (b.floor ?? 0) - (a.floor ?? 0) || (a.floorAt ?? 0) - (b.floorAt ?? 0)).filter(r => (r.floor ?? 0) > 0).map(r => ({ ...r, score: `tầng ${r.floor}` })))}</div>
<div class="card"><h2>🏯 Tông môn</h2>${t.tongs.length ? `<table><tr><th>#</th><th>Tông</th><th>Thành viên</th><th>Tổng tu vi</th></tr>${t.tongs.map((g: any) => `<tr><td>${g.rank}</td><td><a href="/tong/${encodeURIComponent(g.name)}">${esc(g.name)}</a></td><td>${g.members}</td><td>${g.power}</td></tr>`).join('')}</table>` : '<p class="muted">Chưa có tông nào.</p>'}</div>
</div>
<h2>🧭 Theo đại cảnh giới</h2><div class="grid">${majors.map(x => `<div class="card"><b>${esc(x.m)}</b>${boardTable(x.list.map(r => ({ ...r, score: `${r.pct}%` })))}</div>`).join('')}</div>`)
  }

  const prof = /^\/p\/(.+)$/.exec(path)
  if (prof) {
    const r = (await d.allRows()).find(x => x.name.toLowerCase() === prof[1].toLowerCase() && !x.flagged)
    if (!r) return page('Không tìm thấy', '<p class="muted">Không có đạo hữu này.</p>')
    const chapters = CHAPTERS.slice(0, Math.floor((r.realm - 1) / 3) + 1)
    return page(r.name, `<div class="grid"><div class="card" style="text-align:center"><img class="sprite" src="${img(r)}" alt="${esc(r.name)}"></div>
<div class="card"><b>${esc(r.cls)} · ${esc(r.gender)}</b>${r.title ? ` <span class="chip">👑 ${esc(r.title)}</span>` : ''}<br>${esc(REALM_NAMES[r.realm - 1])} · bậc ${r.realm}/33${bar(r.pct)}
${r.trib ? `<span class="chip">⚡ Thiên phạt ${r.trib.pctTrib}%</span>` : ''}${r.persona ? `<br>Tính cách: ${esc(r.persona)}` : ''}<br>Pháp bảo: ${r.artifacts} · Tháp: tầng ${r.floor ?? 0}${r.equipped ? `<br>Trang bị: ${esc(SHOP[r.equipped]?.name ?? r.equipped)}` : ''}</div></div>
<h2>🏅 Huy hiệu</h2><div class="card">${(r.badges ?? []).map(b => `<span class="chip">${esc(BADGES[b]?.name ?? b)}</span>`).join('') || '<span class="muted">Chưa có.</span>'}</div>
<h2>📜 Chương đã mở</h2><div class="card">${chapters.map(c => esc(c.title)).join('<br>')}</div>`)
  }

  const tong = /^\/tong\/(.+)$/.exec(path)
  if (tong) {
    const t = await d.tong(tong[1]).catch(() => null)
    if (!t || t.error) return page('Không tìm thấy', '<p class="muted">Không có tông này.</p>')
    return page(`🏯 ${t.name}`, `<div class="card">Tông Chủ: ${link(t.owner)} · Nhiệm vụ tuần ${t.week.pct}%${bar(t.week.pct)}${t.week.lastOk ? '' : '<span class="muted">Tuần trước chưa đạt: bonus chức vụ đang tạm dừng.</span>'}</div>
<div class="card"><table><tr><th>Đạo hữu</th><th>Chức vụ</th><th>Cảnh giới</th></tr>${t.members.map((m: any) => `<tr><td>${link(m.name)}</td><td>${esc(m.role)}</td><td>${esc(REALM_NAMES[m.realm - 1] ?? '')}</td></tr>`).join('')}</table></div>`)
  }

  if (path === '/thu-vien') {
    const list = (title: string, items: [string, { name: string; desc?: string }][]) =>
      `<div class="card"><h2>${title}</h2>${items.map(([, v]) => `<b>${esc(v.name)}</b>${v.desc ? `: <span class="muted">${esc(v.desc)}</span>` : ''}`).join('<br>')}</div>`
    return page('Thư viện', `<div class="grid">
${list('🎁 Pháp bảo', Object.entries(ARTIFACTS))}
${list('⚗️ Đan dược', Object.entries(PILLS))}
${list('🏯 Chức vụ', Object.entries(ROLES).map(([k, v]) => [k, { name: v.name, desc: `${v.desc}; bậc tối thiểu ${v.minRealm}` }] as [string, { name: string; desc: string }]))}
${list('🏅 Huy hiệu', Object.entries(BADGES))}
${list('🛍️ Chợ phường thị', Object.entries(SHOP).map(([k, v]) => [k, { name: v.name, desc: v.buyable ? `${v.price} linh thạch` : 'phần thưởng lễ hội' }] as [string, { name: string; desc: string }]))}
<div class="card"><h2>🌀 Bí cảnh</h2><b>Bí cảnh tháng</b>: ghi danh ngày 1–2, ngày 1–7 mỗi ngày 1.000.000 token, thưởng pháp bảo hiếm.<br><b>Bí cảnh lễ hội</b>: tổng 3.000.000 token × số ngày của kỳ lễ, thưởng pháp bảo hiếm và Khung Lễ Hội.</div>
</div>`)
  }

  if (path === '/truyen') {
    // Chương chỉ mở khi đã có người trong team đạt đến đại cảnh giới đó.
    const best = Math.max(1, ...(await d.allRows()).map(r => r.realm))
    const open = Math.floor((best - 1) / 3) + 1
    return page('Cốt truyện', `<div class="card"><h2>${esc(TITLE)}</h2>${esc(PROLOGUE).replace(/\n/g, '<br>')}</div>
${CHAPTERS.map((c, i) => i < open
    ? `<div class="card"><h2>${esc(c.title)} · ${esc(c.group)}</h2>${esc(c.text).replace(/\n/g, '<br>')}</div>`
    : `<div class="card locked"><h2>🔒 ${esc(c.title)} · ${esc(c.group)}</h2><span class="muted">Mở khi có đạo hữu đạt ${esc(c.group)}.</span></div>`).join('')}`)
  }
  return null
}
