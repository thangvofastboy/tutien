// hooks/commands.ts — phân tích lệnh và định dạng đầu ra (spec 9). Thuần, không gọi mạng.
import { CLASSES, GENDERS } from './rules'

export const HELP = [
  '/tutien register <tên> <lớp> <giới>   ghi danh',
  '/tutien appearance <lớp> <giới>        đổi lớp và giới',
  '/tutien reset confirm <lớp> <giới>     làm lại từ đầu',
  '/tutien status (s)                     bậc, tiến độ, thiên phạt',
  '/tutien top (t)                        mọi bảng xếp hạng',
  '/tutien autoupdate on|off              tự cập nhật khi mở Claude Code',
  '/tutien hienthi image|raster|text      cách vẽ nhân vật trong pane',
  '/tutien persona <tên>                  chọn tính cách nhân vật (giọng nói)',
  '/tutien truyen                         đọc cốt truyện đã mở',
  '/tutien update                         cập nhật bản đã ký mới nhất',
  '/tutien help                           danh sách này',
].join('\n')

// Tách token: chuỗi trong dấu nháy kép là một tham số.
export function tokens(args: string): string[] {
  return [...args.trim().matchAll(/"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2])
}

const isCls = (c: string | undefined): c is (typeof CLASSES)[number] => !!c && (CLASSES as readonly string[]).includes(c)
const isGender = (g: string | undefined): g is (typeof GENDERS)[number] => !!g && (GENDERS as readonly string[]).includes(g)

export function parseRegister(args: string): { name: string; cls: string; gender: string } | null {
  const [name, cls, gender] = tokens(args)
  if (!name || !isCls(cls) || !isGender(gender)) return null
  return { name, cls, gender }
}

export function parseReset(args: string): { confirm: boolean; cls: string | null; gender: string | null } {
  const t = tokens(args)
  const confirm = t[0] === 'confirm'
  const rest = confirm ? t.slice(1) : []
  const [cls, gender] = rest
  return {
    confirm,
    cls: isCls(cls) ? cls : null,
    gender: isGender(gender) ? gender : null,
  }
}

// Bảng công khai: tối đa 10 dòng, và luôn có dòng hạng của người xem (spec 16).
export function formatTop(title: string, rows: { rank: number; name: string; cls: string; realm: number; score: number }[], me: string): string {
  const head = `— ${title} —`
  const lines = rows.slice(0, 10).map(r => `${r.rank}. ${r.name} · ${r.cls} · bậc ${r.realm} · ${r.score}`)
  const mine = rows.find(r => r.name === me)
  if (rows.length === 0) return `${head}\nChưa có ai tu luyện.`
  const footer = mine && mine.rank > 10 ? `\n… bạn đứng hạng ${mine.rank}` : ''
  return [head, ...lines].join('\n') + footer
}
