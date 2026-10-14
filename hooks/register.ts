import type { Register } from 'claude-code'
import { parseAutoUpdate, parseDescribe } from './version'
import { recordTurn, flushUsage } from './usage'
import { callServer, SERVER } from './api'
import { CLASSES, GENDERS } from './rules'
import { HELP, tokens, parseRegister, parseReset, formatTop } from './commands'
import { statusText } from './display'

const USAGE = 'Usage: /tutien update | autoupdate on|off'

// Compare vMAJOR.MINOR.PATCH tags numerically; a tag that does not parse compares as older (fail closed).
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(v)
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
  }
  const x = parse(a), y = parse(b)
  if (!x || !y) return -1
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await recordTurn($, e.turnId, e.usage)
    return result
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tutien',
      description: 'Tu tien: update pulls the newest tag and reloads plugins',
      argumentHint: 'update | autoupdate on|off',
    })
    const v = (await $.process.run(['git', 'describe', '--tags', '--abbrev=0', 'HEAD'], { cwd: $.plugin.root, timeoutMs: 30_000 })).stdout
    await $.store.set('tutien.version', parseDescribe(v))
    if ((await $.store.get('tutien.autoupdate')) === 'on') await runUpdate($)
    await flushUsage($)

    return next(e)
  })

  on('command.run', { command: 'tutien' }, async ($, e) => {
    const [sub = '', ...rest] = tokens(e.args)
    const tail = e.args.trim().slice(sub.length).trim()
    switch (sub) {
      case 'help': case '': return { text: HELP }
      case 'update': return { text: await runUpdate($) }
      case 'autoupdate': {
        const v = parseAutoUpdate(rest.join(' '))
        if (!v) return { text: 'Dùng: /tutien autoupdate on|off' }
        await $.store.set('tutien.autoupdate', v)
        return { text: `Tự cập nhật khi mở Claude Code: ${v === 'on' ? 'bật' : 'tắt'}.` }
      }
      case 'register': {
        const r = parseRegister(tail)
        if (!r) return { text: 'Dùng: /tutien register <tên> <lớp> <giới>' }
        const res = await $.http.fetch(`${SERVER}/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-tutien-version': String((await $.store.get('tutien.version')) ?? '') },
          body: JSON.stringify(r),
        })
        if (res.status === 409) return { text: `Tên "${r.name}" đã có người dùng.` }
        if (res.status === 426) return { text: 'Bản mod đã cũ. Chạy /tutien update trước.' }
        if (!res.ok) return { text: `Đăng ký thất bại (${res.status}).` }
        await $.store.set('tutien.key', JSON.parse(res.text).key)
        await $.store.set('tutien.name', r.name)
        return { text: `Đã ghi danh ${r.name}: ${r.cls}, ${r.gender}. Khóa đã lưu trên máy này.` }
      }
      case 'appearance': {
        const [cls, gender] = tokens(tail)
        if (!(CLASSES as readonly string[]).includes(cls) || !(GENDERS as readonly string[]).includes(gender)) {
          return { text: 'Dùng: /tutien appearance <lớp> <giới>' }
        }
        const res = await callServer($, '/appearance', { cls, gender })
        return { text: res.upgrade ? 'Bản mod đã cũ. Chạy /tutien update.' : res.ok ? `Đã đổi thành ${cls}, ${gender}.` : 'Chưa ghi danh, hoặc server không phản hồi.' }
      }
      case 'reset': {
        const r = parseReset(tail)
        if (!r.confirm) {
          return { text: 'Reset sẽ đưa bậc, EXP, thiên phạt và pháp bảo về 0, kèm chọn lại lớp và giới.\nGõ: /tutien reset confirm <lớp> <giới>\nLớp: ' + CLASSES.join(', ') + '\nGiới: ' + GENDERS.join(', ') }
        }
        if (!r.cls || !r.gender) return { text: 'Thiếu lớp hoặc giới hợp lệ.' }
        const res = await callServer($, '/reset', { cls: r.cls, gender: r.gender })
        return { text: res.ok ? `Đã quay về Luyện Khí Sơ Kỳ, ${r.cls}, ${r.gender}.` : 'Không reset được (chưa ghi danh hoặc server lỗi).' }
      }
      case 'status': case 's': {
        const res = await callServer<{ player: any }>($, '/me')
        if (!res.ok || !res.data) return { text: 'Chưa ghi danh, hoặc server không phản hồi.' }
        return { text: statusText(res.data.player, Date.now()) }
      }
      case 'top': case 't': {
        const me = ((await $.store.get('tutien.name')) as string) ?? ''
        const sections: string[] = []
        for (const [board, title] of [['tu-vi', 'Tu vi'], ['chamchi', 'Chăm chỉ'], ['tuan', 'Tuần này'], ['phoenix', 'Phượng hoàng'], ['phapbao', 'Pháp bảo']] as const) {
          const res = await $.http.fetch(`${SERVER}/leaderboard?board=${board}`, { method: 'GET' })
          if (!res.ok) { sections.push(`— ${title} —\nKhông lấy được bảng này (${res.status}).`); continue }
          sections.push(formatTop(title, JSON.parse(res.text).rows, me))
        }
        return { text: sections.join('\n\n') }
      }
      default: return { text: HELP }
    }
  })
}

export async function runUpdate($: any): Promise<string> {
  const root = $.plugin.root
  const git = (...args: string[]) =>
    $.process.run(['git', ...args], { cwd: root, timeoutMs: 120_000 })

  if ((await git('rev-parse', '--is-inside-work-tree')).exitCode !== 0) {
    return `${root} is not a git clone, so it cannot update from tags. Install from a clone (see README).`
  }

  const dirty = await git('status', '--porcelain', '--untracked-files=no')
  if (dirty.stdout.trim()) {
    return `Local changes in ${root}; commit or stash them first:\n${dirty.stdout}`
  }

  // No --force: a remote cannot silently move a tag this clone already has.
  const fetched = await git('fetch', '--tags', 'origin')
  if (fetched.exitCode !== 0) return `git fetch failed:\n${fetched.stderr}`

  const tags = await git('tag', '-l', 'v*', '--sort=-v:refname')
  const latest = tags.stdout.split('\n')[0]?.trim()
  if (!latest) return 'No v* tag on origin yet.'

  // The signer list is read from the checkout we are on now, before switching,
  // so a tampered remote cannot also swap the key it is checked against.
  const signers = `${root}/.github/allowed_signers`
  const verified = await git(
    '-c', 'gpg.format=ssh',
    '-c', `gpg.ssh.allowedSignersFile=${signers}`,
    '-c', 'gpg.minTrustLevel=fully',
    'tag', '-v', latest,
  )
  // Some git versions exit 0 for a valid signature from an unlisted key; reject it explicitly.
  if (verified.exitCode !== 0 || verified.stderr.includes('No principal matched')) {
    return `Tag ${latest} is not signed by a trusted release key; not updating.\n${verified.stderr}`
  }

  // The signature covers the tag object, not the ref name: a ref v9.9.9 pointing at an old signed
  // v1.0.0 object verifies fine. Require the signed name to match the ref we are about to trust.
  const signedName = /^tag (.+)$/m.exec((await git('cat-file', 'tag', latest)).stdout)?.[1]?.trim()
  if (signedName !== latest) {
    return `Tag ${latest} does not match the signed tag name (${signedName ?? 'none'}); not updating.`
  }

  const head = (await git('rev-parse', 'HEAD')).stdout.trim()
  const target = (await git('rev-parse', `${latest}^{commit}`)).stdout.trim()
  // Fail closed: refuse any tag not newer than the version this checkout is built from.
  const current = await git('describe', '--tags', '--abbrev=0', 'HEAD')
  if (current.exitCode !== 0 || !current.stdout.trim()) {
    return 'Cannot determine the current version; not updating.'
  }
  if (head !== target && compareVersions(latest, current.stdout.trim()) <= 0) {
    return `${latest} is older than the current build (${current.stdout.trim()}); not rolling back.`
  }

  if (head !== target) {
    const out = await git('checkout', '--detach', latest)
    if (out.exitCode !== 0) return `git checkout ${latest} failed:\n${out.stderr}`
  }

  // Runs after this hook returns: $.command.run rejects inside a hook the turn waits on.
  $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }))

  return head === target ? `Already at ${latest}; reloading plugins.` : `Updated to ${latest}; reloading plugins.`
}
