// web/server.js — mini web Tu Tiên: node web/server.js <cổng> <thư mục plugin>.
// Chỉ nghe 127.0.0.1; đọc web/state.json do mod ghi, không cần thư viện ngoài.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const port = Number(process.argv[2] || 7340)
const root = path.resolve(process.argv[3] || path.join(__dirname, '..'))
const realms = path.join(root, 'assets', 'realms')
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

function readState() {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'web', 'state.json'), 'utf8')) } catch { return { registered: false } }
}

const PAGE = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu Tiên Ký</title>
<style>
  :root { --bg:#0e1116; --card:#161b22; --line:#30363d; --text:#e6edf3; --dim:#8b949e; --jade:#3fb950; --gold:#d29922; --danger:#f85149; }
  * { box-sizing:border-box }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at 50% 0%,#1f2937,var(--bg)); color:var(--text); font:15px/1.5 system-ui,sans-serif; padding:16px }
  .card { width:min(420px,100%); background:var(--card); border:1px solid var(--line); border-radius:16px; padding:24px; text-align:center }
  img { width:240px; height:240px; image-rendering:pixelated; filter:drop-shadow(0 0 18px rgba(63,185,80,.35)) }
  .trib img { filter:drop-shadow(0 0 18px rgba(210,153,34,.55)) }
  h1 { margin:8px 0 0; font-size:22px }
  .meta { color:var(--dim) }
  .realm { margin-top:12px; font-size:18px; font-weight:600 }
  .bar { height:12px; background:#0d1117; border:1px solid var(--line); border-radius:99px; overflow:hidden; margin:12px 0 6px }
  .bar > div { height:100%; background:var(--jade); transition:width .6s }
  .trib .bar > div { background:var(--gold) }
  .danger .bar > div { background:var(--danger) }
  .status { color:var(--dim) }
  .board { margin-top:18px; text-align:left; border-top:1px solid var(--line); padding-top:12px }
  .board h2 { font-size:15px; margin:0 0 8px; color:var(--gold) }
  .row { display:flex; justify-content:space-between; gap:8px; padding:3px 0; color:var(--dim) }
  .row.me { color:var(--jade); font-weight:600 }
  .badge { display:inline-block; margin-top:12px; padding:2px 10px; border-radius:99px; border:1px solid var(--gold); color:var(--gold); font-weight:600 }
</style></head>
<body><div class="card" id="card"><p class="meta">Đang tải…</p></div>
<script>
const medal = n => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : n + '.')
function boardHtml(rows) {
  if (!rows || !rows.length) return ''
  const show = rows.filter(r => r.rank <= 5 || r.me)
  return '<div class="board"><h2>🏆 Bảng Tu Vi</h2>' + show.map(r =>
    '<div class="row' + (r.me ? ' me' : '') + '"><span>' + medal(Number(r.rank)) + ' ' + esc(r.name) + '</span><span>' + esc(r.realmName) + ' · ' + (Number(r.score) || 0) + '%</span></div>').join('') + '</div>'
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
let last = ''
async function tick() {
  const card = document.getElementById('card')
  try {
    const raw = await (await fetch('/state.json', { cache: 'no-store' })).text()
    if (raw === last) return // không đổi: giữ nguyên DOM, khỏi tải lại ảnh
    last = raw
    const s = JSON.parse(raw)
    if (!s.registered) { card.innerHTML = '<h1>🌱 Chưa Ghi Danh</h1><p class="meta">Dùng /tutien start trong Claude Code.</p>'; return }
    card.className = 'card' + (s.trib ? ' trib' : '') + (s.danger ? ' danger' : '')
    card.innerHTML =
      '<img alt="' + esc(s.realmName) + '" src="/art.png?r=' + Number(s.realm) + '&c=' + encodeURIComponent(s.cls) + '&g=' + encodeURIComponent(s.gender) + '&a=' + encodeURIComponent(s.avatar || '') + '">' +
      '<h1>' + esc(s.icon) + ' ' + esc(s.name) + '</h1>' +
      '<div class="meta">' + esc(s.cls) + ' · ' + esc(s.gender) + '</div>' +
      '<div class="realm">' + esc(s.realmName) + ' · Bậc ' + Number(s.realm) + '/33</div>' +
      '<div class="bar"><div style="width:' + (Number(s.percent) || 0) + '%"></div></div>' +
      '<div class="status">' + esc(s.status) + '</div>' +
      (s.trib ? '<div class="badge">⚡ Thiên Phạt · Còn ' + esc(s.trib.left) + '</div>' : '') +
      boardHtml(s.board)
  } catch { last = ''; card.innerHTML = '<p class="meta">Mất kết nối với Claude Code.</p>' }
}
tick(); setInterval(tick, 3000)
</script></body></html>`

http.createServer((req, res) => {
  if (!hosts.has(req.headers.host || '')) { res.writeHead(403); return res.end() }
  let url
  try { url = new URL(req.url || '/', 'http://127.0.0.1') } catch { res.writeHead(400); return res.end() }
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(PAGE)
  }
  if (url.pathname === '/state.json') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(JSON.stringify(readState()))
  }
  if (url.pathname === '/art.png') {
    const s = readState()
    if (s.avatar) {
      // Ảnh tự chọn (/tutien hinh): mod ghi base64 ra web/avatar.b64.
      return fs.readFile(path.join(root, 'web', 'avatar.b64'), 'utf8', (err, b64) => {
        if (err) { res.writeHead(404); return res.end() }
        res.writeHead(200, { 'content-type': 'image/png' })
        res.end(Buffer.from(b64.trim(), 'base64'))
      })
    }
    const file = path.resolve(root, String(s.image || ''))
    if (!s.image || !file.startsWith(realms + path.sep)) { res.writeHead(404); return res.end() }
    return fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end() }
      res.writeHead(200, { 'content-type': 'image/png' })
      res.end(buf)
    })
  }
  res.writeHead(404)
  res.end()
}).listen(port, '127.0.0.1', () => console.log(`tutien-web listening ${port}`))
