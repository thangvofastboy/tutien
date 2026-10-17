// hooks/settings.ts — các mục trong pane Cài đặt (/tutien setting). Giá trị lưu ở $.store theo key.
import { PERSONAS } from './persona'

export type Setting = { key: string; label: string; options: { value: string; label: string; icon?: string }[]; default: string; icon: string; color: string }

const onOff = [{ value: 'on', label: 'Bật', icon: '🟢' }, { value: 'off', label: 'Tắt', icon: '⚫' }]

export const SETTINGS: Setting[] = [
  { key: 'tutien.display', icon: '🎨', color: '#79c0ff', label: 'Cách vẽ nhân vật', default: 'raster',
    options: [{ value: 'raster', label: 'Ô màu (mọi terminal)', icon: '🟦' }, { value: 'image', label: 'Ảnh (kitty, WezTerm)', icon: '🖼️' }, { value: 'text', label: 'Chỉ chữ', icon: '🔤' }] },
  { key: 'tutien.artsize', icon: '🔍', color: '#56d4dd', label: 'Cỡ ảnh nhân vật (Desktop, điện thoại)', default: 'vua',
    options: [{ value: 'vua', label: 'Vừa', icon: '🔹' }, { value: 'lon', label: 'Lớn', icon: '🔷' }, { value: 'to', label: 'Rất lớn', icon: '🔶' }] },
  { key: 'tutien.artsmooth', icon: '🪄', color: '#d2a8ff', label: 'Làm mịn ảnh khi phóng to (tắt = giữ nét pixel)', default: 'off', options: onOff },
  { key: 'tutien.statusline', icon: '📟', color: '#56d4dd', label: 'Dòng trạng thái dưới ô nhập (có dấu ⚠)', default: 'off', options: onOff },
  { key: 'tutien.band', icon: '🎚️', color: '#a5d6ff', label: 'Khung nhỏ phía trên ô nhập', default: 'on', options: onOff },
  { key: 'tutien.claudePersona', icon: '🎭', color: '#d2a8ff', label: 'Claude nói theo tính cách nhân vật', default: 'off', options: onOff },
  { key: 'tutien.chatlines', icon: '💬', color: '#7ee787', label: 'Lời chào và thông báo trong khung chat', default: 'on', options: onOff },
  { key: 'tutien.effects', icon: '✨', color: '#e3b341', label: 'Hiệu ứng thiên phạt và hào quang', default: 'on', options: onOff },
  { key: 'tutien.panelbg', icon: '🖼️', color: '#ffa657', label: 'Màu nền panel nhân vật', default: 'terminal',
    options: [{ value: 'terminal', label: 'Theo terminal', icon: '💻' }, { value: 'ink', label: 'Mực đen', icon: '⬛' }, { value: 'navy', label: 'Xanh đêm', icon: '🟦' }, { value: 'jade', label: 'Ngọc lục', icon: '🟩' }, { value: 'paper', label: 'Giấy vàng', icon: '🟨' }] },
  { key: 'tutien.theme', icon: '🌈', color: '#f778ba', label: 'Theme màu chữ', default: 'mac-dinh',
    options: [{ value: 'mac-dinh', label: 'Mặc định', icon: '⚪' }, { value: 'kim-dan', label: 'Kim Đan', icon: '🟡' }, { value: 'bang-tam', label: 'Băng Tâm', icon: '🔵' }, { value: 'huyet-sat', label: 'Huyết Sát', icon: '🔴' }, { value: 'thanh-moc', label: 'Thanh Mộc', icon: '🟢' }, { value: 'tu-vi', label: 'Tử Vi', icon: '🟣' }] },
  { key: 'tutien.textsize', icon: '🔠', color: '#4fc3f7', label: 'Cỡ chữ trong panel (Desktop, web, điện thoại)', default: 'vua',
    options: [{ value: 'nho', label: 'Nhỏ', icon: '🔹' }, { value: 'vua', label: 'Vừa', icon: '🔷' }, { value: 'lon', label: 'Lớn', icon: '🔶' }] },
  { key: 'tutien.compact', icon: '📦', color: '#ffd54f', label: 'Chế độ gọn (ẩn nhiệm vụ và bảng xếp hạng trong panel)', default: 'off', options: onOff },
  { key: 'tutien.portrait', icon: '🖼️', color: '#79c0ff', label: 'Ảnh nhân vật trong panel', default: 'on', options: onOff },
  { key: 'tutien.tu', icon: '☯️', color: '#7ee787', label: 'Tu Luyện trong panel', default: 'on', options: onOff },
  { key: 'tutien.quest', icon: '📜', color: '#4fc3f7', label: 'Nhiệm Vụ trong panel', default: 'on', options: onOff },
  { key: 'tutien.board', icon: '🏆', color: '#ffd54f', label: 'Bảng Tu Vi trong panel', default: 'on', options: onOff },
  { key: 'tutien.kyngo', icon: '🎲', color: '#56d4dd', label: 'Kỳ Ngộ trong panel', default: 'on', options: onOff },
  { key: 'tutien.quick', icon: '⚡', color: '#ff7b72', label: 'Nút lệnh nhanh trong panel', default: 'on', options: onOff },
  { key: 'tutien.autoupdate', icon: '🔄', color: '#3fb950', label: 'Tự cập nhật khi mở Claude Code', default: 'off', options: onOff },
  { key: 'tutien.persona', icon: '🧙', color: '#bc8cff', label: 'Tính cách nhân vật', default: 'none',
    options: [{ value: 'none', label: 'Không', icon: '🚫' }, ...PERSONAS.map(p => ({ value: p.id, label: p.name, icon: '🎭' })), { value: 'tuy-chinh', label: 'Tùy chỉnh (đặt bằng /tutien persona tuy-chinh)', icon: '✏️' }] },
]

// Lệnh bấm được trong pane Cài đặt: chỉ lệnh không cần tham số, gom theo nhóm màu.
export type CommandGroup = { title: string; color: string; items: { arg: string; label: string }[] }
export const COMMAND_GROUPS: CommandGroup[] = [
  { title: '📈 Xem', color: '#79c0ff', items: [
    { arg: 'status', label: '📈 Trạng thái' }, { arg: 'top', label: '🏆 Bảng xếp hạng' },
    { arg: 'history', label: '📊 Lịch sử' }, { arg: 'team', label: '👥 Team' }] },
  { title: '📚 Khám phá', color: '#7ee787', items: [
    { arg: 'truyen', label: '📖 Cốt truyện' }, { arg: 'thu-vien', label: '🗃️ Thư viện' },
    { arg: 'bicanh', label: '🌀 Bí cảnh' }, { arg: 'cho', label: '🛒 Chợ' }] },
  { title: '🎲 Cơ Duyên', color: '#56d4dd', items: [
    { arg: 'ky-ngo', label: '🎲 Kỳ ngộ' }, { arg: 'chuoi', label: '🔥 Chuỗi ngày' },
    { arg: 'linh-can', label: '🌈 Linh căn' }, { arg: 'cong-phap', label: '📖 Công pháp' },
    { arg: 'truyen-tuan', label: '📜 Truyện tuần' }] },
  { title: '⚔️ Đồng Môn', color: '#ff7b72', items: [
    { arg: 'luan-dao', label: '⚔️ Luận đạo' }, { arg: 'tong-chien', label: '🏯 Tông chiến' },
    { arg: 'su-do', label: '🧑‍🏫 Sư đồ' }, { arg: 'the', label: '🪪 Thẻ khoe' }] },
  { title: '🚀 Mở', color: '#ffa657', items: [
    { arg: 'panel', label: '🖼️ Panel nhân vật' }, { arg: 'start', label: '🌱 Bắt đầu' },
    { arg: 'web', label: '🌐 Mini web' }, { arg: 'help', label: '❓ Trợ giúp' }] },
]
// Lệnh chỉ mở pane/cửa sổ khác, kết quả không hiện trong thẻ.
export const OPEN_COMMANDS = ['setting', 'panel', 'start']

// Màu nền thật của panel theo lựa chọn; 'terminal' là không tô, nên nền là nền terminal đang dùng.
export const PANEL_BG: Record<string, string | undefined> = {
  terminal: undefined, ink: '#0d1117', navy: '#1e2a44', jade: '#0f2a1f', paper: '#f5f0e1',
}

// Theme màu chữ: tiêu đề, lời thoại, dòng của mình trên bảng xếp hạng. 'mac-dinh' dùng màu theo theme của Claude Code.
export type Theme = { title: string; quote: string; mine: string }
export const THEMES: Record<string, Theme> = {
  'mac-dinh': { title: 'suggestion', quote: 'remember', mine: 'success' },
  'kim-dan': { title: '#e3b341', quote: '#f2cc60', mine: '#ffa657' },
  'bang-tam': { title: '#79c0ff', quote: '#a5d6ff', mine: '#56d4dd' },
  'huyet-sat': { title: '#ff7b72', quote: '#ffa198', mine: '#f778ba' },
  'thanh-moc': { title: '#56d364', quote: '#7ee787', mine: '#3fb950' },
  'tu-vi': { title: '#d2a8ff', quote: '#e2c5ff', mine: '#bc8cff' },
}

// Cỡ chữ: bậc của Text.size cho chữ thường và tiêu đề. Terminal chỉ có một cỡ nên bỏ qua.
export type TextSize = { body: 'footnote' | 'body' | 'heading'; title: 'body' | 'heading' | 'title' }
export const TEXT_SIZES: Record<string, TextSize> = {
  nho: { body: 'footnote', title: 'body' },
  vua: { body: 'body', title: 'heading' },
  lon: { body: 'heading', title: 'title' },
}

export const isValidSetting = (key: string, value: unknown) =>
  SETTINGS.some(s => s.key === key && s.options.some(o => o.value === value))

export function withDefaults(stored: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of SETTINGS) out[s.key] = isValidSetting(s.key, stored[s.key]) ? String(stored[s.key]) : s.default
  return out
}
