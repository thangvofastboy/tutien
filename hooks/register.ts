import type { Register } from 'claude-code'
import { parseAutoUpdate, parseDescribe, versionFromManifest } from './version'
import { recordTurn, flushUsage } from './usage'
import { callServer, SERVER } from './api'
import { CLASSES, GENDERS } from './rules'
import { HELP, tokens, parseRegister, parseReset, formatTop } from './commands'
import { statusText } from './display'
import { refreshPane, renderPane, renderBand, renderSettings, renderStart, startWizard, registerPlayer, setPlayer, PANE_ID, SETTINGS_ID, START_ID } from './pane'
import { PERSONAS, personaById, buildPersonaPrompt, parsePersonaLines } from './persona'
import { PROLOGUE, unlockedChapters } from './story'

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
  on('command.run', { command: 'tutien-pane' }, async $ => {
    await $.ui.open({ id: PANE_ID, title: 'Tu tiên' })
    return { text: 'Đã mở pane Tu tiên.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => renderPane($, e))
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => renderBand($, e, next))
  on('ui.render', { component: 'Pane', requestId: SETTINGS_ID }, async ($, e) => renderSettings($, e))
  on('ui.render', { component: 'Pane', requestId: START_ID }, async ($, e) => renderStart($, e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await recordTurn($, e.turnId, e.usage)
    return result
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tutien-pane',
      description: 'Mở pane Tu tiên',
    })
    await $.command.register({
      name: 'tutien',
      description: 'Tu tien: update pulls the newest tag and reloads plugins',
      argumentHint: 'update | autoupdate on|off',
    })
    // Bản clone git: phiên bản theo tag. Bản cài từ marketplace (không có git): theo plugin.json.
    const described = await $.process.run(['git', 'describe', '--tags', '--abbrev=0', 'HEAD'], { cwd: $.plugin.root, timeoutMs: 30_000 }).catch(() => null)
    let version = described && described.exitCode === 0 ? parseDescribe(described.stdout) : ''
    if (!version) {
      const manifest = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`).catch(() => '')
      version = versionFromManifest(String(manifest))
    }
    await $.store.set('tutien.version', version)
    if ((await $.store.get('tutien.autoupdate')) === 'on') await runUpdate($)
    await flushUsage($)
    await refreshPane($)

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
        return { text: (await registerPlayer($, r)).text }
      }
      case 'start': case 'batdau': {
        await startWizard($)
        return { text: 'Bắt đầu hành trình tu tiên. Làm theo các bước trong pane.' }
      }
      case 'appearance': {
        const [cls, gender] = tokens(tail)
        if (!(CLASSES as readonly string[]).includes(cls) || !(GENDERS as readonly string[]).includes(gender)) {
          return { text: 'Dùng: /tutien appearance <lớp> <giới>' }
        }
        const res = await callServer($, '/appearance', { cls, gender })
        if (res.ok) await refreshPane($)
        return { text: res.upgrade ? 'Bản mod đã cũ. Chạy /tutien update.' : res.ok ? `Đã đổi thành ${cls}, ${gender}.` : 'Chưa ghi danh, hoặc server không phản hồi.' }
      }
      case 'reset': {
        const r = parseReset(tail)
        if (!r.confirm) {
          return { text: 'Reset sẽ đưa bậc, EXP, thiên phạt và pháp bảo về 0, kèm chọn lại lớp và giới.\nGõ: /tutien reset confirm <lớp> <giới>\nLớp: ' + CLASSES.join(', ') + '\nGiới: ' + GENDERS.join(', ') }
        }
        if (!r.cls || !r.gender) return { text: 'Thiếu lớp hoặc giới hợp lệ.' }
        const res = await callServer($, '/reset', { cls: r.cls, gender: r.gender })
        if (res.ok) await refreshPane($)
        return { text: res.ok ? `Đã quay về Luyện Khí Sơ Kỳ, ${r.cls}, ${r.gender}.` : 'Không reset được (chưa ghi danh hoặc server lỗi).' }
      }
      case 'persona': {
        const [id, ...restDesc] = rest
        if (id === 'tuy-chinh') {
          const desc = restDesc.join(' ').trim()
          if (!desc) return { text: 'Dùng: /tutien persona tuy-chinh <mô tả tính cách, tối đa 200 ký tự>' }
          const out = await $.model.complete({ model: 'haiku', prompt: buildPersonaPrompt(desc) }).catch(() => null)
          const lines = out && out.isAnswered ? parsePersonaLines(out.text) : []
          if (lines.length === 0) return { text: 'Không tạo được thoại tùy chỉnh; giữ bộ thoại mặc định.' }
          await $.store.set('tutien.persona', 'tuy-chinh')
          await $.store.set('tutien.personaLines', lines)
          return { text: `Đã đặt tính cách tùy chỉnh (${lines.length} câu thoại), chỉ lưu trên máy này.` }
        }
        const p = id ? personaById(id) : null
        if (!p) return { text: `Dùng: /tutien persona <${PERSONAS.map(x => x.id).join('|')}|tuy-chinh>` }
        await $.store.set('tutien.persona', p.id)
        await $.store.set('tutien.personaLines', null)
        return { text: `Tính cách: ${p.name}. ${p.catchphrase}` }
      }
      case 'truyen': {
        const realm = ((await $.store.get('tutien.realm')) as number | undefined) ?? 1
        const chapters = unlockedChapters(realm)
        const body = [PROLOGUE, ...chapters.map(c => `${c.title}\n${c.text}`)].join('\n\n')
        return { text: body }
      }
      case 'khoa-moi': {
        const res = await callServer<{ key: string }>($, '/rotate-key', {})
        if (!res.ok || !res.data?.key) return { text: 'Không đổi được khóa (chưa ghi danh, khóa sai, hoặc server lỗi).' }
        await $.store.set('tutien.key', res.data.key)
        return { text: 'Đã đổi khóa. Khóa cũ không còn dùng được.' }
      }
      case 'setting': case 'caidat': {
        await $.ui.open({ id: SETTINGS_ID, title: 'Cài đặt Tu Tiên' })
        return { text: 'Đã mở cài đặt.' }
      }
      case 'hienthi': {
        const mode = (rest[0] ?? '').trim()
        if (!['image', 'raster', 'text'].includes(mode)) {
          return { text: 'Dùng: /tutien hienthi image|raster|text\nimage: terminal có đồ họa (kitty, WezTerm, iTerm2)\nraster: ô màu, chạy mọi terminal (mặc định)\ntext: chỉ chữ' }
        }
        await $.store.set('tutien.display', mode)
        return { text: `Chế độ hiển thị: ${mode}. Mở lại pane để xem.` }
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
    // Bản cài từ marketplace không phải git clone: nhờ CLI cập nhật rồi nạp lại plugin.
    const up = await $.process.run(['claude', 'plugin', 'update', 'tutien'], { timeoutMs: 300_000 }).catch(() => null)
    if (!up || up.exitCode !== 0) {
      return `Không tự cập nhật được. Chạy thủ công: /plugin update tutien rồi /reload-plugins.\n${up?.stderr ?? ''}`
    }
    $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }))
    return `Đã cập nhật tutien (${up.stdout.trim() || 'xong'}); đang nạp lại plugin.`
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

  if (head === target) return `Already at ${latest}.`

  const out = await git('checkout', '--detach', latest)
  if (out.exitCode !== 0) return `git checkout ${latest} failed:\n${out.stderr}`

  // Reload only after a real checkout, so autoupdate on session start does not reload every time.
  // Runs after this hook returns: $.command.run rejects inside a hook the turn waits on.
  $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }))
  return `Updated to ${latest}; reloading plugins.`
}
