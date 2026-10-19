import type { Register } from 'claude-code'
import { parseAutoUpdate, parseDescribe, versionFromManifest } from './version'
import { recordTurn, flushUsage } from './usage'
import { callServer, SERVER } from './api'
import { CLASSES, GENDERS } from './rules'
import { HELP, tokens, parseRegister, parseReset, formatTop } from './commands'
import { statusText } from './display'
import { refreshPane, renderPane, renderBand, renderSettings, renderStart, startWizard, submitWizardName, logGreeting, registerPlayer, setPlayer, seedPlayer, startLineClock, setAvatar, isPngBase64, applyEvents, showOut, PANE_ID, SETTINGS_ID, START_ID } from './pane'
import { PERSONAS, personaById, buildPersonaPrompt, parsePersonaLines } from './persona'
import { PROLOGUE, unlockedChapters } from './story'
import { startWeb, stopWeb } from './web'
import { runMore, statusText as fullStatus, extraBoards, resolvePendingLink, MORE_HELP } from './more'
import { runFeatures, trackTool, FEATURE_HELP } from './features'
import { loadAccount, sessionNotes, breakReminder, reconcile, personaSection } from './session'

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
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => renderPane($, e))
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => renderBand($, e, next))
  on('ui.render', { component: 'Pane', requestId: SETTINGS_ID }, async ($, e) => renderSettings($, e))
  on('ui.render', { component: 'Pane', requestId: START_ID }, async ($, e) => renderStart($, e))

  // Persona cho Claude (bật trong cài đặt): thêm một đoạn cuối system prompt.
  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const text = await personaSection($)
    return text ? { sections: [...out.sections, { id: 'tutien:persona', text, scope: 'session' as const }] } : out
  })

  // Linh căn: đếm loại việc qua từng lần gọi tool (đuôi file hoặc lệnh shell); chạy nền, không chặn tool.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const { tool, ...input } = e as any
    void trackTool($, String(tool), input).catch(() => null)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Chạy nền: lượt kết thúc ngay, không chờ server (turn.complete bắn cả cho từng lượt subagent).
    void recordTurn($, e.turnId, e.usage).catch(() => null)
    void breakReminder($).catch(() => null)
    return result
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tutien',
      description: 'Tu tien: update pulls the newest tag and reloads plugins',
      argumentHint: 'pane | update | autoupdate on|off',
    })
    // Bản clone git: phiên bản theo tag. Bản cài từ marketplace (không có git): theo plugin.json.
    const described = await $.process.run(['git', 'describe', '--tags', '--abbrev=0', 'HEAD'], { cwd: $.plugin.root, timeoutMs: 30_000 }).catch(() => null)
    let version = described && described.exitCode === 0 ? parseDescribe(described.stdout) : ''
    if (!version) {
      const manifest = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`).catch(() => '')
      version = versionFromManifest(String(manifest))
    }
    await $.store.set('tutien.version', version)
    await loadAccount($).catch(() => null)
    await seedPlayer($).catch(() => null)
    try { startLineClock($) } catch { /* không có đồng hồ: câu đổi khi pane vẽ lại */ }
    // Phần còn lại cần mạng (cập nhật, gửi hàng đợi, hộp thư): chạy nền để mở phiên không phải chờ,
    // và mất mạng thì không làm hỏng session.start.
    void (async () => {
      if ((await $.store.get('tutien.autoupdate')) === 'on') await runUpdate($).catch(() => null)
      // Liên kết dở từ lần trước (mất phản hồi khi gộp): chọn đúng khóa trước khi gửi lượt nào.
      const linked = await resolvePendingLink($).catch(() => null)
      if (linked) $.ui.log(linked)
      await flushUsage($).catch(() => null)
      await refreshPane($).catch(() => null)
      await logGreeting($).catch(() => null)
      await sessionNotes($).catch(() => null)
      await reconcile($).catch(() => null)
    })().catch(() => null)

    return next(e)
  })

  on('command.run', { command: 'tutien' }, async ($, e) => runTutien($, e.args))
}

// /tutien <lệnh>: dùng chung cho ô nhập lệnh và các nút trong panel.
export async function runTutien($: any, args: string): Promise<{ text: string }> {
    const [sub = '', ...rest] = tokens(args)
    const tail = args.trim().replace(/^("[^"]*"|\S+)/, '').trim()
    switch (sub) {
      case 'help': case '': return { text: `${HELP}\n\nMở rộng:\n${MORE_HELP}\n\nCơ duyên và đồng môn:\n${FEATURE_HELP}` }
      case 'pane': case 'panel': { // 'panel': tên cũ, giữ để lệnh quen tay vẫn chạy
        await $.ui.open({ id: PANE_ID, title: 'Tu tiên' })
        return { text: 'Đã mở panel Tu tiên.' }
      }
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
      case 'ten': return { text: await submitWizardName($, tail) }
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
        return { text: res.upgrade ? 'Server chưa nhận phiên bản mod này. Chạy /tutien update; nếu đã mới nhất, chờ admin đăng ký phiên bản.' : res.ok ? `Đã đổi thành ${cls}, ${gender}.` : 'Chưa ghi danh, hoặc server không phản hồi.' }
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
        await callServer($, '/profile', { persona: p.name }).catch(() => null)
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
      case 'web': {
        if ((rest[0] ?? '').trim() === 'stop') return { text: (await stopWeb()) ? 'Đã tắt mini web.' : 'Mini web chưa chạy.' }
        const res = await callServer<{ player: any }>($, '/me').catch(() => undefined)
        const out = await startWeb($, res?.ok ? res.data?.player : undefined)
        if (out.ok) await refreshPane($) // ghi lại trạng thái kèm bảng xếp hạng cho trang
        return { text: out.text }
      }
      case 'hinh': case 'avatar': {
        if (!tail) return { text: 'Dùng: /tutien hinh <đường dẫn ảnh: png, jpg, webp, gif…> | /tutien hinh xoa\nẢnh dùng chung mọi bậc, chỉ lưu trên máy này.' }
        if (tail === 'xoa' || tail === 'off') { await setAvatar($, null, null); return { text: 'Đã bỏ ảnh tự chọn, dùng lại ảnh mặc định.' } }
        const file = tail.replace(/^(['"])(.*)\1$/, '$2')
        // scripts/avatar.py: mọi định dạng Pillow đọc được, hiểu ~, thu về 96×96 kèm ô màu cho terminal.
        const r = await $.process.run(['python3', `${$.plugin.root}/scripts/avatar.py`, file], { timeoutMs: 60_000 }).catch(() => null)
        if (r?.exitCode === 0) {
          let a: any = null
          try { a = JSON.parse(r.stdout) } catch { /* in lạ: thử cách dưới */ }
          if (isPngBase64(a?.png) && typeof a.cells === 'string') {
            await setAvatar($, a.png, typeof a.file === 'string' ? a.file : file, a.cells)
            return { text: 'Đã đặt ảnh nhân vật (mọi bậc). Mở lại panel nếu chưa thấy đổi.' }
          }
        }
        // Không có python3 hoặc Pillow: nhận thẳng file PNG, không có ô màu nên terminal chế độ Ô màu vẫn vẽ ảnh bậc.
        // ponytail: chỉ kiểm tra tiền tố base64 và độ dài chuỗi, không giải mã nên file hỏng có tiền tố PNG vẫn lọt. Nâng cấp: giải mã và kiểm tra cấu trúc ảnh khi có người gặp lỗi hiển thị.
        const b64 = ((await $.fs.read(file, { as: 'bytes' }).catch(() => null)) as any)?.base64
        if (isPngBase64(b64)) {
          await setAvatar($, b64, file)
          return { text: 'Đã đặt ảnh nhân vật (mọi bậc). Terminal chế độ Ô màu cần python3 + Pillow (pip install pillow) để vẽ ảnh này.' }
        }
        const err = String(r?.stderr ?? '')
        if (/No module named 'PIL'/.test(err)) return { text: 'Cần Pillow để đọc ảnh này: pip install pillow (hoặc dùng file PNG).' }
        return { text: `Không đọc được ảnh: ${file}${err ? `\n${err.trim().split('\n').pop()}` : ''}` }
      }
      case 'setting': case 'settings': case 'caidat': {
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
        return { text: await fullStatus($) }
      }
      case 'top': case 't': {
        const me = ((await $.store.get('tutien.name')) as string) ?? ''
        const boards = [['tu-vi', 'Tu vi'], ['chamchi', 'Chăm chỉ'], ['tuan', 'Tuần này'], ['phoenix', 'Phượng hoàng'], ['phapbao', 'Pháp bảo']] as const
        const [sections, extra] = await Promise.all([
          Promise.all(boards.map(async ([board, title]) => {
            const res = await $.http.fetch(`${SERVER}/leaderboard?board=${board}&me=${encodeURIComponent(me)}`, { method: 'GET' }).catch(() => null)
            try {
              if (res?.ok) return formatTop(title, JSON.parse(res.text).rows, me)
            } catch { /* trang lỗi không phải JSON */ }
            return `— ${title} —\nKhông lấy được bảng này (${res?.status ?? 'mất mạng'}).`
          })),
          $.store.get('tutien.realm').then((realm: any) => extraBoards($, me, realm as number | undefined)).catch(() => [] as string[]),
        ])
        sections.push(...extra)
        return { text: sections.join('\n\n') }
      }
      default: {
        const f = await runFeatures($, sub, rest, tail)
        if (f) {
          if (f.player) await setPlayer($, f.player)
          if (f.events?.length) await applyEvents($, f.events)
          if (f.card || f.actions) await showOut($, f.title ?? '🪪 Thẻ Tu Tiên', f.text, f.card, f.actions)
          if (sub.startsWith('ky') || sub.startsWith('cong') || sub.startsWith('luan')) void refreshPane($).catch(() => null)
          return { text: f.text }
        }
        return { text: (await runMore($, sub, rest, tail)) ?? `${HELP}\n\nMở rộng:\n${MORE_HELP}\n\nCơ duyên và đồng môn:\n${FEATURE_HELP}` }
      }
    }
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
    // CLI thoát 0 cả khi không có gì mới: khi đó không nạp lại, tránh nạp lại mỗi lần mở phiên (autoupdate).
    if (/already at the latest/i.test(up.stdout)) return `tutien đã là bản mới nhất (${up.stdout.trim()}).`
    $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }))
    return `Đã cập nhật tutien (${up.stdout.trim() || 'xong'}); đang nạp lại plugin.`
  }

  const dirty = await git('status', '--porcelain', '--untracked-files=no')
  if (dirty.stdout.trim()) {
    return `Bản clone ở ${root} có thay đổi chưa commit; commit hoặc stash trước khi cập nhật:\n${dirty.stdout}`
  }

  // No --force: a remote cannot silently move a tag this clone already has.
  const fetched = await git('fetch', '--tags', 'origin')
  if (fetched.exitCode !== 0) return `Không tải được tag từ GitHub (git fetch lỗi):\n${fetched.stderr}`

  const tags = await git('tag', '-l', 'v*', '--sort=-v:refname')
  // Chỉ xét tag phát hành dạng vX.Y.Z; tag thử nghiệm (v1.2.0-rc1) không chặn việc cập nhật.
  const latest = tags.stdout.split('\n').map((t: string) => t.trim()).find((t: string) => /^v\d+\.\d+\.\d+$/.test(t))
  if (!latest) return 'Chưa có bản phát hành nào (tag vX.Y.Z) trên GitHub.'

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
    return `Tag ${latest} không được ký bởi khóa phát hành tin cậy; không cập nhật.\n${verified.stderr}`
  }

  // The signature covers the tag object, not the ref name: a ref v9.9.9 pointing at an old signed
  // v1.0.0 object verifies fine. Require the signed name to match the ref we are about to trust.
  const signedName = /^tag (.+)$/m.exec((await git('cat-file', 'tag', latest)).stdout)?.[1]?.trim()
  if (signedName !== latest) {
    return `Tag ${latest} không khớp tên tag đã ký (${signedName ?? 'không có'}); không cập nhật.`
  }

  const head = (await git('rev-parse', 'HEAD')).stdout.trim()
  const target = (await git('rev-parse', `${latest}^{commit}`)).stdout.trim()
  // Fail closed: refuse any tag not newer than the version this checkout is built from.
  const current = await git('describe', '--tags', '--abbrev=0', 'HEAD')
  if (current.exitCode !== 0 || !current.stdout.trim()) {
    return 'Không xác định được phiên bản hiện tại; không cập nhật.'
  }
  if (head !== target && compareVersions(latest, current.stdout.trim()) <= 0) {
    return `${latest} cũ hơn bản đang chạy (${current.stdout.trim()}); không hạ phiên bản.`
  }

  if (head === target) return `Đã ở bản mới nhất ${latest}.`

  const out = await git('checkout', '--detach', latest)
  if (out.exitCode !== 0) return `Không chuyển sang ${latest} được (git checkout lỗi):\n${out.stderr}`

  // Reload only after a real checkout, so autoupdate on session start does not reload every time.
  // Runs after this hook returns: $.command.run rejects inside a hook the turn waits on.
  $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }))
  return `Đã cập nhật lên ${latest}; đang nạp lại plugin.`
}
