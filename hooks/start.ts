// hooks/start.ts — luồng /tutien start: câu chuyện rồi từng bước chọn nhân vật (thuần, không gọi mạng).
import { CLASSES, GENDERS } from './rules'
import { PERSONAS } from './persona'

export const STEPS = ['story', 'class', 'gender', 'name', 'persona', 'display', 'confirm'] as const
export type Wizard = { step: number; cls?: string; gender?: string; name?: string; persona?: string; display?: string; done?: boolean }

const NAME = /^[\p{L}\p{N}_-]{1,24}$/u
export const validName = (s: string) => NAME.test(s)

export const initWizard = (): Wizard => ({ step: 0 })

// Đi tiếp một bước với giá trị người chơi vừa chọn; sai thì giữ nguyên bước và trả lỗi.
export function advance(w: Wizard, value: string | null): { w: Wizard; error?: string } {
  const step = STEPS[w.step]
  const next = (patch: Partial<Wizard>) => ({ w: { ...w, ...patch, step: Math.min(w.step + 1, STEPS.length - 1) } })
  switch (step) {
    case 'story': return next({})
    case 'class':
      return (CLASSES as readonly string[]).includes(value ?? '') ? next({ cls: value! }) : { w, error: 'Hãy chọn một lớp trong danh sách.' }
    case 'gender':
      return (GENDERS as readonly string[]).includes(value ?? '') ? next({ gender: value! }) : { w, error: 'Hãy chọn Nam hoặc Nữ.' }
    case 'name':
      return validName((value ?? '').trim()) ? next({ name: value!.trim() }) : { w, error: 'Tên 1–24 ký tự: chữ, số, gạch dưới hoặc gạch ngang, không khoảng trắng.' }
    case 'persona':
      return value === 'none' || PERSONAS.some(p => p.id === value) ? next({ persona: value! }) : { w, error: 'Hãy chọn một tính cách.' }
    case 'display':
      return ['raster', 'image', 'text'].includes(value ?? '') ? next({ display: value! }) : { w, error: 'Hãy chọn cách hiển thị.' }
    default:
      return { w }
  }
}
