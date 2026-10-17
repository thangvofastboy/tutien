// server/src/congphap.ts — cây công pháp riêng của từng lớp: 4 công pháp 3 tầng và 1 tuyệt kỹ.
// Tuyệt kỹ mở khi đã tu đủ 6 tầng trong cây của lớp mình. Hàm thuần.
import type { Player } from '../../hooks/rules.ts'

// Hiệu lực mỗi tầng: exp, trib (bớt token thiên phạt), death (bớt tỷ lệ tử vong): ngoài trần pháp bảo.
// kyngo: cộng cơ hội kỳ ngộ. lt: linh thạch thêm mỗi kỳ ngộ có thưởng và mỗi trận luận đạo thắng. duel: sức mạnh luận đạo.
export type Effects = { exp?: number; trib?: number; death?: number; kyngo?: number; lt?: number; duel?: number }
// from: truyện gốc mà tên công pháp, môn phái mượn về (để tỏ lòng hâm mộ, hiệu lực là của game này).
export type Skill = { name: string; from: string; icon: string; flavor: string; per: Effects; max: number; ult?: boolean }
export const ULT_NEEDS = 6

export const TREES: Record<string, { school: string; from: string; icon: string; color: string; skills: Record<string, Skill> }> = {
  'Kiếm Tu': { school: 'Thục Sơn Phái', from: 'Thục Sơn Kiếm Hiệp', icon: '⚔️', color: '#79c0ff', skills: {
    'nhat-kiem': { name: 'Thanh Trúc Phong Vân Kiếm', from: 'Phàm Nhân Tu Tiên', icon: '🎋', flavor: '72 thanh kiếm tre bay quanh người, như 72 tab Chrome không bao giờ đóng.', per: { exp: 0.003 }, max: 3 },
    'kiem-tam': { name: 'Độc Cô Cửu Kiếm', from: 'Tiếu Ngạo Giang Hồ', icon: '🗡️', flavor: 'Vô chiêu thắng hữu chiêu, như code không có spec mà vẫn chạy.', per: { duel: 4 }, max: 3 },
    'kiem-khi': { name: 'Tử Hà Thần Công', from: 'Tiếu Ngạo Giang Hồ', icon: '🟣', flavor: 'Mặt hơi tím lại, nhưng bug không chạm được vào người.', per: { death: 0.0003 }, max: 3 },
    'ngu-kiem': { name: 'Lăng Ba Vi Bộ', from: 'Thiên Long Bát Bộ', icon: '🌊', flavor: 'Bước chân lả lướt né deadline, đi đâu cũng vấp phải cơ duyên.', per: { kyngo: 0.01 }, max: 3 },
    'van-kiem': { name: 'Lục Mạch Thần Kiếm', from: 'Thiên Long Bát Bộ', icon: '🌌', flavor: 'Sáu đường kiếm khí từ đầu ngón tay, lúc linh lúc không, như wifi quán cà phê.', per: { exp: 0.01, duel: 8 }, max: 1, ult: true },
  } },
  'Đan Sư': { school: 'Hoàng Phong Cốc', from: 'Phàm Nhân Tu Tiên', icon: '⚗️', color: '#7ee787', skills: {
    'linh-hoa': { name: 'Thanh Liên Địa Tâm Hỏa', from: 'Đấu Phá Thương Khung', icon: '🔥', flavor: 'Dị hỏa luyện đan, thiên kiếp tới cũng bị nướng chín một nửa.', per: { trib: 0.01 }, max: 3 },
    'bach-thao': { name: 'Chưởng Thiên Bình', from: 'Phàm Nhân Tu Tiên', icon: '🫙', flavor: 'Nhỏ một giọt lục dịch, linh thảo trăm năm chín ngay. Cơ duyên kiểu hack.', per: { kyngo: 0.01 }, max: 3 },
    'dan-huong': { name: 'Trúc Cơ Đan', from: 'Phàm Nhân Tu Tiên', icon: '💊', flavor: 'Luyện Trúc Cơ Đan bán chợ, giàu nhanh hơn chạy dự án outsource.', per: { lt: 2 }, max: 3 },
    'hoi-xuan': { name: 'Trường Xuân Công', from: 'Phàm Nhân Tu Tiên', icon: '🌱', flavor: 'Công pháp nhập môn, chậm mà chắc, sống dai như Hàn lão ma.', per: { death: 0.0003 }, max: 3 },
    'cuu-chuyen': { name: 'Hư Thiên Đỉnh', from: 'Phàm Nhân Tu Tiên', icon: '🏺', flavor: 'Bảo đỉnh cả Loạn Tinh Hải tranh nhau, giờ dùng để luyện đan... và nấu mì.', per: { trib: 0.03, exp: 0.005 }, max: 1, ult: true },
  } },
  'Trận Pháp Sư': { school: 'Thanh Vân Môn', from: 'Tru Tiên', icon: '🔯', color: '#d2a8ff', skills: {
    'tu-linh': { name: 'Thái Cực Huyền Thanh Đạo', from: 'Tru Tiên', icon: '☯️', flavor: 'Ngồi thiền trên Thông Thiên Phong, ngắm mây, đợi CI chạy xong.', per: { exp: 0.003 }, max: 3 },
    'phong-ngu': { name: 'Đại Phạn Bát Nhã', from: 'Tru Tiên', icon: '📿', flavor: 'Phật môn chân pháp, tâm tĩnh như production lúc 3 giờ sáng khi không ai deploy.', per: { death: 0.0004 }, max: 3 },
    'me-tung': { name: 'Phệ Huyết Châu', from: 'Tru Tiên', icon: '🔴', flavor: 'Hạt châu hút máu, đánh đâu thắng đó. Hơi tà một chút, đừng kể với sư phụ.', per: { duel: 4 }, max: 3 },
    'khon-ma': { name: 'Thần Kiếm Ngự Lôi Chân Quyết', from: 'Tru Tiên', icon: '⚡', flavor: 'Gọi sét đánh ngược lên trời, thiên kiếp cũng phải xin hàng.', per: { trib: 0.01 }, max: 3 },
    'chu-thien': { name: 'Tru Tiên Kiếm Trận', from: 'Tru Tiên', icon: '✨', flavor: 'Bảy mạch Thanh Vân hợp lực, một kiếm phá trời, như cả team cùng fix một bug.', per: { trib: 0.02, death: 0.0005 }, max: 1, ult: true },
  } },
  'Luyện Khí Sư': { school: 'Minh Giáo', from: 'Ỷ Thiên Đồ Long Ký', icon: '🔨', color: '#ffa657', skills: {
    'thien-chuy': { name: 'Huyền Thiết Trọng Kiếm', from: 'Thần Điêu Hiệp Lữ', icon: '🗿', flavor: 'Trọng kiếm vô phong, đại xảo bất công. Nặng quá, bán sắt vụn cũng được giá.', per: { lt: 2 }, max: 3 },
    'linh-van': { name: 'Càn Khôn Đại Na Di', from: 'Ỷ Thiên Đồ Long Ký', icon: '🔄', flavor: 'Dời chuyển càn khôn, dời luôn bug sang module của người khác.', per: { exp: 0.003 }, max: 3 },
    'khi-linh': { name: 'Thánh Hỏa Lệnh', from: 'Ỷ Thiên Đồ Long Ký', icon: '🔥', flavor: 'Lệnh bài từ Ba Tư, ai cầm cũng gặp chuyện lạ.', per: { kyngo: 0.01 }, max: 3 },
    'linh-giap': { name: 'Cửu Dương Thần Công', from: 'Ỷ Thiên Đồ Long Ký', icon: '☀️', flavor: 'Nội lực vô tận, bách độc bất xâm, kể cả code review gắt gỏng.', per: { death: 0.0003 }, max: 3 },
    'than-binh': { name: 'Ỷ Thiên Kiếm · Đồ Long Đao', from: 'Ỷ Thiên Đồ Long Ký', icon: '🐉', flavor: 'Võ lâm chí tôn, bảo đao Đồ Long. Ỷ Thiên bất xuất, thùy dữ tranh phong?', per: { lt: 6, duel: 6 }, max: 1, ult: true },
  } },
  'Phù Tu': { school: 'Thất Huyết Đồng', from: 'Quang Âm Chi Ngoại', icon: '📜', color: '#f2cc60', skills: {
    'thien-loi': { name: 'Độc Đan', from: 'Quang Âm Chi Ngoại', icon: '🧪', flavor: 'Kẻ thù còn chưa kịp nói câu "thoại phản diện" đã trúng độc.', per: { duel: 4 }, max: 3 },
    'tam-bao': { name: 'Thần Linh Tàn Diện', from: 'Quang Âm Chi Ngoại', icon: '🌑', flavor: 'Mảnh mặt thần linh treo trên trời, nhìn lâu thì thấy cơ duyên (hoặc phát điên).', per: { kyngo: 0.015 }, max: 3 },
    'ho-than': { name: 'Tử Sắc Thủy Tinh', from: 'Quang Âm Chi Ngoại', icon: '🔮', flavor: 'Viên thủy tinh tím tự chữa thương, tiện hơn bảo hiểm y tế công ty.', per: { death: 0.0003 }, max: 3 },
    'tu-linh-phu': { name: 'Hải Sơn Quyết', from: 'Quang Âm Chi Ngoại', icon: '🏔️', flavor: 'Công pháp nhặt được ở khu ổ chuột, ai ngờ tu nhanh hơn hàng chính hãng.', per: { exp: 0.003 }, max: 3 },
    'van-phu': { name: 'Cấm Chế Chi Đạo', from: 'Tiên Nghịch', icon: '🌠', flavor: 'Vạn đạo cấm chế phủ kín trời đất, như .gitignore của vũ trụ.', per: { kyngo: 0.03, lt: 4 }, max: 1, ult: true },
  } },
  'Thể Tu': { school: 'Tàn Lão Thôn', from: 'Mục Thần Ký', icon: '💪', color: '#ff7b72', skills: {
    'dong-bi': { name: 'Bá Thể Tam Đan Công', from: 'Mục Thần Ký', icon: '🪨', flavor: 'Ba đan điền cùng luyện, đánh mãi không chết, như process zombie.', per: { death: 0.0004 }, max: 3 },
    'long-tuong': { name: 'Hàng Long Thập Bát Chưởng', from: 'Anh Hùng Xạ Điêu', icon: '🐲', flavor: 'Mười tám chưởng, chưởng nào cũng có rồng. Chiêu cuối tên là "Kháng Long Hữu Hối".', per: { duel: 5 }, max: 3 },
    'toi-cot': { name: 'Kim Chung Tráo', from: 'Thiếu Lâm', icon: '🔔', flavor: 'Chuông vàng úp lên người, thiên kiếp đánh vào chỉ nghe "boong".', per: { trib: 0.01 }, max: 3 },
    'khi-huyet': { name: 'Long Tượng Bát Nhã Công', from: 'Thần Điêu Hiệp Lữ', icon: '🐘', flavor: 'Sức mười rồng mười voi, push một lần 200 file.', per: { exp: 0.003 }, max: 3 },
    'bat-diet': { name: 'Hoang Cổ Thánh Thể', from: 'Già Thiên', icon: '🌟', flavor: 'Thể chất vạn cổ hiếm có, thiên kiếp đánh xong còn xin chữ ký.', per: { death: 0.001, trib: 0.02 }, max: 1, ult: true },
  } },
  'Ma Tu': { school: 'Nhật Nguyệt Thần Giáo', from: 'Tiếu Ngạo Giang Hồ', icon: '😈', color: '#f778ba', skills: {
    'huyet-ma': { name: 'Hấp Tinh Đại Pháp', from: 'Tiếu Ngạo Giang Hồ', icon: '🌀', flavor: 'Hút công lực người khác, như copy code từ Stack Overflow không ghi nguồn.', per: { exp: 0.004 }, max: 3 },
    'thon-phe': { name: 'Hóa Công Đại Pháp', from: 'Thiên Long Bát Bộ', icon: '🫗', flavor: 'Làm tan công lực đối thủ, tiện tay nhặt luôn linh thạch rơi.', per: { lt: 2 }, max: 3 },
    'ma-anh': { name: 'Cửu Âm Bạch Cốt Trảo', from: 'Anh Hùng Xạ Điêu', icon: '🦴', flavor: 'Năm ngón tay xuyên đá, xuyên luôn cả firewall.', per: { duel: 5 }, max: 3 },
    'khe-uoc': { name: 'Quỳ Hoa Bảo Điển', from: 'Tiếu Ngạo Giang Hồ', icon: '🌻', flavor: 'Muốn luyện thần công, trước hết phải... thôi, đừng hỏi. Cơ duyên nào cũng có giá.', per: { kyngo: 0.01 }, max: 3 },
    'thien-ma': { name: 'Đại Dục Thiên Ma Kinh', from: 'Mục Thần Ký', icon: '💀', flavor: 'Ma kinh tối thượng, EXP tăng vọt. Bảo hiểm không chi trả.', per: { exp: 0.012 }, max: 1, ult: true },
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
    school: t.school, schoolFrom: t.from, icon: t.icon, color: t.color, points: cp.points, spent: spentOf(cp), ultNeeds: ULT_NEEDS,
    skills: Object.entries(t.skills).map(([id, s]) => ({ id, name: s.name, from: s.from, icon: s.icon, flavor: s.flavor, desc: describe(s.per), max: s.max, ult: !!s.ult, n: cp.learned[id] ?? 0 })),
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
    ? `🌟 TUYỆT KỸ ĐẠI THÀNH: ${s.icon} ${s.name}!\n   📚 ${s.from}\n   ${s.flavor}\n   Thiên địa chấn động, cả ${t.school} cúi đầu.`
    : `📖 Lĩnh ngộ ${s.icon} ${s.name} tầng ${have + 1}/${s.max}!\n   📚 ${s.from}\n   ${s.flavor}`
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
