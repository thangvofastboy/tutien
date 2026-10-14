// hooks/settings.ts — các mục trong pane Cài đặt (/tutien setting). Giá trị lưu ở $.store theo key.
import { PERSONAS } from './persona'

export type Setting = { key: string; label: string; options: { value: string; label: string }[]; default: string }

const onOff = [{ value: 'on', label: 'Bật' }, { value: 'off', label: 'Tắt' }]

export const SETTINGS: Setting[] = [
  { key: 'tutien.display', label: 'Cách vẽ nhân vật', default: 'raster',
    options: [{ value: 'raster', label: 'Ô màu (mọi terminal)' }, { value: 'image', label: 'Ảnh (kitty, WezTerm)' }, { value: 'text', label: 'Chỉ chữ' }] },
  { key: 'tutien.statusline', label: 'Dòng trạng thái dưới ô nhập', default: 'on', options: onOff },
  { key: 'tutien.band', label: 'Khung nhỏ phía trên ô nhập', default: 'on', options: onOff },
  { key: 'tutien.claudePersona', label: 'Claude nói theo tính cách nhân vật', default: 'off', options: onOff },
  { key: 'tutien.chatlines', label: 'Lời chào và thông báo trong khung chat', default: 'on', options: onOff },
  { key: 'tutien.effects', label: 'Hiệu ứng thiên phạt và hào quang', default: 'on', options: onOff },
  { key: 'tutien.panelbg', label: 'Màu nền panel nhân vật', default: 'terminal',
    options: [{ value: 'terminal', label: 'Theo terminal' }, { value: 'ink', label: 'Mực đen' }, { value: 'navy', label: 'Xanh đêm' }, { value: 'jade', label: 'Ngọc lục' }, { value: 'paper', label: 'Giấy vàng' }] },
  { key: 'tutien.theme', label: 'Theme màu chữ', default: 'mac-dinh',
    options: [{ value: 'mac-dinh', label: 'Mặc định' }, { value: 'kim-dan', label: 'Kim Đan' }, { value: 'bang-tam', label: 'Băng Tâm' }, { value: 'huyet-sat', label: 'Huyết Sát' }, { value: 'thanh-moc', label: 'Thanh Mộc' }, { value: 'tu-vi', label: 'Tử Vi' }] },
  { key: 'tutien.textsize', label: 'Cỡ chữ trong panel (Desktop, web, điện thoại)', default: 'vua',
    options: [{ value: 'nho', label: 'Nhỏ' }, { value: 'vua', label: 'Vừa' }, { value: 'lon', label: 'Lớn' }] },
  { key: 'tutien.autoupdate', label: 'Tự cập nhật khi mở Claude Code', default: 'off', options: onOff },
  { key: 'tutien.persona', label: 'Tính cách nhân vật', default: 'none',
    options: [{ value: 'none', label: 'Không' }, ...PERSONAS.map(p => ({ value: p.id, label: p.name }))] },
]

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
