// hooks/rules.ts — nguồn luật duy nhất (spec mục 2, 4, 5, 6, 22, 23)
export const REALM_COUNT = 33
export const DAY_MS = 24 * 3_600_000
export const PEAK_TOKENS_PER_DAY = 20_000_000
export const SAFE_TOKENS_PER_DAY = 750_000
export const TOKENS_PER_EXP = 1000
export const DEATH_CHANCE = 0.02
export const ARTIFACT_CHANCE = 0.2

const BASE = [8685,10727,13249,16363,20210,24961,30830,38077,47029,58084,71739,88604,109434,135161,166935,206180,254650,314515,388453,479774,592562,731866,903919,1116418,1378874,1703030,2103390,2597871,3208597,3962898,4894524,6045165]
export const NEED: number[] = BASE.map(x => Math.round((x * 0.8 * PEAK_TOKENS_PER_DAY) / 17_370_445))

export const REALM_NAMES = [
  'Luyện Khí Sơ Kỳ','Luyện Khí Trung Kỳ','Luyện Khí Hậu Kỳ','Trúc Cơ Sơ Kỳ','Trúc Cơ Trung Kỳ','Trúc Cơ Hậu Kỳ',
  'Kim Đan Sơ Kỳ','Kim Đan Trung Kỳ','Kim Đan Hậu Kỳ','Nguyên Anh Sơ Kỳ','Nguyên Anh Trung Kỳ','Nguyên Anh Hậu Kỳ',
  'Hóa Thần Sơ Kỳ','Hóa Thần Trung Kỳ','Hóa Thần Hậu Kỳ','Luyện Hư Sơ Kỳ','Luyện Hư Trung Kỳ','Luyện Hư Hậu Kỳ',
  'Hợp Thể Sơ Kỳ','Hợp Thể Trung Kỳ','Hợp Thể Hậu Kỳ','Đại Thừa Sơ Kỳ','Đại Thừa Trung Kỳ','Đại Thừa Hậu Kỳ',
  'Độ Kiếp Sơ Kỳ','Độ Kiếp Trung Kỳ','Độ Kiếp Hậu Kỳ','Chân Tiên Sơ Kỳ','Chân Tiên Trung Kỳ','Chân Tiên Hậu Kỳ',
  'Tiên Đế Sơ Kỳ','Tiên Đế Trung Kỳ','Tiên Đế Hậu Kỳ',
]
export const CLASSES = ['Kiếm Tu','Đan Sư','Trận Pháp Sư','Luyện Khí Sư','Phù Tu','Thể Tu','Ma Tu'] as const
export const GENDERS = ['Nam','Nữ'] as const

type Mods = { expMult?: number; tribMult?: number; extraWindowMs?: number; keepRatio?: number; deathChance?: number; afterFailMult?: number }
export const CLASS_MODS: Record<string, Mods> = {
  'Kiếm Tu': { expMult: 1.03 },
  'Đan Sư': { tribMult: 0.95 },
  'Trận Pháp Sư': { extraWindowMs: 12 * 3_600_000 },
  'Luyện Khí Sư': { keepRatio: 0.15 },
  'Phù Tu': { deathChance: 0.0175 },
  'Thể Tu': { afterFailMult: 0.9 },
  'Ma Tu': { expMult: 1.05, deathChance: 0.025 },
}

// Chữ thường: pháp bảo thường. Chữ hoa: pháp bảo hiếm từ bí cảnh (spec 18.7), mạnh hơn nhưng chung trần.
export type Artifact = 'e' | 't' | 'd' | 'E' | 'T' | 'D'
export type Player = {
  realm: number; exp: number; pending: number; cls: string; gender: string
  artifacts: Artifact[]; failedLast?: boolean
  lastPenaltyAt?: number
  trib?: { startedAt: number; deadline: number; required: number; earned: number }
}
export type Event = 'breakthrough' | 'tribulation-started' | 'tribulation-failed' | 'death' | 'artifact'

export const need = (realm: number) => NEED[realm - 1]
export const trib = (realm: number) => Math.round(PEAK_TOKENS_PER_DAY * (0.1 + (0.7 * (realm - 1)) / 31))
export const newPlayer = (cls: string, gender: string): Player => ({ realm: 1, exp: 0, pending: 0, cls, gender, artifacts: [] })

// Bonus ngoài lớp và pháp bảo, do server tính cho từng lượt (spec 18, 20).
// exp, trib, death: chức vụ tông, tán tu, đồng hành — cộng chung vào trần pháp bảo.
// pillExp, eventTrib, pillTrib, halfDeath: đan dược và sự kiện Thiên Đạo — ngoài trần.
export type Extra = { exp?: number; trib?: number; death?: number; pillExp?: number; pillTrib?: number; eventTrib?: number; halfDeath?: boolean }

// Hiệu lực tổng hợp: bonus lớp + pháp bảo + bonus ngoài, đã áp trần (spec mục 5, 18.1).
export function effects(p: Player, x: Extra = {}) {
  const m = CLASS_MODS[p.cls] ?? {}
  const count = (k: Artifact) => p.artifacts.filter(a => a === k).length
  const expBonus = Math.min(count('e') * 0.005 + count('E') * 0.015 + (x.exp ?? 0), 0.015)
  const tribBonus = Math.min(count('t') * 0.01 + count('T') * 0.025 + (x.trib ?? 0), 0.025)
  const deathBonus = Math.min(count('d') * 0.0005 + count('D') * 0.001 + (x.death ?? 0), 0.0015)
  const death = Math.max(0, (m.deathChance ?? DEATH_CHANCE) - deathBonus)
  return {
    expMult: (m.expMult ?? 1) + expBonus + (x.pillExp ?? 0),
    tribMult: (m.tribMult ?? 1) * (1 - tribBonus) * (1 - (x.pillTrib ?? 0)) * (1 - (x.eventTrib ?? 0)),
    deathChance: x.halfDeath ? death / 2 : death,
    extraWindowMs: m.extraWindowMs ?? 0,
    keepRatio: m.keepRatio ?? 0,
    afterFailMult: m.afterFailMult ?? 1,
  }
}

export const windowMs = (realm: number, cls: string) =>
  Math.ceil(trib(realm) / SAFE_TOKENS_PER_DAY) * DAY_MS + (CLASS_MODS[cls]?.extraWindowMs ?? 0)

export function settle(p: Player, now: number): { p: Player; events: Event[] } {
  if (p.trib && now >= p.trib.deadline) {
    const m = effects(p)
    return { p: { ...p, exp: Math.floor(p.exp * m.keepRatio), failedLast: true, trib: undefined }, events: ['tribulation-failed'] }
  }
  return { p, events: [] }
}

export function applyUsage(p0: Player, tokens: number, now: number, rng: () => number, x: Extra = {}): { p: Player; events: Event[] } {
  const s = settle(p0, now)
  let p = s.p
  const events = [...s.events]
  if (p.realm >= REALM_COUNT) return { p, events }
  const m = effects(p, x)

  if (p.trib) {
    const trib2 = { ...p.trib, earned: p.trib.earned + tokens }
    if (trib2.earned < trib2.required) return { p: { ...p, trib: trib2 }, events }
    p = { ...p, realm: p.realm + 1, exp: 0, pending: 0, trib: undefined }
    events.push('breakthrough')
    if (rng() < m.deathChance) {
      return { p: { ...p, realm: 1, exp: 0, artifacts: [], failedLast: false }, events: [...events, 'death'] }
    }
    if ((p.realm - 1) % 3 === 0 && rng() < ARTIFACT_CHANCE) {
      const kinds: Artifact[] = ['e', 't', 'd']
      p = { ...p, artifacts: [...p.artifacts, kinds[Math.floor(rng() * 3)]] }
      events.push('artifact')
    }
    return { p, events }
  }

  const total = p.pending + Math.floor(tokens * m.expMult)
  const exp = p.exp + Math.floor(total / TOKENS_PER_EXP)
  p = { ...p, exp, pending: total % TOKENS_PER_EXP }
  if (exp >= need(p.realm)) {
    const req = Math.round(trib(p.realm) * m.tribMult * (p.failedLast ? m.afterFailMult : 1))
    p = {
      ...p, exp: need(p.realm), failedLast: false,
      trib: { startedAt: now, deadline: now + windowMs(p.realm, p.cls), required: req, earned: 0 },
    }
    events.push('tribulation-started')
  }
  return { p, events }
}
