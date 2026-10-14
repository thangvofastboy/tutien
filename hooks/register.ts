import type { Register } from 'claude-code'
import { parseAutoUpdate, parseDescribe } from './version'

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
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tutien',
      description: 'Tu tien: update pulls the newest tag and reloads plugins',
      argumentHint: 'update | autoupdate on|off',
    })
    const v = (await $.process.run(['git', 'describe', '--tags', '--abbrev=0', 'HEAD'], { cwd: $.plugin.root, timeoutMs: 30_000 })).stdout
    await $.store.set('tutien.version', parseDescribe(v))
    if ((await $.store.get('tutien.autoupdate')) === 'on') await runUpdate($)

    return next(e)
  })

  on('command.run', { command: 'tutien' }, async ($, e) => {
    const [sub, ...rest] = e.args.trim().split(/\s+/)
    if (sub === 'autoupdate') {
      const v = parseAutoUpdate(rest.join(' '))
      if (!v) return { text: 'Dùng: /tutien autoupdate on|off' }
      await $.store.set('tutien.autoupdate', v)
      return { text: `Tự cập nhật khi mở Claude Code: ${v === 'on' ? 'bật' : 'tắt'}.` }
    }
    if (sub !== 'update') return { text: USAGE }
    return { text: await runUpdate($) }
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

  const fetched = await git('fetch', '--tags', '--force', 'origin')
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
