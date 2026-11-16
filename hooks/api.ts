// hooks/api.ts — gọi server kèm khóa và phiên bản mod (spec 21.5). Lỗi 426 báo cần cập nhật.
export const SERVER = 'https://tutien.thang-vo.workers.dev'

type Store = { get: (k: string) => Promise<unknown> }
type Clock = { after: (ms: number, fn: () => void) => { cancel?: () => void } | void }
const TIMEOUT_MS = 15_000
type Http = { fetch: (url: string, init?: any) => Promise<{ status: number; ok: boolean; headers: Record<string, string>; text: string }> }

export async function callServer<T = any>(
  $: { store: Store; http: Http; clock: Clock },
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; upgrade?: boolean; data?: T; error?: string }> {
  const [name, key, version, account] = (await Promise.all(
    ['tutien.name', 'tutien.key', 'tutien.version', 'tutien.account'].map(k => $.store.get(k)),
  )) as (string | undefined)[]
  if (!name || !key) return { ok: false, status: 0 }
  // $.http.fetch không có timeout: một yêu cầu treo sẽ chặn cả chuỗi gửi EXP nối tiếp (usage.ts).
  // Host không có đồng hồ: bỏ timeout, vẫn gọi server bình thường.
  let timer: { cancel?: () => void } | undefined
  const expire = new Promise<null>(r => { try { timer = $.clock.after(TIMEOUT_MS, () => r(null)) } catch { /* không có đồng hồ */ } })
  const res = await Promise.race([$.http.fetch(`${SERVER}${path}?name=${encodeURIComponent(name)}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'x-tutien-version': version ?? '',
      'x-tutien-account': account ?? '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), expire]).finally(() => timer?.cancel?.())
  if (!res) return { ok: false, status: 504, error: '☁️ Server không phản hồi, thử lại sau.' }
  if (res.status === 426) return { ok: false, status: 426, upgrade: true }
  if (!res.ok) {
    let error: string | undefined
    try { error = (JSON.parse(res.text) as { error?: string }).error } catch { /* không phải JSON */ }
    return { ok: false, status: res.status, error }
  }
  try {
    return { ok: true, status: res.status, data: JSON.parse(res.text) as T }
  } catch {
    return { ok: false, status: 502, error: 'Server trả về dữ liệu không đọc được.' }
  }
}

export const countTokens = (u?: { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number }) =>
  u ? (Number(u.input_tokens) || 0) + (Number(u.output_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0) : 0

// Mã tài khoản Claude từ ~/.claude.json (oauthAccount.accountUuid). Chỉ gửi mã này, không gửi email.
export function accountFromConfig(text: string): string {
  try {
    const id = (JSON.parse(text) as { oauthAccount?: { accountUuid?: unknown } }).oauthAccount?.accountUuid
    return typeof id === 'string' && /^[0-9a-f-]{16,64}$/i.test(id) ? id : ''
  } catch {
    return ''
  }
}
