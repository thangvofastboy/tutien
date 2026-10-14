// scripts/balance.ts — mô phỏng cân bằng lớp (spec mục 7).
// Chạy: node --experimental-strip-types scripts/balance.ts [số người mỗi lớp]
// Mỗi mức dùng token: số ngày trung bình để đạt bậc 33 của từng lớp phải lệch không quá ±3% so với trung bình chung.
import { applyUsage, CLASSES, DAY_MS, REALM_COUNT } from '../hooks/rules.ts'

const LEVELS = [
  { name: 'ít', perDay: 1_000_000 },
  { name: 'vừa', perDay: 4_370_000 },
  { name: 'nhiều', perDay: 20_000_000 },
]
const TURNS_PER_DAY = 8
const MAX_DAYS = 120 * 365
const TOLERANCE = 0.03

// Bộ sinh số giả ngẫu nhiên có seed, để mọi lớp dùng chung một chuỗi ngẫu nhiên (giảm nhiễu khi so sánh).
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function daysToTop(cls: string, perDay: number, seed: number): number {
  const noise = mulberry32(seed)
  const luck = mulberry32(seed ^ 0x9e3779b9)
  let p = { realm: 1, exp: 0, pending: 0, cls, gender: 'Nam', artifacts: [] } as any
  for (let day = 0; day < MAX_DAYS; day++) {
    const tokens = perDay * (0.7 + 0.6 * noise())
    for (let t = 0; t < TURNS_PER_DAY; t++) {
      p = applyUsage(p, tokens / TURNS_PER_DAY, day * DAY_MS + (t * DAY_MS) / TURNS_PER_DAY, luck).p
      if (p.realm >= REALM_COUNT) return day + 1
    }
  }
  return MAX_DAYS
}

export function simulate(players: number) {
  return LEVELS.map(l => {
    const avg = CLASSES.map(cls => {
      let sum = 0
      for (let i = 0; i < players; i++) sum += daysToTop(cls, l.perDay, i + 1)
      return { cls, days: sum / players }
    })
    const mean = avg.reduce((a, b) => a + b.days, 0) / avg.length
    return { level: l.name, perDay: l.perDay, mean, classes: avg.map(a => ({ ...a, dev: a.days / mean - 1 })) }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const players = Number(process.argv[2] ?? 200)
  let ok = true
  for (const r of simulate(players)) {
    console.log(`\nMức ${r.level} (${(r.perDay / 1e6).toFixed(2)} triệu token/ngày): trung bình ${r.mean.toFixed(0)} ngày`)
    for (const c of r.classes) {
      const bad = Math.abs(c.dev) > TOLERANCE
      if (bad) ok = false
      console.log(`  ${bad ? '✗' : '✓'} ${c.cls.padEnd(14)} ${c.days.toFixed(0).padStart(6)} ngày  ${(c.dev * 100).toFixed(2).padStart(6)}%`)
    }
  }
  console.log(ok ? '\nĐạt: mọi lớp trong ±3%.' : '\nChưa đạt: có lớp lệch quá ±3%.')
  process.exit(ok ? 0 : 1)
}
