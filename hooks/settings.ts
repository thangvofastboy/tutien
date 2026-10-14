// hooks/settings.ts — các mục trong pane Cài đặt (/tutien setting). Giá trị lưu ở $.store theo key.
import { PERSONAS } from './persona'

export type Setting = { key: string; label: string; options: { value: string; label: string }[]; default: string }

const onOff = [{ value: 'on', label: 'Bật' }, { value: 'off', label: 'Tắt' }]

export const SETTINGS: Setting[] = [
  { key: 'tutien.display', label: 'Cách vẽ nhân vật', default: 'raster',
    options: [{ value: 'raster', label: 'Ô màu (mọi terminal)' }, { value: 'image', label: 'Ảnh (kitty, WezTerm)' }, { value: 'text', label: 'Chỉ chữ' }] },
  { key: 'tutien.statusline', label: 'Dòng trạng thái dưới ô nhập', default: 'on', options: onOff },
  { key: 'tutien.band', label: 'Khung nhỏ phía trên ô nhập', default: 'on', options: onOff },
  { key: 'tutien.effects', label: 'Hiệu ứng thiên phạt và hào quang', default: 'on', options: onOff },
  { key: 'tutien.autoupdate', label: 'Tự cập nhật khi mở Claude Code', default: 'off', options: onOff },
  { key: 'tutien.persona', label: 'Tính cách nhân vật', default: 'none',
    options: [{ value: 'none', label: 'Không' }, ...PERSONAS.map(p => ({ value: p.id, label: p.name }))] },
]

export const isValidSetting = (key: string, value: unknown) =>
  SETTINGS.some(s => s.key === key && s.options.some(o => o.value === value))

export function withDefaults(stored: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of SETTINGS) out[s.key] = isValidSetting(s.key, stored[s.key]) ? String(stored[s.key]) : s.default
  return out
}
