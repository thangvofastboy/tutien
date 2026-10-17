// hooks/more.ts — lệnh mở rộng của /tutien (spec 18, 20, 21.4, 25) và liên kết máy, đổi tên.
import { callServer, SERVER } from './api'
import { historyChart, statusLines, findLines, libraryLines, realmGroup } from './views'
import { REALM_NAMES, type Player } from './rules'

type Res = { ok: boolean; status: number; data?: any; error?: string; upgrade?: boolean }
const fail = (r: Res, fallback = 'Server không phản hồi.') =>
  r.upgrade ? 'Server chưa nhận phiên bản mod này. Chạy /tutien update.' : r.status === 0 ? 'Chưa ghi danh. Dùng /tutien start.' : (r.error ?? fallback)
const say = (r: Res) => (r.ok ? (r.data?.text ?? 'Xong.') : fail(r))

async function publicGet($: any, path: string): Promise<any | null> {
  const res = await $.http.fetch(`${SERVER}${path}`, { method: 'GET' }).catch(() => null)
  return res?.ok ? JSON.parse(res.text) : null
}
function social($: any, body: object) {
  return callServer($, '/social', body)
}

export const MORE_HELP = [
  '/tutien history (h)                     biểu đồ 14 ngày và nhật ký tuần',
  '/tutien tim <tên>                       xem một đạo hữu',
  '/tutien team                            tiến độ team, sự kiện, lễ hội sắp tới',
  '/tutien thu-vien                        thư viện pháp bảo, đan, huy hiệu',
  '/tutien tong tao|vao <tên> · roi · xem  tông môn',
  '/tutien tong bo-nhiem <tên> <chức vụ>   tông chủ bổ nhiệm',
  '/tutien ban|dao-lu <tên> · chap-nhan <tên> · huy',
  '/tutien chuc-mung <tên>                 chúc mừng người vừa đột phá',
  '/tutien bicanh                          ghi danh bí cảnh tháng (ngày 1–2)',
  '/tutien luyen-dan · uong-dan <loại>     ho-the, toc-tu, thong-thien',
  '/tutien be-quan <ngày> · be-quan xuat-quan',
  '/tutien cho · mua <món> · trang-bi <món> · doi-phap-bao <e|t|d>',
  '/tutien lien-ket · dang-nhap <tên> <mã> dùng chung nhân vật trên máy khác (cùng tài khoản Claude)',
  '/tutien doi-ten <tên mới>               đổi tên nhân vật (7 ngày một lần)',
].join('\n')

export async function statusText($: any): Promise<string> {
  const r = await callServer<{ player: Player; status: any; social: any }>($, '/status')
  if (!r.ok || !r.data) return fail(r)
  const name = ((await $.store.get('tutien.name')) as string) ?? ''
  return statusLines(name, r.data.player, r.data.status, r.data.social, Date.now()).join('\n')
}

// Trả về chữ cho lệnh mở rộng, hoặc null nếu không phải lệnh mở rộng.
export async function runMore($: any, sub: string, rest: string[], tail: string): Promise<string | null> {
  const arg = (i: number) => (rest[i] ?? '').trim()
  switch (sub) {
    case 'history': case 'h': case 'nhat-ky': {
      const r = await callServer<{ days: { day: string; pct: number }[]; journal: string[] }>($, '/history')
      if (!r.ok || !r.data) return fail(r)
      return [...(sub === 'nhat-ky' ? [] : historyChart(r.data.days)), '', ...r.data.journal].join('\n')
    }
    case 'tim': {
      if (!tail) return 'Dùng: /tutien tim <tên>'
      const f = await publicGet($, `/find?name=${encodeURIComponent(tail)}`)
      return f ? findLines(f, Date.now()).join('\n') : `Không tìm thấy đạo hữu "${tail}".`
    }
    case 'team': {
      const t = await publicGet($, '/team')
      if (!t) return 'Server không phản hồi.'
      const out = [
        `🌏 Tiến độ toàn team: ${t.progress}% (${t.players} đạo hữu)`,
        `🤝 Thử thách cộng đồng tháng này: ${t.community.pct}%${t.community.rewardActive ? ' · tháng này có bộ thoại đặc biệt' : ''}`,
        `☯️ ${t.event.name}: ${t.event.desc}${t.event.active ? ' (đang diễn ra)' : ''}`,
      ]
      if (t.recent.length) out.push(`✨ Vừa đột phá: ${t.recent.map((r: any) => `${r.name} (${REALM_NAMES[r.realm - 1]})`).join(', ')}`)
      for (const h of t.holidays ?? []) out.push(`🎊 ${h.name}: ${h.days[0]}${h.days.length > 1 ? ` → ${h.days[h.days.length - 1]}` : ''}`)
      return out.join('\n')
    }
    case 'thu-vien': {
      const lib = await publicGet($, '/library')
      if (!lib) return 'Server không phản hồi.'
      const me = await callServer<{ status: any }>($, '/status')
      const have = me.ok && me.data ? { artifacts: me.data.status.artifacts, badges: me.data.status.badges, inventory: me.data.status.inventory } : null
      return libraryLines(lib, have).join('\n')
    }
    case 'tong': {
      const op = arg(0)
      const name = rest.slice(1).join(' ').trim()
      if (op === 'tao') return say(await social($, { op: 'tong-tao', name }))
      if (op === 'vao') return say(await social($, { op: 'tong-vao', name }))
      if (op === 'roi') return say(await social($, { op: 'tong-roi' }))
      if (op === 'bo-nhiem') return say(await social($, { op: 'tong-bo-nhiem', target: arg(1), role: arg(2) }))
      const target = name || (await callServer<{ social: any }>($, '/status')).data?.social?.tong?.name
      if (!target) return 'Đạo hữu chưa ở tông nào. /tutien tong tao <tên> (cần bậc 10) hoặc /tutien tong vao <tên>.'
      const t = await publicGet($, `/tong-info?name=${encodeURIComponent(target)}`)
      if (!t || t.error) return `Không có tông "${target}".`
      return [`🏯 ${t.name} · Tông Chủ ${t.owner} · nhiệm vụ tuần ${t.week.pct}%${t.week.lastOk ? '' : ' · tuần trước chưa đạt, bonus chức vụ tạm dừng'}`,
        ...t.members.map((m: any) => `   ${m.role}: ${m.name} · ${REALM_NAMES[m.realm - 1] ?? ''}${m.weak ? ' · tuần trước góp chưa đủ' : ''}`)].join('\n')
    }
    case 'ban': case 'dao-lu': {
      const op = arg(0)
      if (!op) return `Dùng: /tutien ${sub} <tên> · ${sub} chap-nhan <tên> · ${sub} huy`
      if (op === 'chap-nhan') return say(await social($, { op: 'accept', from: arg(1), kind: sub }))
      if (op === 'huy') return say(await social($, { op: 'unpair', kind: sub }))
      return say(await social($, { op: 'invite', to: op, kind: sub }))
    }
    case 'chuc-mung': return tail ? say(await social($, { op: 'congrats', to: tail })) : 'Dùng: /tutien chuc-mung <tên>'
    case 'bicanh': return say(await callServer($, '/bicanh', {}))
    case 'luyen-dan': return arg(0) ? say(await callServer($, '/pill', { action: 'craft', kind: arg(0) })) : 'Dùng: /tutien luyen-dan ho-the|toc-tu|thong-thien'
    case 'uong-dan': return arg(0) ? say(await callServer($, '/pill', { action: 'use', kind: arg(0) })) : 'Dùng: /tutien uong-dan ho-the|toc-tu|thong-thien'
    case 'be-quan': {
      if (arg(0) === 'xuat-quan') return say(await callServer($, '/bequan', { end: true }))
      return arg(0) ? say(await callServer($, '/bequan', { days: Number(arg(0)) })) : 'Dùng: /tutien be-quan <1–14 ngày> hoặc /tutien be-quan xuat-quan'
    }
    case 'cho': {
      const lib = await publicGet($, '/library')
      const me = await callServer<{ status: any }>($, '/status')
      if (!lib) return 'Server không phản hồi.'
      return ['🛍️ Chợ Phường Thị', `💎 Linh thạch của đạo hữu: ${me.data?.status.linhThach ?? 0}`, '',
        ...Object.entries<any>(lib.shop).filter(([, v]) => v.buyable).map(([k, v]) => `  ${v.name}: ${v.price} linh thạch → /tutien mua ${k}`),
        '', 'Đổi pháp bảo thừa: /tutien doi-phap-bao <e|t|d|E|T|D> (thường 10, hiếm 25 linh thạch)'].join('\n')
    }
    case 'mua': return arg(0) ? say(await callServer($, '/shop', { action: 'buy', id: arg(0) })) : 'Dùng: /tutien mua <món>'
    case 'trang-bi': return say(await callServer($, '/shop', { action: 'equip', id: arg(0) === 'bo' ? '' : arg(0) }))
    case 'doi-phap-bao': return arg(0) ? say(await callServer($, '/shop', { action: 'sell', id: arg(0) })) : 'Dùng: /tutien doi-phap-bao <e|t|d|E|T|D>'
    case 'lien-ket': {
      const r = await callServer<{ code: string; minutes: number }>($, '/link-code', {})
      if (!r.ok || !r.data) return fail(r)
      const name = (await $.store.get('tutien.name')) as string
      return `🔗 Mã liên kết: ${r.data.code} (hết hạn sau ${r.data.minutes >= 60 ? `${Math.round(r.data.minutes / 60)} giờ` : `${r.data.minutes} phút`}, dùng một lần).\nTrên máy kia (cùng tài khoản Claude), gõ: /tutien dang-nhap ${name} ${r.data.code}`
    }
    case 'dang-nhap': {
      const name = arg(0), code = arg(1)
      if (!name || !code) return 'Dùng: /tutien dang-nhap <tên> <mã> (lấy mã bằng /tutien lien-ket trên máy đang có nhân vật)'
      const oldName = (await $.store.get('tutien.name')) as string | undefined
      const oldKey = (await $.store.get('tutien.key')) as string | undefined
      const res = await $.http.fetch(`${SERVER}/link`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tutien-version': String((await $.store.get('tutien.version')) ?? ''),
          'x-tutien-account': String((await $.store.get('tutien.account')) ?? ''),
        },
        body: JSON.stringify({ name, code }),
      }).catch(() => null)
      if (!res) return 'Không kết nối được server.'
      if (res.status === 426) return 'Server chưa nhận phiên bản mod này. Chạy /tutien update.'
      const data = JSON.parse(res.text || '{}')
      if (!res.ok) return data.error ?? `Liên kết thất bại (${res.status}).`
      // Máy này đã có nhân vật riêng (khác nhân vật liên kết): gộp hết vào nhân vật chính rồi xóa nhân vật cũ.
      let merged = ''
      if (oldName && oldKey && oldName.toLowerCase() !== name.toLowerCase()) {
        const m = await $.http.fetch(`${SERVER}/merge?name=${encodeURIComponent(oldName)}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${oldKey}`,
            'content-type': 'application/json',
            'x-tutien-version': String((await $.store.get('tutien.version')) ?? ''),
            'x-tutien-account': String((await $.store.get('tutien.account')) ?? ''),
          },
          body: JSON.stringify({ into: name, intoKey: data.key }),
        }).catch(() => null)
        const out = m?.ok ? JSON.parse(m.text || '{}') : null
        // Gộp hỏng: giữ khóa của nhân vật cũ trên máy này (không thì mất hẳn quyền vào nhân vật cũ).
        if (!out) return `⚠️ Chưa gộp được nhân vật cũ ${oldName} vào ${name}; máy này vẫn dùng ${oldName}. Tạo mã mới bằng /tutien lien-ket trên máy kia rồi gõ lại /tutien dang-nhap.`
        merged = `\n➕ Đã gộp nhân vật cũ ${oldName} vào ${name} (+${out.gained} EXP, cộng cả linh thạch, pháp bảo, huy hiệu); nhân vật cũ đã xóa.`
      }
      await $.store.set('tutien.key', data.key)
      await $.store.set('tutien.name', name)
      return `🔗 Đã liên kết. Máy này dùng chung nhân vật ${name}.${merged}`
    }
    case 'doi-ten': {
      if (!tail) return 'Dùng: /tutien doi-ten <tên mới>'
      const r = await callServer<{ name: string }>($, '/rename', { to: tail })
      if (!r.ok || !r.data) return fail(r)
      await $.store.set('tutien.name', r.data.name)
      return `✍️ Đã đổi đạo hiệu thành ${r.data.name}. Các máy khác đã liên kết cũng cần gõ lại /tutien dang-nhap.`
    }
    default: return null
  }
}

// Bảng gộp gọn cho /tutien top: tông, tháp, đại cảnh giới của mình.
export async function extraBoards($: any, me: string, realm: number | undefined): Promise<string[]> {
  const out: string[] = []
  const tong = await publicGet($, '/leaderboard?board=tong')
  if (tong?.rows?.length) out.push(['— Tông môn —', ...tong.rows.map((r: any) => `${r.rank}. ${r.name} · ${r.cls} · tổng tu vi ${r.score}`)].join('\n'))
  const thap = await publicGet($, `/leaderboard?board=thap&me=${encodeURIComponent(me)}`)
  if (thap?.rows?.length) out.push(['— Tháp Thử Luyện —', ...thap.rows.map((r: any) => `${r.rank}. ${r.name} · ${r.cls} · tầng ${r.score / 10}`)].join('\n'))
  if (realm) {
    const major = Math.floor((realm - 1) / 3)
    const g = await publicGet($, `/leaderboard?board=canh-gioi&major=${major}&me=${encodeURIComponent(me)}`)
    if (g?.rows?.length) out.push([`— ${realmGroup(realm)} —`, ...g.rows.map((r: any) => `${r.rank}. ${r.name} · ${r.cls} · ${REALM_NAMES[r.realm - 1]} · ${r.score}%`)].join('\n'))
  }
  return out
}
