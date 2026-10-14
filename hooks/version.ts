// hooks/version.ts — phiên bản đang chạy (gửi kèm mọi request) và tùy chọn tự cập nhật (spec 21.5).
export const parseDescribe = (stdout: string) => stdout.trim()

export function parseAutoUpdate(args: string): 'on' | 'off' | null {
  const v = args.trim()
  return v === 'on' || v === 'off' ? v : null
}
