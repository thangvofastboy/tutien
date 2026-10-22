// hooks/look.ts — màu và ký tự trang trí dùng chung cho khung, pane và cài đặt. Hàm thuần, không đọc $.

// Màu riêng của 11 đại cảnh giới (mỗi đại cảnh giới 3 bậc), từ lục nhạt của Luyện Khí tới tím của Tiên Đế.
export const REALM_COLORS = [
  '#9ccc65', // Luyện Khí
  '#26a69a', // Trúc Cơ
  '#ffca28', // Kim Đan
  '#ff9800', // Nguyên Anh
  '#ef5350', // Hóa Thần
  '#42a5f5', // Luyện Hư
  '#26c6da', // Hợp Thể
  '#ab47bc', // Đại Thừa
  '#ec407a', // Độ Kiếp
  '#fff176', // Chân Tiên
  '#b388ff', // Tiên Đế
]
export const realmColor = (realm: number) => REALM_COLORS[Math.min(10, Math.max(0, Math.floor((realm - 1) / 3)))]

// Dải màu "tiên khí" cho tiêu đề: mỗi ký tự một màu, chuyển từ vàng sang hồng, tím, lam.
export const AURA = ['#ffd54f', '#ffb74d', '#f06292', '#ba68c8', '#7986cb', '#4fc3f7']
export function gradientRuns(text: string, colors = AURA): { ch: string; color: string }[] {
  const chars = [...text]
  return chars.map((ch, i) => ({ ch, color: colors[Math.floor((i * colors.length) / Math.max(1, chars.length))] }))
}

// Thanh tiến độ mượt: mỗi ô chia 8 phần nên đi đều theo phần trăm. Trả phần đã đầy và phần còn lại riêng để tô hai màu.
const PARTS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
export function meter(pct: number, width = 10): { filled: string; rest: string } {
  const eighths = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width * 8)
  const full = Math.floor(eighths / 8)
  const part = PARTS[eighths % 8]
  const used = full + (part ? 1 : 0)
  return { filled: '█'.repeat(full) + part, rest: '·'.repeat(width - used) }
}

// Màu hạng trên bảng xếp hạng: vàng, bạc, đồng cho ba người đầu.
export const rankColor = (rank: number) => (rank === 1 ? '#ffd700' : rank === 2 ? '#cfd8dc' : rank === 3 ? '#d7a86e' : undefined)

// Băng rôn sự kiện, hiện trong lúc hiệu ứng còn chạy. Chữ hiệu ứng viết hoa chữ cái đầu mỗi từ.
export const EVENT_BANNERS: Record<string, { text: string; color: string }> = {
  gold: { text: '✨ Đột Phá Thành Công ✨', color: '#ffd54f' },
  lightning: { text: '⚡ Thiên Kiếp Giáng Lâm ⚡', color: '#80d8ff' },
  rain: { text: '🌧️ Độ Kiếp Thất Bại', color: '#90a4ae' },
  red: { text: '💀 Thân Tử Đạo Tiêu', color: '#ff5252' },
  tamma: { text: '👹 Tâm Ma Xâm Nhập', color: '#ea80fc' },
  kyngo: { text: '🎲 Kỳ Ngộ Xuất Hiện 🎲', color: '#56d4dd' },
  sparkle: { text: '✨ Cơ Duyên Đã Định ✨', color: '#ffd54f' },
  fire: { text: '🔥 Chuỗi Ngày Rực Lửa 🔥', color: '#ffa657' },
  meteor: { text: '☄️ Thiên Kiếp Đồng Tâm ☄️', color: '#e2c5ff' },
  scroll: { text: '📖 Lĩnh Ngộ Công Pháp 📖', color: '#d2a8ff' },
  ult: { text: '🌟 Tuyệt Kỹ Đại Thành 🌟', color: '#ffd54f' },
  win: { text: '🏆 Luận Đạo Đắc Thắng 🏆', color: '#ffd54f' },
  lose: { text: '🥀 Luận Đạo Thất Thủ', color: '#8b949e' },
  treasure: { text: '🎁 Nhận Được Pháp Bảo 🎁', color: '#f2cc60' },
  badge: { text: '🏅 Thành Tựu Mới 🏅', color: '#ffd54f' },
}

// Trang trí tiên hiệp dùng chung cho thẻ trong pane, cài đặt và wizard.
// Đường kẻ ngắn có hoa văn giữa, vừa mọi bề ngang kể cả điện thoại.
export const ORNAMENT = '━━━━ ❖ ━━━━'
export const ORNAMENT_SOFT = '╌╌╌ ◆ ╌╌╌'

// Chấm tiến trình của wizard: ● đã qua, ◉ bước hiện tại, ○ chưa tới.
export const stepDots = (step: number, total: number) =>
  Array.from({ length: total }, (_, i) => (i < step ? '●' : i === step ? '◉' : '○')).join(' ')

// Trộn hai màu #rrggbb theo t (0 = a, 1 = b); thanh EXP chuyển dần sang màu đại cảnh giới kế tiếp.
export function blend(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map(i => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')).join('')
}
