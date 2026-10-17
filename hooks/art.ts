// hooks/art.ts — hình minh họa SVG và khung hoạt ảnh cho kỳ ngộ, luận đạo, công pháp và hiệu ứng sự kiện.
// Hàm thuần: trả về chuỗi SVG (Desktop, web, điện thoại vẽ qua Svg) hoặc dòng chữ (terminal).
// Hoạt ảnh nền dùng <animate> của SVG; hoạt ảnh hiệu ứng đi theo tick của pane (mỗi 250 ms) nên chạy cả khi bề mặt bỏ qua <animate>.

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const W = 360
const H = 180

// Mỗi cảnh đặt id riêng cho gradient (theo seed): nhiều SVG nằm chung một trang thì id trùng sẽ lấy nhầm màu.
// Hạt lấp lánh: vị trí cố định theo seed, nhấp nháy bằng <animate>.
function sparkles(seed: number, n: number, color: string): string {
  let x = seed * 9301 + 49297
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280 }
  return Array.from({ length: n }, () => {
    const cx = Math.round(rnd() * W), cy = Math.round(rnd() * H), r = (1 + rnd() * 2).toFixed(1), d = (1 + rnd() * 2).toFixed(1)
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"><animate attributeName="opacity" values="0;1;0" dur="${d}s" repeatCount="indefinite"/></circle>`
  }).join('')
}
const frame = (bg1: string, bg2: string, body: string, seed: number, glint = '#fff8c4') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif">
<defs><linearGradient id="tt-bg-${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
<radialGradient id="tt-glow-${seed}"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" rx="14" fill="url(#tt-bg-${seed})"/>${sparkles(seed, 18, glint)}${body.replaceAll('url(#glow)', `url(#tt-glow-${seed})`)}</svg>`
// Emoji lớn lơ lửng lên xuống.
const floatEmoji = (e: string, x: number, y: number, size: number, dur = 3) =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${e}<animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="${dur}s" repeatCount="indefinite"/></text>`
const halo = (x: number, y: number, r: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glow)"><animate attributeName="r" values="${r};${r + 8};${r}" dur="2.4s" repeatCount="indefinite"/></circle>`
const ground = (color: string) => `<path d="M0 150 Q90 132 180 148 T360 144 V180 H0 Z" fill="${color}" opacity="0.85"/>`

// ---------- Kỳ ngộ: mỗi tình huống một cảnh ----------
export const KY_NGO_SCENES: Record<string, () => string> = {
  'linh-thao': () => frame('#0f2a1f', '#1b4332', ground('#2d6a4f') + halo(180, 100, 34) + floatEmoji('🌿', 180, 118, 52) + floatEmoji('📦', 70, 150, 30, 4) +
    `<text x="70" y="168" font-size="10" fill="#95d5b2" text-anchor="middle">node_modules</text>` + floatEmoji('🦋', 280, 70, 22, 2.2), 1, '#b7e4c7'),
  'tien-boi': () => frame('#1e1b4b', '#312e81', ground('#3730a3') + floatEmoji('☁️', 80, 50, 34, 5) + floatEmoji('☁️', 290, 40, 26, 6) + halo(180, 95, 40) + floatEmoji('🧙', 180, 125, 58) +
    `<rect x="236" y="60" width="96" height="34" rx="8" fill="#ffffff" opacity="0.92"/><text x="284" y="82" font-size="13" text-anchor="middle" fill="#312e81" font-weight="700">:wq ?</text>`, 2),
  'ao-canh': () => frame('#2a0a3a', '#0b1020', `<g opacity="0.75">${['<<<<<<< HEAD', '=======', '>>>>>>> main'].map((t, i) =>
    `<text x="${[30, 250, 220][i]}" y="${[40, 60, 160][i]}" font-size="15" fill="${['#f778ba', '#e2c5ff', '#79c0ff'][i]}" font-family="monospace">${esc(t)}<animate attributeName="opacity" values="0.2;1;0.2" dur="${2 + i}s" repeatCount="indefinite"/></text>`).join('')}</g>` +
    `<circle cx="180" cy="95" r="44" fill="none" stroke="#d2a8ff" stroke-width="2" stroke-dasharray="6 6"><animateTransform attributeName="transform" type="rotate" from="0 180 95" to="360 180 95" dur="8s" repeatCount="indefinite"/></circle>` + floatEmoji('🌀', 180, 112, 48), 3, '#e2c5ff'),
  'dan-lo': () => frame('#3b1d0a', '#1a0e05', ground('#5c3317') + halo(180, 92, 36) + floatEmoji('⚗️', 180, 128, 60) +
    [0, 1, 2].map(i => `<circle cx="${165 + i * 15}" cy="60" r="${5 + i}" fill="#c9d1d9" opacity="0.6"><animate attributeName="cy" values="70;20" dur="${2 + i * 0.5}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0" dur="${2 + i * 0.5}s" repeatCount="indefinite"/></circle>`).join('') + floatEmoji('🐈', 290, 150, 26, 2.6), 4, '#ffd8a8'),
  'thien-thu': () => frame('#0b132b', '#1c2541', floatEmoji('⭐', 60, 40, 18, 2) + floatEmoji('⭐', 300, 55, 14, 2.5) +
    `<g><text x="180" y="40" font-size="46" text-anchor="middle">📜<animateTransform attributeName="transform" type="translate" values="0 -30;0 40;0 40" keyTimes="0;0.6;1" dur="3s" repeatCount="indefinite"/></text></g>` +
    floatEmoji('🤕', 180, 165, 44) + `<text x="250" y="120" font-size="12" fill="#ffd54f" font-weight="700">Clean Code</text>`, 5),
  'yeu-thu': () => frame('#3a0d0d', '#120404', ground('#4a1212') + halo(240, 92, 42) + floatEmoji('🐛', 240, 125, 64, 1.6) + floatEmoji('⚔️', 100, 120, 40, 2) +
    `<text x="270" y="36" font-size="13" fill="#ff7b72" font-family="monospace">02:00 AM<animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></text>`, 6, '#ffa198'),
}
export const kyNgoScene = (id: string) => (KY_NGO_SCENES[id] ?? KY_NGO_SCENES['linh-thao'])()

// Terminal: ba dòng tranh chữ cho mỗi kỳ ngộ.
export const KY_NGO_ASCII: Record<string, string[]> = {
  'linh-thao': ['    ✿  ✧', '   \\|/   [node_modules]', ' ~~~🌿~~~~~~~~~~~~~~~~'],
  'tien-boi': ['   ☁    ( :wq ? )', '     🧙  /', ' ~~~~~~~~~~~~~~~~~'],
  'ao-canh': [' <<<<<<< HEAD', '   🌀 =======', ' >>>>>>> main'],
  'dan-lo': ['    °  o  °', '     ⚗️   🐈', ' ▀▀▀▀▀▀▀▀▀▀▀▀'],
  'thien-thu': ['   ✦   📜 ↓   ✦', '        ↓', '       🤕'],
  'yeu-thu': ['  ⚔️      🐛🐛🐛', '   \\    ( 02:00 )', ' ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄'],
}

// ---------- Luận đạo: hai bên, tia lửa ở giữa, người thắng có vương miện ----------
export function duelScene(a: string, b: string, aIcon: string, bIcon: string, win: boolean): string {
  const crown = (x: number) => `<text x="${x}" y="42" font-size="26" text-anchor="middle">👑<animate attributeName="y" values="46;38;46" dur="1.5s" repeatCount="indefinite"/></text>`
  const label = (x: number, t: string, c: string) => `<text x="${x}" y="168" font-size="14" fill="${c}" text-anchor="middle" font-weight="700">${esc(t.slice(0, 14))}</text>`
  return frame('#1f1235', '#0d1117',
    `<path d="M150 70 L175 95 L160 98 L190 130 L168 100 L183 97 Z" fill="#ffd54f"><animate attributeName="opacity" values="1;0.2;1" dur="0.6s" repeatCount="indefinite"/></path>` +
    halo(180, 98, 30) +
    `<text x="80" y="128" font-size="56" text-anchor="middle">${aIcon}<animateTransform attributeName="transform" type="translate" values="0 0;14 0;0 0" dur="0.9s" repeatCount="indefinite"/></text>` +
    `<text x="280" y="128" font-size="56" text-anchor="middle">${bIcon}<animateTransform attributeName="transform" type="translate" values="0 0;-14 0;0 0" dur="0.9s" repeatCount="indefinite"/></text>` +
    (win ? crown(80) : crown(280)) + label(80, a, win ? '#ffd54f' : '#8b949e') + label(280, b, win ? '#8b949e' : '#ffd54f') +
    `<text x="180" y="30" font-size="16" fill="#ff7b72" text-anchor="middle" font-weight="800">LUẬN ĐẠO</text>`, 7, '#ffd54f')
}

// ---------- Công pháp: cuộn kinh có tên môn phái, sao theo số tầng đã tu ----------
export function scrollScene(school: string, icon: string, color: string, skills: { icon: string; n: number; max: number; ult: boolean }[]): string {
  const rows = skills.map((s, i) => {
    const x = 50 + i * 65
    const lit = s.n > 0
    return `<g opacity="${lit ? 1 : 0.45}"><circle cx="${x}" cy="100" r="24" fill="${s.ult ? '#3b2a00' : '#161b22'}" stroke="${lit ? color : '#30363d'}" stroke-width="${s.ult ? 3 : 2}">${lit ? `<animate attributeName="stroke-opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/>` : ''}</circle>
<text x="${x}" y="109" font-size="24" text-anchor="middle">${s.icon}</text>
<text x="${x}" y="142" font-size="11" fill="${color}" text-anchor="middle">${'★'.repeat(s.n)}${'☆'.repeat(s.max - s.n)}</text></g>`
  }).join('')
  const links = skills.slice(0, -1).map((_, i) => `<line x1="${74 + i * 65}" y1="100" x2="${91 + i * 65}" y2="100" stroke="${color}" stroke-opacity="0.4" stroke-width="2"/>`).join('')
  return frame('#161b22', '#0d1117',
    `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10" fill="#f5f0e1" opacity="0.06" stroke="${color}" stroke-opacity="0.6"/>` +
    `<text x="180" y="44" font-size="18" fill="${color}" text-anchor="middle" font-weight="800">${icon} ${esc(school)}</text>` + links + rows, 8, color)
}

// ---------- Hiệu ứng sự kiện: khung theo tick ----------
export type FxKind = 'kyngo' | 'sparkle' | 'fire' | 'meteor' | 'scroll' | 'ult' | 'win' | 'lose' | 'treasure' | 'badge'
const FX_COLORS: Record<FxKind, string[]> = {
  kyngo: ['#56d4dd', '#e2c5ff', '#ffffff'], sparkle: ['#ffd54f', '#fff8c4'], fire: ['#ff7b72', '#ffa657', '#ffd54f'],
  meteor: ['#ffd54f', '#ff7b72', '#e2c5ff'], scroll: ['#d2a8ff', '#ffd54f'], ult: ['#ffd54f', '#ff7b72', '#79c0ff', '#7ee787'],
  win: ['#ffd54f', '#ffa657'], lose: ['#8b949e', '#6e7681'], treasure: ['#f2cc60', '#ffd54f', '#56d4dd'], badge: ['#ffd54f', '#d2a8ff'],
}
const FX_ICONS: Record<FxKind, string> = { kyngo: '🎲', sparkle: '✨', fire: '🔥', meteor: '☄️', scroll: '📖', ult: '🌟', win: '🏆', lose: '🥀', treasure: '🎁', badge: '🏅' }
// Một khung SVG: hạt bay ra từ giữa (pháo hoa) hoặc rơi từ trên (sao băng, lửa bốc lên) theo tick.
export function fxSvg(kind: FxKind, tick: number): string {
  const colors = FX_COLORS[kind]
  const t = tick % 12
  const n = 16
  const parts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const c = colors[i % colors.length]
    if (kind === 'meteor') {
      const x = ((i * 47 + t * 18) % (W + 60)) - 30, y = ((i * 23 + t * 14) % H)
      return `<line x1="${x}" y1="${y}" x2="${x - 18}" y2="${y - 12}" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="${0.4 + (i % 3) * 0.2}"/>`
    }
    if (kind === 'fire') {
      const x = 40 + ((i * 53) % (W - 80)), y = H - ((t * 12 + i * 17) % H)
      return `<circle cx="${x}" cy="${y}" r="${3 + (i % 3)}" fill="${c}" opacity="${(y / H).toFixed(2)}"/>`
    }
    if (kind === 'lose') {
      const x = (i * 29) % W, y = (t * 10 + i * 13) % H
      return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}" stroke="${c}" stroke-width="2" opacity="0.6"/>`
    }
    const r = 10 + t * 7 + (i % 2) * 6
    return `<circle cx="${(W / 2 + Math.cos(a) * r).toFixed(1)}" cy="${(H / 2 + Math.sin(a) * r * 0.6).toFixed(1)}" r="${Math.max(1, 4 - t * 0.25).toFixed(1)}" fill="${c}" opacity="${Math.max(0.1, 1 - t / 12).toFixed(2)}"/>`
  }).join('')
  const pulse = 40 + (t % 4) * 4
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts}<text x="${W / 2}" y="${H / 2 + pulse / 3}" font-size="${pulse}" text-anchor="middle">${FX_ICONS[kind]}</text></svg>`
}
