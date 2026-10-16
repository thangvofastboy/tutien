// server/src/congphap.ts — cây công pháp riêng của từng lớp: 4 công pháp 3 tầng và 1 tuyệt kỹ.
// Tuyệt kỹ mở khi đã tu đủ 6 tầng trong cây của lớp mình. Hàm thuần.
import type { Player } from '../../hooks/rules.ts'

// Hiệu lực mỗi tầng: exp, trib (bớt token thiên phạt), death (bớt tỷ lệ tử vong): ngoài trần pháp bảo.
// kyngo: cộng cơ hội kỳ ngộ. lt: linh thạch thêm mỗi kỳ ngộ có thưởng và mỗi trận luận đạo thắng. duel: sức mạnh luận đạo.
export type Effects = { exp?: number; trib?: number; death?: number; kyngo?: number; lt?: number; duel?: number }
export type Skill = { name: string; icon: string; flavor: string; per: Effects; max: number; ult?: boolean }
export const ULT_NEEDS = 6

export const TREES: Record<string, { school: string; icon: string; color: string; skills: Record<string, Skill> }> = {
  'Kiếm Tu': { school: 'Thục Sơn Kiếm Phái', icon: '⚔️', color: '#79c0ff', skills: {
    'nhat-kiem': { name: 'Nhất Kiếm Phá Bug', icon: '🗡️', flavor: 'Một nhát chém, bug bay đầu, không cần console.log.', per: { exp: 0.003 }, max: 3 },
    'kiem-tam': { name: 'Kiếm Tâm Thông Minh', icon: '🧠', flavor: 'Nhìn đối thủ một giây là biết hắn quên viết test.', per: { duel: 4 }, max: 3 },
    'kiem-khi': { name: 'Kiếm Khí Hộ Thể', icon: '🛡️', flavor: 'Kiếm khí bao quanh người như try/catch bọc ngoài main.', per: { death: 0.0003 }, max: 3 },
    'ngu-kiem': { name: 'Ngự Kiếm Phi Hành', icon: '🛫', flavor: 'Bay khắp giang hồ, cơ duyên tự rơi vào túi.', per: { kyngo: 0.01 }, max: 3 },
    'van-kiem': { name: 'Vạn Kiếm Quy Tông', icon: '🌌', flavor: 'Vạn thanh kiếm hợp nhất, như vạn commit squash thành một.', per: { exp: 0.01, duel: 8 }, max: 1, ult: true },
  } },
  'Đan Sư': { school: 'Dược Vương Cốc', icon: '⚗️', color: '#7ee787', skills: {
    'linh-hoa': { name: 'Linh Hỏa Luyện Đan', icon: '🔥', flavor: 'Lửa vừa đủ, đan không cháy, code không nổ.', per: { trib: 0.01 }, max: 3 },
    'bach-thao': { name: 'Bách Thảo Kinh', icon: '🌿', flavor: 'Thuộc lòng trăm loại thảo dược và trăm loại dependency.', per: { kyngo: 0.01 }, max: 3 },
    'dan-huong': { name: 'Đan Hương Dụ Bảo', icon: '💰', flavor: 'Mùi đan thơm đến mức linh thạch tự bò tới.', per: { lt: 2 }, max: 3 },
    'hoi-xuan': { name: 'Hồi Xuân Thuật', icon: '💚', flavor: 'Hồi sinh cả server đã sập lúc 3 giờ sáng.', per: { death: 0.0003 }, max: 3 },
    'cuu-chuyen': { name: 'Cửu Chuyển Kim Đan', icon: '🟡', flavor: 'Chín lần luyện, một viên đan, thiên kiếp cũng phải nể.', per: { trib: 0.03, exp: 0.005 }, max: 1, ult: true },
  } },
  'Trận Pháp Sư': { school: 'Thiên Cơ Các', icon: '🔯', color: '#d2a8ff', skills: {
    'tu-linh': { name: 'Tụ Linh Trận', icon: '🌀', flavor: 'Gom linh khí bốn phương như gom log từ mười microservice.', per: { exp: 0.003 }, max: 3 },
    'phong-ngu': { name: 'Phòng Ngự Đại Trận', icon: '🛡️', flavor: 'Firewall cấp tiên giới, tâm ma cũng phải xin quyền.', per: { death: 0.0004 }, max: 3 },
    'me-tung': { name: 'Mê Tung Trận', icon: '🌫️', flavor: 'Đối thủ lạc trong trận như lạc trong regex.', per: { duel: 4 }, max: 3 },
    'khon-ma': { name: 'Khốn Ma Trận', icon: '⛓️', flavor: 'Trói thiên phạt lại, bắt nó chờ trong queue.', per: { trib: 0.01 }, max: 3 },
    'chu-thien': { name: 'Chu Thiên Tinh Đấu Đại Trận', icon: '✨', flavor: 'Bày trận bằng cả bầu trời sao, kiến trúc sư cũng phải vỗ tay.', per: { trib: 0.02, death: 0.0005 }, max: 1, ult: true },
  } },
  'Luyện Khí Sư': { school: 'Thần Binh Các', icon: '🔨', color: '#ffa657', skills: {
    'thien-chuy': { name: 'Thiên Chùy Bách Luyện', icon: '🔨', flavor: 'Gõ trăm búa, ra một món, như refactor trăm lần ra một hàm.', per: { lt: 2 }, max: 3 },
    'linh-van': { name: 'Linh Văn Khắc Ấn', icon: '🔣', flavor: 'Khắc phù văn gọn gàng như đặt tên biến tử tế.', per: { exp: 0.003 }, max: 3 },
    'khi-linh': { name: 'Khí Linh Thông Thần', icon: '👻', flavor: 'Pháp bảo có linh hồn, thỉnh thoảng nhắc chỗ có kho báu.', per: { kyngo: 0.01 }, max: 3 },
    'linh-giap': { name: 'Hộ Chủ Linh Giáp', icon: '🧥', flavor: 'Áo giáp tự mặc vào khi thấy chữ "deploy production".', per: { death: 0.0003 }, max: 3 },
    'than-binh': { name: 'Thần Binh Xuất Thế', icon: '🗡️', flavor: 'Thần binh ra lò, trời đất đổi màu, đồng nghiệp xin link repo.', per: { lt: 6, duel: 6 }, max: 1, ult: true },
  } },
  'Phù Tu': { school: 'Long Hổ Sơn', icon: '📜', color: '#f2cc60', skills: {
    'thien-loi': { name: 'Thiên Lôi Phù', icon: '⚡', flavor: 'Dán lên đối thủ, sét đánh trúng như CI đỏ lúc sắp merge.', per: { duel: 4 }, max: 3 },
    'tam-bao': { name: 'Tầm Bảo Phù', icon: '🧭', flavor: 'Lá bùa chỉ đường tới cơ duyên, chính xác hơn Google Maps.', per: { kyngo: 0.015 }, max: 3 },
    'ho-than': { name: 'Hộ Thân Phù', icon: '🧧', flavor: 'Dán trên laptop, bug cũng phải đi đường vòng.', per: { death: 0.0003 }, max: 3 },
    'tu-linh-phu': { name: 'Tụ Linh Phù', icon: '🪄', flavor: 'Hút linh khí vào người như hút cà phê sữa đá.', per: { exp: 0.003 }, max: 3 },
    'van-phu': { name: 'Vạn Phù Triều Tông', icon: '🌠', flavor: 'Vạn lá bùa bay lên trời, cơ duyên rơi xuống như mưa.', per: { kyngo: 0.03, lt: 4 }, max: 1, ult: true },
  } },
  'Thể Tu': { school: 'Kim Cang Tự', icon: '💪', color: '#ff7b72', skills: {
    'dong-bi': { name: 'Đồng Bì Thiết Cốt', icon: '🪨', flavor: 'Da đồng xương sắt, ngồi code 12 tiếng không đau lưng.', per: { death: 0.0004 }, max: 3 },
    'long-tuong': { name: 'Long Tượng Bàn Nhược', icon: '🐘', flavor: 'Sức mười rồng mười voi, push một lần 200 file.', per: { duel: 5 }, max: 3 },
    'toi-cot': { name: 'Luyện Thể Tôi Cốt', icon: '🔥', flavor: 'Tôi luyện thân thể bằng lửa thiên phạt, càng đánh càng cứng.', per: { trib: 0.01 }, max: 3 },
    'khi-huyet': { name: 'Khí Huyết Như Hồng', icon: '🩸', flavor: 'Khí huyết dồi dào, gõ phím nhanh như gió.', per: { exp: 0.003 }, max: 3 },
    'bat-diet': { name: 'Bất Diệt Kim Thân', icon: '🌟', flavor: 'Thân vàng bất hoại, thiên kiếp đánh xong còn xin lỗi.', per: { death: 0.001, trib: 0.02 }, max: 1, ult: true },
  } },
  'Ma Tu': { school: 'Huyết Ma Giáo', icon: '😈', color: '#f778ba', skills: {
    'huyet-ma': { name: 'Huyết Ma Đại Pháp', icon: '🩸', flavor: 'Tu nhanh bất chấp, comment code là thứ của chính đạo.', per: { exp: 0.004 }, max: 3 },
    'thon-phe': { name: 'Thôn Phệ Ma Công', icon: '🌑', flavor: 'Nuốt cả linh thạch lẫn deadline của người khác.', per: { lt: 2 }, max: 3 },
    'ma-anh': { name: 'Ma Ảnh Mê Tung', icon: '👤', flavor: 'Bóng ma lướt qua, đối thủ tưởng mình bị đổi branch.', per: { duel: 5 }, max: 3 },
    'khe-uoc': { name: 'Tâm Ma Khế Ước', icon: '📜', flavor: 'Ký hợp đồng với tâm ma, đổi lấy chút may mắn (điều khoản dài 40 trang).', per: { kyngo: 0.01 }, max: 3 },
    'thien-ma': { name: 'Thiên Ma Giải Thể', icon: '💀', flavor: 'Đốt cháy giới hạn, EXP tăng vọt. Bảo hiểm không chi trả.', per: { exp: 0.012 }, max: 1, ult: true },
  } },
}
const DEFAULT_TREE = TREES['Kiếm Tu']
export const treeOf = (cls: string) => TREES[cls] ?? DEFAULT_TREE

export type CongPhap = { points: number; learned: Record<string, number> }
// Người chơi cũ chưa có công pháp: nhận điểm bằng số lần đã đột phá (bậc hiện tại − 1).
// Công pháp không thuộc cây của lớp hiện tại (đổi lớp, bản cũ) được hoàn điểm.
export function congPhapOf(st: { player: Player; congPhap?: CongPhap }): CongPhap {
  const cp = st.congPhap ?? { points: st.player.realm - 1, learned: {} }
  const skills = treeOf(st.player.cls).skills
  let points = cp.points
  const learned: Record<string, number> = {}
  for (const [id, n] of Object.entries(cp.learned)) {
    if (skills[id]) learned[id] = Math.min(n, skills[id].max)
    else points += n
  }
  return { points, learned }
}
const spentOf = (cp: CongPhap) => Object.values(cp.learned).reduce((a, b) => a + b, 0)

export function cpEffects(st: { player: Player; congPhap?: CongPhap }): Required<Effects> {
  const cp = congPhapOf(st)
  const skills = treeOf(st.player.cls).skills
  const out = { exp: 0, trib: 0, death: 0, kyngo: 0, lt: 0, duel: 0 }
  for (const [id, n] of Object.entries(cp.learned)) {
    for (const [k, v] of Object.entries(skills[id].per) as [keyof Effects, number][]) out[k] += v * n
  }
  return out
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace('.', ',').replace(/,0+$/, '')}%`
export function describe(per: Effects): string {
  const parts: string[] = []
  if (per.exp) parts.push(`+${pct(per.exp)} EXP`)
  if (per.trib) parts.push(`−${pct(per.trib)} token thiên phạt`)
  if (per.death) parts.push(`−${pct(per.death, 2)} tử vong`)
  if (per.kyngo) parts.push(`+${pct(per.kyngo)} cơ hội kỳ ngộ`)
  if (per.lt) parts.push(`+${per.lt} linh thạch mỗi kỳ ngộ, trận thắng`)
  if (per.duel) parts.push(`+${per.duel} sức mạnh luận đạo`)
  return parts.join(', ')
}

// Cây công pháp để hiện cho người chơi.
export function treeView(st: { player: Player; congPhap?: CongPhap }) {
  const t = treeOf(st.player.cls)
  const cp = congPhapOf(st)
  return {
    school: t.school, icon: t.icon, color: t.color, points: cp.points, spent: spentOf(cp), ultNeeds: ULT_NEEDS,
    skills: Object.entries(t.skills).map(([id, s]) => ({ id, name: s.name, icon: s.icon, flavor: s.flavor, desc: describe(s.per), max: s.max, ult: !!s.ult, n: cp.learned[id] ?? 0 })),
  }
}

export function learn(st: { player: Player; congPhap?: CongPhap }, id: string): { congPhap?: CongPhap; error?: string; text?: string } {
  const cp = congPhapOf(st)
  const t = treeOf(st.player.cls)
  const s = t.skills[id]
  if (!s) return { error: `${t.school} không có công pháp "${id}". Xem /tutien cong-phap.` }
  const have = cp.learned[id] ?? 0
  if (have >= s.max) return { error: `${s.icon} ${s.name} đã đại thành. Học nữa là tẩu hỏa nhập ma đó!` }
  if (s.ult && spentOf(cp) < ULT_NEEDS) return { error: `🔒 Tuyệt kỹ ${s.icon} ${s.name} cần tu đủ ${ULT_NEEDS} tầng công pháp khác trước (mới có ${spentOf(cp)}).` }
  if (cp.points < 1) return { error: '📜 Hết điểm công pháp rồi. Đột phá thêm một bậc để nhận điểm.' }
  const text = s.ult
    ? `🌟 TUYỆT KỸ ĐẠI THÀNH: ${s.icon} ${s.name}!\n   ${s.flavor}\n   Thiên địa chấn động, cả ${t.school} cúi đầu.`
    : `📖 Lĩnh ngộ ${s.icon} ${s.name} tầng ${have + 1}/${s.max}!\n   ${s.flavor}`
  return { congPhap: { points: cp.points - 1, learned: { ...cp.learned, [id]: have + 1 } }, text }
}

export const RESET_COST = 20
export function resetCongPhap(st: { player: Player; congPhap?: CongPhap; linhThach?: number }): { congPhap?: CongPhap; linhThach?: number; error?: string; text?: string } {
  const cp = congPhapOf(st)
  const spent = spentOf(cp)
  if (spent === 0) return { error: 'Chưa học công pháp nào, tẩy tủy gì mà tẩy.' }
  if ((st.linhThach ?? 0) < RESET_COST) return { error: `🧪 Tẩy tủy cần ${RESET_COST} linh thạch.` }
  return { congPhap: { points: cp.points + spent, learned: {} }, linhThach: (st.linhThach ?? 0) - RESET_COST, text: `🧪 Tẩy tủy xong! Hoàn lại ${spent} điểm công pháp, kinh mạch sạch bong như repo mới clone.` }
}
