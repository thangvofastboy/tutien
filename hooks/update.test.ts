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
  'cat-file tag v1.2.0': 'object bbb\ntype commit\ntag v1.2.0\ntagger t\n',
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

  expect(text).toBe('Đã cập nhật lên v1.2.0; đang nạp lại plugin.')
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

  expect(text).toContain('thay đổi chưa commit')
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

  expect(text).toContain('không được ký bởi khóa phát hành tin cậy')
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

  expect(text).toContain('không được ký bởi khóa phát hành tin cậy')
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

  expect(text).toContain('cũ hơn bản đang chạy')
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

  expect(text).toContain('Không xác định được phiên bản hiện tại')
  expect(ran.some(a => a.startsWith('checkout'))).toBe(false)
})

test('/tutien update refuses a replayed signature: ref name differs from the signed tag name', async ($, on) => {
  const ran: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    if (args.startsWith('cat-file tag')) return ok('object bbb\ntype commit\ntag v1.0.0\ntagger t\n')
    return ok(GIT[args] ?? '')
  })

  const { text } = await $.command.run(RUN)

  expect(text).toContain('không khớp tên tag đã ký')
  expect(ran.some(a => a.startsWith('checkout'))).toBe(false)
})

test('/tutien update fetches tags without --force', async ($, on) => {
  const ran: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    return ok(GIT[args] ?? '')
  })
  await $.command.run(RUN)
  expect(ran.some(a => a.startsWith('fetch') && a.includes('--force'))).toBe(false)
})

test('#7 đã ở bản mới nhất thì không reload plugin', async ($, on) => {
  const reloads: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    if (args === 'rev-parse v1.2.0^{commit}') return ok('aaa\n')   // trùng HEAD
    return ok(GIT[args] ?? '')
  })
  on('command.run', { command: 'reload-plugins' }, async ($, e) => { reloads.push(e.command); return { text: '' } })
  const clock = mock.clock(on)
  const { text } = await $.command.run(RUN)
  await clock.advance(0)
  expect(text).toBe('Đã ở bản mới nhất v1.2.0.')
  expect(reloads).toEqual([])
})

test('/tutien update với bản cài từ marketplace: chạy claude plugin update rồi reload', async ($, on) => {
  const ran: string[] = []
  const reloads: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.join(' ')
    ran.push(args)
    if (args.startsWith('git rev-parse --is-inside-work-tree')) {
      return { value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (args === 'claude plugin update tutien') return ok('Updated tutien\n')
    return ok('')
  })
  on('command.run', { command: 'reload-plugins' }, async ($, e) => { reloads.push(e.command); return { text: '' } })
  const clock = mock.clock(on)
  const { text } = await $.command.run(RUN)
  await clock.advance(0)
  expect(ran).toContain('claude plugin update tutien')
  expect(text).toContain('Đã cập nhật')
  expect(reloads).toEqual(['reload-plugins'])
})

test('/tutien update từ marketplace: CLI báo đã mới nhất thì không reload (autoupdate mỗi phiên)', async ($, on) => {
  const reloads: string[] = []
  on('process.run', async ($, e) => {
    const args = e.argv.join(' ')
    if (args.startsWith('git rev-parse --is-inside-work-tree')) {
      return { value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (args === 'claude plugin update tutien') return ok('✔ tutien is already at the latest version (0.1.14).\n')
    return ok('')
  })
  on('command.run', { command: 'reload-plugins' }, async ($, e) => { reloads.push(e.command); return { text: '' } })
  const clock = mock.clock(on)
  const { text } = await $.command.run(RUN)
  await clock.advance(0)
  expect(text).toContain('mới nhất')
  expect(reloads).toEqual([])
})

test('/tutien update bỏ qua tag thử nghiệm (v1.3.0-rc1) và cập nhật lên bản phát hành mới nhất', async ($, on) => {
  const clock = mock.clock(on)
  const ran: string[] = []
  const git: Record<string, string> = { ...GIT, 'tag -l v* --sort=-v:refname': 'v1.3.0-rc1\nv1.2.0\nv1.1.9\n' }
  on('process.run', async ($, e) => {
    const args = e.argv.slice(1).join(' ')
    ran.push(args)
    return ok(git[args] ?? '')
  })
  on('command.run', { command: 'reload-plugins' }, async () => ({ text: 'reloaded' }))
  const { text } = await $.command.run(RUN)
  await clock.advance(0)
  expect(text).toBe('Đã cập nhật lên v1.2.0; đang nạp lại plugin.')
  expect(ran.some(a => a.includes('rc1') && a.startsWith('checkout'))).toBe(false)
})
