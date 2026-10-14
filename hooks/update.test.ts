import { expect, mock, test } from 'claude-code/testing'

const RUN = {
  command: 'tutien',
  args: 'update',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
} as const

const ok = (stdout: string) => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

const GIT: Record<string, string> = {
  'rev-parse --is-inside-work-tree': 'true\n',
  'status --porcelain --untracked-files=no': '',
  'tag -l v* --sort=-v:refname': 'v1.2.0\nv1.1.9\n',
  'rev-parse HEAD': 'aaa\n',
  'rev-parse v1.2.0^{commit}': 'bbb\n',
  'describe --tags --abbrev=0 HEAD': 'v1.1.0\n',
}

test('/tutien update checks out the newest tag, then reloads plugins', async ($, on) => {
  const clock = mock.clock(on)
  const ran: string[] = []
  const reloads: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    return ok(GIT[args] ?? '')
  })
  on('command.run', { command: 'reload-plugins' }, async ($, e) => {
    reloads.push(e.command)
    return { text: 'reloaded' }
  })

  const { text } = await $.command.run(RUN)
  await clock.advance(0)

  expect(text).toBe('Updated to v1.2.0; reloading plugins.')
  expect(ran).toContain('checkout --detach v1.2.0')
  expect(reloads).toEqual(['reload-plugins'])
})

test('/tutien update refuses a dirty clone', async ($, on) => {
  const ran: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    const stdout = args.startsWith('status') ? ' M hooks/register.ts\n' : 'true\n'
    return ok(stdout)
  })

  const { text } = await $.command.run(RUN)

  expect(text).toContain('Local changes')
  expect(ran.some(a => a.startsWith('fetch') || a.startsWith('checkout'))).toBe(false)
})

test('/tutien update refuses a tag without a trusted signature', async ($, on) => {
  const ran: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    if (args.includes('tag -v')) {
      return { value: { exitCode: 1, stdout: '', stderr: 'no signature found', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return ok(GIT[args] ?? '')
  })

  const { text } = await $.command.run(RUN)

  expect(text).toContain('not signed by a trusted release key')
  expect(ran.some(a => a.startsWith('checkout'))).toBe(false)
})

test('/tutien update refuses a tag signed by a key outside the allowed list', async ($, on) => {
  const ran: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    if (args.includes('tag -v')) {
      return { value: { exitCode: 0, stdout: '', stderr: 'Good "git" signature with ED25519 key\nNo principal matched.', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return ok(GIT[args] ?? '')
  })

  const { text } = await $.command.run(RUN)

  expect(text).toContain('not signed by a trusted release key')
  expect(ran.some(a => a.startsWith('checkout'))).toBe(false)
})

test('/tutien update refuses a rollback: the tag is older than the current build', async ($, on) => {
  const ran: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    if (args.startsWith('describe')) return ok('v1.3.0\n')
    return ok(GIT[args] ?? '')
  })

  const { text } = await $.command.run(RUN)

  expect(text).toContain('older than the current build')
  expect(ran.some(a => a.startsWith('checkout'))).toBe(false)
})

test('/tutien update refuses when the current version cannot be determined (fail closed)', async ($, on) => {
  const ran: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    if (args.startsWith('describe')) return { value: { exitCode: 128, stdout: '', stderr: 'fatal: no tags', isStdoutTruncated: false, isStderrTruncated: false } }
    return ok(GIT[args] ?? '')
  })

  const { text } = await $.command.run(RUN)

  expect(text).toContain('Cannot determine the current version')
  expect(ran.some(a => a.startsWith('checkout'))).toBe(false)
})
