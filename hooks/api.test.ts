import { expect, test } from 'claude-code/testing'
import { callServer } from './api'

const store = (vals: Record<string, unknown>) => ({ get: async (k: string) => vals[k] })
const fakeHttp = (status: number, text: string, seen: any[]) => ({
  fetch: async (url: string, init: any) => {
    seen.push({ url, init })
    return { status, ok: status >= 200 && status < 300, headers: {}, text }
  },
})

test('gửi kèm header phiên bản và khóa', async () => {
  const seen: any[] = []
  const $ = {
    store: store({ 'tutien.key': 'k1', 'tutien.name': 'thang', 'tutien.version': 'v1.2.0' }),
    http: fakeHttp(200, '{"player":{}}', seen),
  }
  const res = await callServer($ as any, '/me')
  expect(res.ok).toBe(true)
  expect(seen[0].init.headers['x-tutien-version']).toBe('v1.2.0')
  expect(seen[0].init.headers.authorization).toBe('Bearer k1')
})

test('426 từ server: báo cần /tutien update, không coi là lỗi mạng', async () => {
  const $ = {
    store: store({ 'tutien.key': 'k1', 'tutien.name': 'thang', 'tutien.version': 'v1.0.0' }),
    http: fakeHttp(426, '{"error":"upgrade required"}', []),
  }
  const res = await callServer($ as any, '/me')
  expect(res.ok).toBe(false)
  expect(res.upgrade).toBe(true)
})
