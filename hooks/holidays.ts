// hooks/holidays.ts — lịch bí cảnh lễ hội (spec 24.1), theo ngày UTC+7 dạng YYYY-MM-DD.
// Ngày âm lịch (Tết, Giỗ Tổ) cần bảng tra từng năm; năm chưa có trong bảng thì kỳ đó không mở.

export type Holiday = { id: string; name: string; days: string[] }

const FIXED: { key: string; name: string; md: string[] }[] = [
  { key: 'tet-duong', name: 'Tết Dương Lịch', md: ['01-01'] },
  { key: 'giai-phong', name: 'Giải Phóng Miền Nam Và Quốc Tế Lao Động', md: ['04-30', '05-01'] },
  { key: 'bac-ho', name: 'Sinh Nhật Bác Hồ', md: ['05-19'] },
  { key: 'mot-ngay', name: 'Một Ngày Như Mọi Ngày, Mình Thích Thì Mình Mở Thôi', md: ['06-17'] },
  { key: 'thuong-binh', name: 'Ngày Thương Binh Liệt Sĩ', md: ['07-27'] },
  { key: 'quoc-khanh', name: 'Quốc Khánh', md: ['09-01', '09-02'] },
]

// Bảng tra âm lịch (giờ Việt Nam, UTC+7): mùng 1 Tết (5 ngày) và Giỗ Tổ 10/3 âm lịch, theo dương lịch.
// Tính bằng thuật toán âm lịch Hồ Ngọc Đức. Năm 2030 Tết ở Việt Nam là 02-02, sớm hơn Trung Quốc một ngày.
export const LUNAR: Record<number, { tet?: string; gioTo?: string }> = {
  2026: { tet: '2026-02-17', gioTo: '2026-04-26' },
  2027: { tet: '2027-02-06', gioTo: '2027-04-16' },
  2028: { tet: '2028-01-26', gioTo: '2028-04-04' },
  2029: { tet: '2029-02-13', gioTo: '2029-04-23' },
  2030: { tet: '2030-02-02', gioTo: '2030-04-12' },
  2031: { tet: '2031-01-23', gioTo: '2031-04-01' },
  2032: { tet: '2032-02-11', gioTo: '2032-04-19' },
  2033: { tet: '2033-01-31', gioTo: '2033-04-09' },
  2034: { tet: '2034-02-19', gioTo: '2034-04-28' },
  2035: { tet: '2035-02-08', gioTo: '2035-04-17' },
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10)

export function holidaysOf(year: number): Holiday[] {
  const out: Holiday[] = FIXED.map(f => ({ id: `${f.key}-${year}`, name: f.name, days: f.md.map(md => `${year}-${md}`) }))
  const l = LUNAR[year]
  if (l?.tet) out.push({ id: `tet-${year}`, name: 'Tết Nguyên Đán', days: [0, 1, 2, 3, 4].map(n => addDays(l.tet!, n)) })
  if (l?.gioTo) out.push({ id: `gio-to-${year}`, name: 'Giỗ Tổ Hùng Vương', days: [l.gioTo] })
  return out.sort((a, b) => a.days[0].localeCompare(b.days[0]))
}

// Ngày theo giờ Việt Nam (UTC+7), dùng chung cho mọi lịch trong game.
export const vnDay = (now: number) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10)

export const holidayOn = (day: string): Holiday | undefined =>
  holidaysOf(Number(day.slice(0, 4))).find(h => h.days.includes(day))

// Kỳ lễ đang mở hoặc sắp mở trong `withinDays` ngày tới.
export function upcomingHolidays(now: number, withinDays = 30): Holiday[] {
  const today = vnDay(now)
  const until = addDays(today, withinDays)
  const y = Number(today.slice(0, 4))
  return [...holidaysOf(y), ...holidaysOf(y + 1)].filter(h => h.days[h.days.length - 1] >= today && h.days[0] <= until)
}

// Thử thách lễ hội: tổng token trong kỳ ít nhất 3 triệu × số ngày.
export const holidayTarget = (h: Holiday) => 3_000_000 * h.days.length
