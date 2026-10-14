# Tu Tiên Implementation Plan (Giai đoạn 1: lõi)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (Native, đã chọn). Steps dùng checkbox `- [ ]`.

**Goal:** Mod `/tutien` trong repo này: token → EXP, bậc 1–33, thiên phạt theo cửa sổ bậc, pháp bảo, lớp và giới, persona, lời thoại, tâm ma, hiệu ứng kể chuyện, bảng xếp hạng, và server Cloudflare Worker + Durable Objects.

**Architecture:** Luật thuần trong `hooks/rules.ts` (một nguồn duy nhất, server và mod đều import). Mod đọc `turn.complete`, đệm và gửi lên server; pane vẽ ảnh và lời thoại. Server là Worker + DO theo người chơi + roster. Ảnh do `scripts/gen_realms.py` sinh sẵn.

**Tech Stack:** TypeScript/TSX (hooks module, `claude plugin test`), Cloudflare Workers + Durable Objects (`wrangler`), Python 3 + Pillow (ảnh).

**Spec:** `docs/superpowers/specs/2026-10-14-tutien-cultivation-design.md` (đặc biệt mục 2, 4, 5, 6, 7, 9, 13, 14, 15, 16, 17, 19, 21, 22, 23, 27, 28).

## Global Constraints

- Mức đỉnh thiết kế: **20.000.000 token/ngày**. Đường cong EXP: `round(BASE × 0.8 × 20.000.000 / 17.370.445)`; bậc 1 = **8.000**, bậc 32 = **5.568.230** (bảng `NEED` đã tính, Task 1).
- Thiên phạt token: `round(20.000.000 × (0,1 + 0,7 × (i−1)/31))`, rời bậc `i`. Cửa sổ (ngày) = `ceil(trib / 750.000) + bonus lớp`.
- Token EXP = `input + output + cache_creation`; **không** tính `cache_read`.
- 1.000 token = 1 EXP trước bonus.
- Bonus lớp: Kiếm Tu +3% EXP; Đan Sư −5% token thiên phạt; Trận Pháp Sư +12 giờ cửa sổ; Luyện Khí Sư giữ 15% EXP khi trượt; Phù Tu tử vong 1,75%; Thể Tu −10% token thiên phạt sau lần trượt; Ma Tu +5% EXP và tử vong 2,5%. Tử vong mặc định 2%.
- Pháp bảo: rơi 20% khi lên đại cảnh giới mới (bậc 4, 7, …, 31); mỗi loại Tụ Linh Bình +0,5% EXP (trần +1,5%), Phá Kiếp Phù −1% thiên phạt (trần −2,5%), Hộ Mệnh Ngọc −0,05% tử vong (trần −0,15%). Chết mất hết pháp bảo.
- Thiên phạt: quá cửa sổ → EXP về 0 (Luyện Khí Sư giữ 15%), giữ bậc, đánh dấu trượt.
- Lớp và giới chỉ đổi hình, không có bonus **ngoài** bảng bonus lớp đã liệt kê.
- Mức đỉnh và các con số trên là điểm xuất phát đã mô phỏng (spec mục 23); thay đổi con số phải chạy lại mô phỏng.
- Không commit trừ khi bạn yêu cầu; **nhưng** nhánh `tutien-cultivation` đã được phép. Mỗi task kết thúc bằng commit trên nhánh này.
- Không deploy lên Cloudflare: bước đó do bạn làm (cần tài khoản).

## Review Focus

1. Lượt không có `usage` → 0 token, không làm hỏng mod.
2. Gửi lại cùng `turnId` → không cộng hai lần.
3. Hàng đợi offline tràn → bỏ lượt cũ nhất (giới hạn 500).
4. Thiên phạt hết hạn đúng lúc gửi lượt → token sau hạn không tính.
5. Terminal không hiển thị ảnh → dòng mô tả thay thế.
6. Tâm ma xuất hiện trong lúc thiên phạt nhưng xua đuổi thất bại → chỉ trừ tiến độ, không trừ EXP khi đang thiên phạt.

---

### Task 1: Luật thuần (`hooks/rules.ts`)

**Files:**
- Create: `hooks/rules.ts`
- Test: `hooks/rules.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces: `NEED`, `REALM_NAMES`, `CLASSES`, `GENDERS`, `CLASS_MODS`, `Player`, `newPlayer(cls, gender)`, `effects(p)`, `settle(p, now)`, `applyUsage(p, tokens, now, rng)`, `Event`, `need(realm)`, `trib(realm)`, `windowMs(realm, cls)`, `REALM_COUNT=33`, `DAY_MS`.

- [ ] **Step 1: Viết test trước**

```ts
// hooks/rules.test.ts
import { expect, test } from 'claude-code/testing'
import { applyUsage, newPlayer, need, trib, effects, settle, DAY_MS, REALM_COUNT } from './rules'

const never = () => 0.99
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] }

test('1.000 token = 1 EXP (lớp không có bonus EXP)', () => {
  let { p } = applyUsage(newPlayer('Thể Tu', 'Nam'), 999, 0, never)
  expect(p.exp).toBe(0)
  ;({ p } = applyUsage(p, 1, 0, never))
  expect(p.exp).toBe(1)
})

test('Kiếm Tu +3% EXP', () => {
  const { p } = applyUsage(newPlayer('Kiếm Tu', 'Nam'), 10_000, 0, never)
  expect(p.exp).toBe(10)
})

test('đạt ngưỡng → thiên phạt với token và cửa sổ đúng', () => {
  const start = { ...newPlayer('Thể Tu', 'Nam'), exp: need(1) - 1 }
  const { p, events } = applyUsage(start, 1000, 5, never)
  expect(events).toEqual(['tribulation-started'])
  expect(p.trib?.required).toBe(trib(1))
  expect(p.trib?.deadline).toBe(5 + Math.ceil(trib(1) / 750_000) * DAY_MS)
})

test('Trận Pháp Sư cửa sổ +12 giờ', () => {
  const start = { ...newPlayer('Trận Pháp Sư', 'Nam'), exp: need(1) - 1 }
  const { p } = applyUsage(start, 1000, 0, never)
  expect(p.trib!.deadline).toBe(Math.ceil(trib(1) / 750_000) * DAY_MS + 12 * 3_600_000)
})

test('Đan Sư token thiên phạt −5%', () => {
  const start = { ...newPlayer('Đan Sư', 'Nam'), exp: need(1) - 1 }
  const { p } = applyUsage(start, 1000, 0, never)
  expect(p.trib!.required).toBe(Math.round(trib(1) * 0.95))
})

test('vượt thiên phạt → lên bậc, EXP 0', () => {
  const start = { ...newPlayer('Thể Tu', 'Nam'), exp: need(1), trib: { startedAt: 0, deadline: 999, required: 100, earned: 99 } }
  const { p, events } = applyUsage(start, 1, 10, never)
  expect(p.realm).toBe(2)
  expect(p.exp).toBe(0)
  expect(events).toEqual(['breakthrough'])
})

test('tử vong khi rng < tỷ lệ, mất pháp bảo', () => {
  const start = { ...newPlayer('Thể Tu', 'Nam'), realm: 5, artifacts: ['e'] as const, trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  const { p, events } = applyUsage({ ...start, artifacts: ['e'] as any }, 1, 10, () => 0)
  expect(p.realm).toBe(1)
  expect(p.artifacts.length).toBe(0)
  expect(events).toEqual(['breakthrough', 'death'])
})

test('Phù Tu tử vong 1,75%: rng 0,018 không chết', () => {
  const start = { ...newPlayer('Phù Tu', 'Nam'), realm: 5, trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  const { p } = applyUsage(start, 1, 10, () => 0.018)
  expect(p.realm).toBe(6)
})

test('quá hạn → EXP về 0 (Luyện Khí Sư giữ 15%), giữ bậc, đánh dấu trượt', () => {
  const start = { ...newPlayer('Luyện Khí Sư', 'Nam'), realm: 3, exp: need(3), trib: { startedAt: 0, deadline: 100, required: 500, earned: 100 } }
  const late = settle(start, 100)
  expect(late.events).toEqual(['tribulation-failed'])
  expect(late.p.exp).toBe(Math.floor(need(3) * 0.15))
  expect(late.p.failedLast).toBe(true)
})

test('pháp bảo rơi khi lên đại cảnh giới mới (bậc 3 → 4), không rơi khi lên tiểu kỳ', () => {
  const to4 = { ...newPlayer('Thể Tu', 'Nam'), realm: 3, trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  expect(applyUsage(to4, 1, 1, seq(0.5, 0.1, 0)).p.artifacts.length).toBe(1)
  const to3 = { ...newPlayer('Thể Tu', 'Nam'), realm: 2, trib: { startedAt: 0, deadline: 999, required: 1, earned: 0 } }
  expect(applyUsage(to3, 1, 1, seq(0.5, 0.1, 0)).p.artifacts.length).toBe(0)
})

test('bậc tối đa không thay đổi', () => {
  const top = { ...newPlayer('Thể Tu', 'Nam'), realm: REALM_COUNT }
  expect(applyUsage(top, 1_000_000, 0, never).events).toEqual([])
})

test('trần bonus pháp bảo', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), artifacts: Array(10).fill('e') as any }
  expect(effects(p).expMult).toBeCloseTo(1.015, 5)
})
```

- [ ] **Step 2: Chạy test, xác nhận lỗi** — `claude plugin test .` → FAIL (chưa có rules.ts).

- [ ] **Step 3: Viết `hooks/rules.ts`**

```ts
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

export type Artifact = 'e' | 't' | 'd'
export type Player = {
  realm: number; exp: number; pending: number; cls: string; gender: string
  artifacts: Artifact[]; failedLast?: boolean
  trib?: { startedAt: number; deadline: number; required: number; earned: number }
}
export type Event = 'breakthrough' | 'tribulation-started' | 'tribulation-failed' | 'death' | 'artifact'

export const need = (realm: number) => NEED[realm - 1]
export const trib = (realm: number) => Math.round(PEAK_TOKENS_PER_DAY * (0.1 + (0.7 * (realm - 1)) / 31))
export const newPlayer = (cls: string, gender: string): Player => ({ realm: 1, exp: 0, pending: 0, cls, gender, artifacts: [] })

// Hiệu lực tổng hợp: bonus lớp + pháp bảo, đã áp trần (spec mục 5).
export function effects(p: Player) {
  const m = CLASS_MODS[p.cls] ?? {}
  const count = (k: Artifact) => p.artifacts.filter(a => a === k).length
  return {
    expMult: (m.expMult ?? 1) + Math.min(count('e') * 0.005, 0.015),
    tribMult: (m.tribMult ?? 1) * (1 - Math.min(count('t') * 0.01, 0.025)),
    deathChance: Math.max(0, (m.deathChance ?? DEATH_CHANCE) - Math.min(count('d') * 0.0005, 0.0015)),
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

export function applyUsage(p0: Player, tokens: number, now: number, rng: () => number): { p: Player; events: Event[] } {
  const s = settle(p0, now)
  let p = s.p
  const events = [...s.events]
  if (p.realm >= REALM_COUNT) return { p, events }
  const m = effects(p)

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
```

- [ ] **Step 4: Chạy test** — `claude plugin test .` → PASS (toàn bộ test trong rules.test.ts).
- [ ] **Step 5: Commit** — `git add hooks/rules.ts hooks/rules.test.ts && git commit -m "feat: cultivation rules with classes, artifacts and windows"` (kèm hai dòng Co-Authored-By và Claude-Session như đã dùng ở commit trước).

---

### Task 2: Tâm ma (`hooks/tamma.ts`)

**Files:** Create `hooks/tamma.ts`, `hooks/tamma.test.ts`.

**Interfaces:**
- Consumes: `Player` (Task 1).
- Produces: `tammaChance(state)`, `exorcismRequired(dailyTokens)`, `applyFailedExorcism(p, now)`, `TAMMA_CAP` (theo spec 27.1).

- [ ] **Step 1: Test**

```ts
// hooks/tamma.test.ts
import { expect, test } from 'claude-code/testing'
import { tammaChance, exorcismRequired, applyFailedExorcism } from './tamma'
import { newPlayer, need } from './rules'

test('xác suất theo trạng thái', () => {
  const base = newPlayer('Thể Tu', 'Nam')
  expect(tammaChance(base, 0, 0)).toBe(0.02)
  const inTrib = { ...base, trib: { startedAt: 0, deadline: 100, required: 1, earned: 0 } }
  expect(tammaChance(inTrib, 50, 0)).toBe(0.10)
  expect(tammaChance(inTrib, 90, 0)).toBe(0.20)
})

test('ngưỡng xua đuổi = 90% token trung bình 2 giờ', () => {
  expect(exorcismRequired(12_000_000)).toBe(Math.round(0.9 * 12_000_000 / 12))
})

test('thất bại khi đang thiên phạt: mất 2% token đã góp, không mất EXP', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: need(1), trib: { startedAt: 0, deadline: 100, required: 1000, earned: 500 } }
  const out = applyFailedExorcism(p, 10)
  expect(out.trib!.earned).toBe(500 - Math.round(500 * 0.02))
  expect(out.exp).toBe(need(1))
})

test('thất bại khi không thiên phạt: mất 0,5% ngưỡng EXP', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: 5000 }
  const out = applyFailedExorcism(p, 10)
  expect(out.exp).toBe(5000 - Math.round(need(1) * 0.005))
})

test('tối đa một hình phạt mỗi ngày', () => {
  const p = { ...newPlayer('Thể Tu', 'Nam'), exp: 5000 }
  const once = applyFailedExorcism(p, 10)
  const twice = applyFailedExorcism({ ...once, lastPenaltyAt: 10 } as any, 20)
  expect(twice.exp).toBe(once.exp)
})
```

- [ ] **Step 2: Chạy test → FAIL.**

- [ ] **Step 3: `hooks/tamma.ts`**

```ts
import { need, type Player } from './rules'
const DAY = 86_400_000
export function tammaChance(p: Player, now: number, _start: number): number {
  if (!p.trib) return 0.02
  const left = p.trib.deadline - now
  return left <= 0.25 * (p.trib.deadline - p.trib.startedAt) ? 0.20 : 0.10
}
export const exorcismRequired = (dailyTokens: number) => Math.round((0.9 * dailyTokens) / 12)
export function applyFailedExorcism(p: Player & { lastPenaltyAt?: number }, now: number): Player & { lastPenaltyAt?: number } {
  if (p.lastPenaltyAt !== undefined && Math.floor(now / DAY) === Math.floor(p.lastPenaltyAt / DAY)) return p
  if (p.trib) {
    const lost = Math.round(p.trib.earned * 0.02)
    return { ...p, lastPenaltyAt: now, trib: { ...p.trib, earned: p.trib.earned - lost } }
  }
  return { ...p, lastPenaltyAt: now, exp: Math.max(0, p.exp - Math.round(need(p.realm) * 0.005)) }
}
```

- [ ] **Step 4: Chạy test → PASS.**
- [ ] **Step 5: Commit** — `feat: tâm ma probability and exorcism penalty`.

---

### Task 3: Hiển thị phần trăm (`hooks/display.ts`)

**Files:** Create `hooks/display.ts`, `hooks/display.test.ts`.

**Interfaces:** Consumes `Player`, `REALM_NAMES`, `need`, `trib`. Produces `percentExp(p)`, `percentTrib(p, now)`, `timeLeft(p, now)`, `statusText(p, now)`, `barColor(p, now)` (xanh/vàng/đỏ/xám theo spec 19.2).

- [ ] **Step 1: Test** — kiểm tra: `percentExp` của bậc 1 với exp = một nửa → 50; `timeLeft` 2 ngày 5 giờ → "2 ngày 5 giờ"; `timeLeft` 45 phút → "45 phút"; `statusText` không chứa dấu số EXP (không có `/`); `barColor` đỏ khi còn dưới 1 giờ; vàng khi còn dưới 12 giờ; xanh khi đang tu.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Viết `display.ts`** — các hàm thuần, không dùng số liệu thô trong chuỗi; `timeLeft` làm tròn xuống, dạng "N ngày M giờ" / "N giờ" / "N phút".
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — `feat: percent-only display helpers`.

---

### Task 4: Server Worker + Durable Objects (`server/`)

**Files:** Create `server/package.json`, `server/wrangler.toml`, `server/tsconfig.json`, `server/src/index.ts`, `server/src/player.ts`, `server/src/roster.ts`, `server/src/player.test.ts`.

**Interfaces:**
- Consumes: `applyUsage`, `settle`, `newPlayer`, `effects`, `Player`, `CLASSES`, `GENDERS` từ `../../hooks/rules`; `applyFailedExorcism` từ `../../hooks/tamma`.
- Produces routes (spec mục 3): `POST /register {name, cls, gender}` → `{key}` (409 nếu trùng); `POST /usage {turnId, tokens}` (Bearer) → `{player, events}` (bỏ qua `turnId` đã dùng); `POST /appearance {cls, gender}`; `POST /reset {cls, gender}` (giữ tên, khóa, tổng token, số lần reset); `GET /me`; `GET /leaderboard?board=tu-vi|chamchi|tuan|phoenix|phapbao`.

- [ ] **Step 1: Test** `player.test.ts` — dùng hàm thuần trích từ `player.ts` (`handleUsage(st, body, now, rng)`), kiểm tra: `turnId` trùng không cộng; tổng token trọn đời tăng; tuần: cửa sổ 7 ngày; reset giữ tổng và tăng `resets`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Viết** `player.ts` (DO với state gồm `player`, `keyHash`, `seen`, `lifetimeTokens`, `weekTokens` map ngày→token, `deaths`, `resets`, `name`), `roster.ts` (ảnh chụp, sắp theo 5 bảng), `index.ts` (router, xác thực bằng SHA-256 của khóa, `CLASSES`/`GENDERS` kiểm tra đầu vào, tên khớp `^[\p{L}\p{N}_-]{1,24}$`).
- [ ] **Step 4: Chạy test → PASS.** Chạy `cd server && npx wrangler dev` và `curl` kiểm tra đăng ký (201/`{key}`), `/usage` lần hai cùng `turnId` (`duplicate:true`), sai khóa (401). **Dừng:** không deploy.
- [ ] **Step 5: Commit** — `feat: cultivation server (Worker + Durable Objects)`.

---

### Task 5: Mod client: gửi lượt, hàng đợi, tâm ma (`hooks/api.ts`, `hooks/usage.ts`)

**Files:** Create `hooks/api.ts`, `hooks/usage.ts`, `hooks/usage.test.ts`; modify `hooks/hooks.json`.

**Interfaces:**
- Consumes: `$.http.fetch(url, {method, headers, body})` → `{status, ok, headers, text}`; `$.store.get/set`; `turn.complete` có `turnId` và `usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`); `tammaChance`, `applyFailedExorcism` (Task 2).
- Produces: `countTokens(usage)`, `callServer($, path, body?)`, `QUEUE_LIMIT=500`, `flush($)`, và hook `turn.complete` đưa lượt vào hàng đợi; hook `session.start` gọi `flush`.

- [ ] **Step 1: Test** — `countTokens(undefined)=0`; cache read không tính; `flush` với mock HTTP: lỗi mạng giữ lại trong hàng đợi, 200 xóa khỏi hàng đợi, 4xx cố định bỏ đi; hàng đợi vượt 500 thì bỏ lượt cũ nhất.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Viết** `api.ts` (`SERVER` là hằng số có placeholder rõ ràng `TUTIEN_SERVER_URL`, đọc từ `pluginConfigs` nếu có) và `usage.ts`.
- [ ] **Step 4: PASS.** `claude plugin test .`
- [ ] **Step 5: Thêm `./usage.ts` vào `hooks/hooks.json`** và commit — `feat: send turn usage with offline queue`.

---

### Task 6: Lệnh `/tutien` (`hooks/register.ts`)

**Files:** Modify `hooks/register.ts` (giữ `update`); create `hooks/commands.ts` (thuần, dễ test), `hooks/commands.test.ts`.

**Interfaces:**
- Consumes: `statusText`, `barColor` (Task 3); `callServer` (Task 5); `CLASSES`, `GENDERS`, `REALM_NAMES` (Task 1); `LINES`, `pickLine` (lines.ts đã có); `CHAPTERS` (story.ts).
- Produces: nhánh con `register <tên> <lớp> <giới>`, `appearance <lớp> <giới>`, `reset confirm <lớp> <giới>` (không `confirm` chỉ cảnh báo), `status|s`, `top|t` (in cả 5 bảng, tối đa 10 dòng mỗi bảng + hạng của bạn), `history|h`, `tim <tên>`, `thu-vien`, `bicanh`, `help`, `truyen`, `update` (đã có).

- [ ] **Step 1: Test** — phân tích tham số (`parseCommand('register thang "Kiếm Tu" Nam')`), thông báo khi thiếu tham số, `formatTop(rows)` tối đa 10 dòng và có hạng của mình, `reset` không `confirm` không gọi server.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Viết** `commands.ts` (hàm thuần) và nối vào `register.ts` (`$.command.register` với `argumentHint`).
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — `feat: /tutien commands`.

---

### Task 7: Pane nhân vật và hiệu ứng (`hooks/pane.tsx`, `hooks/effects.ts`)

**Files:** Create `hooks/effects.ts` (thuần: bước chữ `typeStep(full, index, reduced)`, hẹn giờ theo dấu câu, chọn khung hào quang `auraFrame(tick)`), `hooks/effects.test.ts`, `hooks/pane.tsx`, `hooks/pane.test.tsx`; sửa `hooks/hooks.json`.

**Interfaces:**
- Consumes: `statusText`, `barColor` (Task 3); `realmImage(root, p, frame)` → `assets/realms/<cls>/<gender>/NN-F.png`; `pickLine`; `Image` của `$.ui.resolve(e)` với `{file, format:'png'}`, `columns:24`, `rows:12`, `alt`.
- Produces: pane `tu-tien`; hiệu ứng thiên phạt (chớp sét, lóe vàng, tối mưa) theo spec 14; lời thoại chạy chữ theo spec 19.7; hào quang 3 khung đổi mỗi 400 ms; toast đột phá, trượt, chết.

- [ ] **Step 1: Test** — `typeStep` trả đúng số ký tự và dừng 400 ms sau dấu chấm; `reduced=true` hiện hết; `auraFrame` vòng 1→2→3→1.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Viết** `effects.ts`, rồi `pane.tsx` (ảnh bằng `Image`, thanh tiến độ bằng `Box`/`Text`, dòng trạng thái cố định, nút chuyển bảng bằng `Button`).
- [ ] **Step 4: `claude plugin test .` và `claude plugin validate .` → PASS.** Dùng `$.ui.mount` trên `terminal` để kiểm tra có `Image` đúng bậc.
- [ ] **Step 5: Commit** — `feat: cultivation pane with effects`.

---

### Task 8: Ảnh nhân vật (`scripts/gen_realms.py`)

**Files:** Create `scripts/gen_realms.py`, `scripts/test_gen_realms.py`; sinh `assets/realms/<lớp>/<giới>/NN-F.png` (1.386 file).

**Interfaces:** Consumes `CLASSES`, `GENDERS` (thứ tự khớp rules.ts). Produces đúng đường dẫn `NN-F.png`, F ∈ {1,2,3}, kích thước 96×96.

- [ ] **Step 1: Test** — số file đúng 1.386; kích thước 96×96; deterministic (cùng seed → cùng bytes); khác lớp → khác bảng màu; bậc ≥25 có tia sét.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Viết script** (tham khảo khung đã có trong lịch sử), thêm 3 khung hào quang.
- [ ] **Step 4: Chạy** `python3 scripts/gen_realms.py` → `find assets/realms -name '*.png' | wc -l` = `1386`; tổng dung lượng `du -sh assets/realms` phải dưới 30 MB; báo cáo cho bạn xem mẫu.
- [ ] **Step 5: Commit** — `feat: generate 1386 realm portraits`. Dừng để bạn duyệt mẫu hình trước khi commit ảnh (ghi vào ledger).

---

### Task 9: Persona, cốt truyện, bảng xếp hạng toàn cục

**Files:** Create `hooks/persona.ts`, `hooks/persona.test.ts`; sửa `hooks/story.ts` nếu cần (đã có).

**Interfaces:** Consumes `LINES`; `$.model.complete` cho persona tự nhập (spec 17). Produces `PERSONAS` (7 cái, mỗi cái câu cửa miệng và thoại), `pickPersonaLine(persona, seed)` (xen 50% với thoại chung), `buildPersonaPrompt(desc)` (≤200 ký tự, trả về đúng 15 câu, dưới 120 ký tự mỗi câu).

- [ ] **Step 1: Test** — 7 persona đủ trường; prompt cắt ở 200 ký tự; hàm phân tích phản hồi model bỏ dòng rỗng và cắt câu dài.
- [ ] **Step 2: FAIL.** **Step 3: Viết.** **Step 4: PASS.**
- [ ] **Step 5: Commit** — `feat: persona and story wiring`.

---

### Task 10: Chống gian lận cơ bản (`hooks/guard.ts`, server)

**Files:** Create `hooks/guard.ts`, `hooks/guard.test.ts`; sửa `server/src/player.ts`.

**Interfaces:** Produces `checkTurn(tokens)` (trần 5.000.000 mỗi lượt), `checkHour(sum)` (10.000.000), `checkDay(sum)` (40.000.000), `suspicion(history)` (điểm: đột biến ×5, lượt giống hệt liên tiếp ≥5, lượt cùng mili giây). Server từ 10 điểm ẩn khỏi bảng.

- [ ] **Step 1–5** như các task trên; commit — `feat: anti-cheat limits and suspicion score`.

---

### Task 11: Review cuối và sửa (theo executing-plans)

- [ ] **Step 1: Đóng gói** `../subagent-driven-development/scripts/review-package` với `MERGE_BASE` là `b59f8b1`.
- [ ] **Step 2: Tự review** (không có subagent). Ghi `Final review: self-review (no subagent tool)` vào ledger.
- [ ] **Step 3: Sửa Critical và Important** theo TDD; ghi ledger.
- [ ] **Step 4: Liệt kê** `Rulings I made` và `Deferred minors` trong thông điệp cuối.

## Self-Review

- Độ phủ spec: luật (Task 1, 2), hiển thị phần trăm (Task 3), server (Task 4), mod gửi lượt (Task 5), lệnh (Task 6), pane và hiệu ứng (Task 7), ảnh (Task 8), persona và truyện (Task 9), chống gian lận (Task 10).
- Chưa có trong phạm vi giai đoạn 1: tông môn, đồng hành, đạo lữ, đan dược, bí cảnh, nhiệm vụ ngày, thành tựu, lịch sử, bế quan, sự kiện, tháp, trang web (mục 18, 20, 25, 26). Đây là giai đoạn 2.
- Mô phỏng cân bằng (mục 23, 28) chưa chuyển thành `scripts/balance.ts` trong giai đoạn này; ghi là việc còn lại.
