// hooks/api.ts — gọi server kèm khóa và phiên bản mod (spec 21.5). Lỗi 426 báo cần cập nhật.
export const SERVER = 'https://tutien.example.workers.dev' // thay bằng URL thật sau khi deploy

type Store = { get: (k: string) => Promise<unknown> }
type Http = { fetch: (url: string, init?: any) => Promise<{ status: number; ok: boolean; headers: Record<string, string>; text: string }> }

export async function callServer<T = any>(
  $: { store: Store; http: Http },
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; upgrade?: boolean; data?: T }> {
  const name = (await $.store.get('tutien.name')) as string | undefined
  const key = (await $.store.get('tutien.key')) as string | undefined
  const version = ((await $.store.get('tutien.version')) as string | undefined) ?? ''
  if (!name || !key) return { ok: false, status: 0 }
  const res = await $.http.fetch(`${SERVER}${path}?name=${encodeURIComponent(name)}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'x-tutien-version': version,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 426) return { ok: false, status: 426, upgrade: true }
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true, status: res.status, data: JSON.parse(res.text) as T }
}

export const countTokens = (u?: { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number }) =>
  u ? u.input_tokens + u.output_tokens + u.cache_creation_input_tokens : 0
