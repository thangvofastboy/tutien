import { expect, test } from 'claude-code/testing'
import { animatedSprite, rasterFrame, RASTER_FRAMES } from './anim'

const DEFAULT = 0x01000000
// Ảnh 4×4 ô ▀: một điểm đỏ ở nửa dưới ô (1,2), còn lại trong suốt.
function cells(): string {
  const v: number[] = []
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) v.push(0x2580, DEFAULT, x === 1 && y === 2 ? 0xff0000 : DEFAULT)
  let s = ''
  for (const n of v) s += String.fromCharCode(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24)
  return btoa(s)
}
const at = (b64: string, x: number, y: number) => {
  const s = atob(b64), i = (y * 4 + x) * 12
  const u = (o: number) => (s.charCodeAt(i + o) | (s.charCodeAt(i + o + 1) << 8) | (s.charCodeAt(i + o + 2) << 16) | (s.charCodeAt(i + o + 3) << 24)) >>> 0
  return [u(0), u(4), u(8)]
}

test('svg động: có SMIL, giữ ảnh gốc, màu hào quang', () => {
  const svg = animatedSprite('iVBORw0KGgoAAA', false, 192, '#ef5350')
  expect(svg).toContain('<animateTransform')
  expect(svg).toContain('data:image/png;base64,iVBORw0KGgoAAA')
  expect(svg).toContain('#ef5350')
  expect(svg).toContain('pixelated')
})

test('raster: khung chẵn giữ dáng, khung lẻ nhích lên một điểm ảnh, có đốm sáng quanh dáng', () => {
  const b = cells()
  const f0 = rasterFrame(b, 4, 4, 0, '#ef5350')
  expect(at(f0, 1, 2)[2]).toBe(0xff0000) // nửa dưới ô (1,2) giữ nguyên
  const f1 = rasterFrame(b, 4, 4, 1, '#ef5350')
  expect(at(f1, 1, 2)[1]).toBe(0xff0000) // nửa dưới lên thành nửa trên cùng ô
  expect(at(f1, 1, 2)[2]).toBe(DEFAULT)
  const sparks = [...Array(16).keys()].filter(i => at(f0, i % 4, Math.floor(i / 4))[0] !== 0x2580)
  expect(sparks.length).toBeGreaterThan(0)
  for (const i of sparks) expect(at(f0, i % 4, Math.floor(i / 4))[1]).toBe(0xef5350)
  expect(rasterFrame(b, 4, 4, RASTER_FRAMES, '#ef5350')).toBe(f0) // vòng lại, lấy từ cache
  expect(atob(f0).length).toBe(atob(b).length)
})
