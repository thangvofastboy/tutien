// hooks/version.ts — phiên bản đang chạy (gửi kèm mọi request) và tùy chọn tự cập nhật (spec 21.5).
export const parseDescribe = (stdout: string) => stdout.trim()

export function parseAutoUpdate(args: string): 'on' | 'off' | null {
  const v = args.trim()
  return v === 'on' || v === 'off' ? v : null
}

// Bản cài từ marketplace là bản chép, không có git: dùng version trong plugin.json (tag = v<version>).
export function versionFromManifest(json: string): string {
  try {
    const v = JSON.parse(json)?.version
    return typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v) ? `v${v}` : ''
  } catch {
    return ''
  }
}
