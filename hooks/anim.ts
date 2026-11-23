// hooks/anim.ts — ảnh nhân vật chuyển động. Hàm thuần, không đọc $.
// Svg (desktop, điện thoại): SMIL nằm trong SVG nên trình duyệt tự chạy, pane không phải vẽ lại.
// Raster (terminal): khung sinh từ ô màu gốc theo nhịp shimmer: nhấp nhô nửa ô và đốm ✦ quanh dáng người.

// Nhân vật bồng bềnh và thở (co giãn quanh chân), hào quang màu cảnh giới phập phồng, hạt linh khí bay lên.
export function animatedSprite(b64: string, smooth: boolean, size: number, aura: string): string {
  const sparks = [[22, 0], [70, 1.2], [36, 2.1], [60, 3]].map(([x, d]) =>
    `<rect x="${x}" y="80" width="2" height="2" fill="${aura}" opacity="0"><animate attributeName="y" values="80;20" dur="3.6s" begin="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.9;0" dur="3.6s" begin="${d}s" repeatCount="indefinite"/></rect>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">` +
    `<defs><radialGradient id="au"><stop offset="0" stop-color="${aura}" stop-opacity="0.55"/><stop offset="1" stop-color="${aura}" stop-opacity="0"/></radialGradient></defs>` +
    `<ellipse cx="48" cy="56" rx="40" ry="42" fill="url(#au)"><animate attributeName="opacity" values="0.35;0.8;0.35" dur="3s" repeatCount="indefinite"/></ellipse>` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur="3s" repeatCount="indefinite"/>` +
    `<g transform="translate(48 96)"><g><animateTransform attributeName="transform" type="scale" values="1 1;1.008 1.016;1 1" dur="3s" repeatCount="indefinite"/>` +
    `<image href="data:image/png;base64,${b64}" x="-48" y="-96" width="96" height="96" style="image-rendering:${smooth ? 'auto' : 'pixelated'}"/></g></g></g>` +
    sparks + `</svg>`
}

// Ô Raster: 3 u32 little-endian [ký tự, màu trên, màu dưới]; ▀ nên màu trên là chữ, màu dưới là nền.
const DEFAULT = 0x01000000 // màu mặc định của terminal (điểm trong suốt)
const HALF = 0x2580
const SPARK = [0x2726, 0x2727, 0x00b7] // ✦ ✧ ·
type Decoded = { cols: number; rows: number; cells: Uint32Array; spots: number[] }

function decode(b64: string, cols: number, rows: number): Decoded {
  const s = atob(b64)
  const cells = new Uint32Array(cols * rows * 3)
  for (let i = 0; i < cells.length; i++) {
    const o = i * 4
    cells[i] = (s.charCodeAt(o) | (s.charCodeAt(o + 1) << 8) | (s.charCodeAt(o + 2) << 16) | (s.charCodeAt(o + 3) << 24)) >>> 0
  }
  const empty = (x: number, y: number) => {
    const i = (y * cols + x) * 3
    return cells[i + 1] === DEFAULT && cells[i + 2] === DEFAULT
  }
  // Chỗ đặt đốm sáng: ô trống sát dáng người (cách 1 ô), để đốm bám quanh nhân vật.
  const spots: number[] = []
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
    if (!empty(x, y)) continue
    let near = false
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (!empty(x + dx, y + dy)) { near = true; break }
    if (near) spots.push(y * cols + x)
  }
  return { cols, rows, cells, spots }
}

function encode(cells: Uint32Array): string {
  let out = ''
  for (const v of cells) out += String.fromCharCode(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24)
  return btoa(out)
}

const hex = (c: string) => parseInt(c.slice(1), 16)
export const RASTER_FRAMES = 8
// Giữ khung của ảnh gần nhất: pane vẽ lại mỗi 250 ms khi có hiệu ứng, mỗi 1,5 s khi lung linh.
let memo: { key: string; d: Decoded; frames: (string | undefined)[] } | null = null

// Khung k: k lẻ thì nhân vật nhích lên nửa ô (một điểm ảnh), cùng 3 đốm sáng đổi chỗ mỗi khung.
// Ô không phải ▀ (ảnh lạ) thì giữ nguyên ảnh, chỉ thêm đốm.
export function rasterFrame(b64: string, cols: number, rows: number, k: number, aura: string): string {
  const key = `${aura}|${b64}`
  if (memo?.key !== key) memo = { key, d: decode(b64, cols, rows), frames: [] }
  const f = ((k % RASTER_FRAMES) + RASTER_FRAMES) % RASTER_FRAMES
  return (memo.frames[f] ??= encode(frame(memo.d, f, hex(aura))))
}

function frame(d: Decoded, f: number, aura: number): Uint32Array {
  const { cols, rows, cells, spots } = d
  const out = cells.slice()
  const allHalf = f % 2 === 1 && cells.every((v, i) => i % 3 !== 0 || v === HALF)
  if (allHalf) {
    // Dời lên một điểm ảnh: nửa trên ô y lấy nửa dưới ô y, nửa dưới lấy nửa trên ô y+1.
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 3
      out[i + 1] = cells[i + 2]
      out[i + 2] = y + 1 < rows ? cells[i + 3 * cols + 1] : DEFAULT
    }
  }
  if (spots.length) {
    for (let j = 0; j < 3; j++) {
      const at = spots[(Math.imul(f * 3 + j + 1, 2654435761) >>> 0) % spots.length]
      const i = at * 3
      if (out[i + 1] !== DEFAULT || out[i + 2] !== DEFAULT) continue // ô đã bị nhân vật dời lên chiếm
      out[i] = SPARK[(f + j) % SPARK.length]
      out[i + 1] = aura
      out[i + 2] = DEFAULT
    }
  }
  return out
}
