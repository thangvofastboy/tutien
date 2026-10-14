import type { Register } from 'claude-code'

const USAGE = 'Usage: /tutien update'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tutien',
      description: 'Tu tien: update pulls the newest tag and reloads plugins',
      argumentHint: 'update',
    })

    return next(e)
  })

  on('command.run', { command: 'tutien' }, async ($, e) => {
    if (e.args.trim() !== 'update') return { text: USAGE }

    const root = $.plugin.root
    const git = (...args: string[]) =>
      $.process.run(['git', ...args], { cwd: root, timeoutMs: 120_000 })

    if ((await git('rev-parse', '--is-inside-work-tree')).exitCode !== 0) {
      return {
        text: `${root} is not a git clone, so it cannot update from tags. Install from a clone (see README).`,
      }
    }

    const dirty = await git('status', '--porcelain', '--untracked-files=no')
    if (dirty.stdout.trim()) {
      return { text: `Local changes in ${root}; commit or stash them first:\n${dirty.stdout}` }
    }

    const fetched = await git('fetch', '--tags', '--force', 'origin')
    if (fetched.exitCode !== 0) return { text: `git fetch failed:\n${fetched.stderr}` }

    const tags = await git('tag', '-l', 'v*', '--sort=-v:refname')
    const latest = tags.stdout.split('\n')[0]?.trim()
    if (!latest) return { text: 'No v* tag on origin yet.' }

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
      return { text: `Tag ${latest} is not signed by a trusted release key; not updating.\n${verified.stderr}` }
    }

    const head = (await git('rev-parse', 'HEAD')).stdout.trim()
    const target = (await git('rev-parse', `${latest}^{commit}`)).stdout.trim()
    // A signed but older tag is still a rollback: refuse it, so a replayed old release cannot reintroduce bugs.
    if (head !== target && (await git('merge-base', '--is-ancestor', target, head)).exitCode === 0) {
      return { text: `${latest} is older than the current build; not rolling back.` }
    }
    if (head !== target) {
      const out = await git('checkout', '--detach', latest)
      if (out.exitCode !== 0) return { text: `git checkout ${latest} failed:\n${out.stderr}` }
    }

    // Runs after this hook returns: $.command.run rejects inside a hook the turn waits on.
    $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }))

    return {
      text: head === target ? `Already at ${latest}; reloading plugins.` : `Updated to ${latest}; reloading plugins.`,
    }
  })
}
