// hooks/chat.ts — vài dòng chữ trong khung chat ($.ui.log): lời chào khi mở phiên và thông báo sự kiện.
// $.ui.log là dòng ghi chú mờ, không gửi cho Claude, và hiện trên mọi bề mặt (terminal, web, desktop, điện thoại).
import { LINES } from './lines'
import { statusText, stateIcon } from './display'
import type { Player } from './rules'

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Chào buổi sáng'
  if (hour >= 11 && hour < 13) return 'Chào buổi trưa'
  if (hour >= 13 && hour < 18) return 'Chào buổi chiều'
  if (hour >= 18 && hour < 23) return 'Chào buổi tối'
  return 'Khuya rồi, đạo hữu vẫn tu à'
}

const TIPS = [
  '/tutien start để xem lại câu chuyện và tạo nhân vật mới.',
  '/tutien setting để bật tắt khung nhỏ, dòng trạng thái và hiệu ứng.',
  '/tutien top để xem ai đang dẫn đầu tông môn.',
  '/tutien web để mở trang nhân vật trong trình duyệt.',
  '/tutien status để xem tiến độ nhanh.',
]

const FORTUNES = [
  'Hôm nay hợp refactor, kỵ force push.',
  'Linh khí dồi dào, viết test sẽ phát hiện điều bất ngờ.',
  'Có quý nhân review code giúp, nhớ cảm ơn.',
  'Tránh deploy chiều thứ Sáu, Tâm Ma đang rình.',
  'Một con bug cũ sẽ tự lộ diện, đừng hoảng.',
  'Uống nước đủ, đan điền mới vững.',
  'Đọc log trước khi đoán, thiên đạo sẽ mỉm cười.',
]

const at = <T>(list: readonly T[], seed: number) => list[Math.abs(Math.floor(seed)) % list.length]

// Lời chào mở phiên: 4 dòng, chọn mẹo và quẻ theo ngày để cả ngày giống nhau.
export function greetingLines(name: string, p: Player, now: Date): string[] {
  const day = Math.floor(now.getTime() / 86_400_000)
  return [
    `🙏 ${greeting(now.getHours())}, ${name}`,
    `${stateIcon(p)} ${statusText(p, now.getTime())}`,
    `💡 Mẹo: ${at(TIPS, day)}`,
    `🔮 Thiên Cơ Hôm Nay: ${at(FORTUNES, day * 7 + 3)}`,
  ]
}

// Dòng thông báo cho từng sự kiện từ server; tên hiệu ứng viết hoa chữ cái đầu mỗi từ.
export function eventLines(ev: string, seed: number): string[] {
  switch (ev) {
    case 'tribulation-started': return ['⚡ Thiên Phạt Giáng Xuống! Góp đủ token trước hạn để đột phá.']
    case 'breakthrough': return ['✨ Đột Phá Thành Công! Đạo hữu đã lên cảnh giới mới.']
    case 'artifact': return ['🎁 Nhận Được Pháp Bảo! Tu luyện nhanh hơn một chút.']
    case 'tribulation-failed': return ['🌧️ Thiên Phạt Thất Bại. EXP bị mất, cảnh giới giữ nguyên.']
    case 'death': return ['💀 Đan Điền Vỡ Nát! Trở về Luyện Khí Sơ Kỳ.']
    case 'tamma': return ['👹 Tâm Ma Trễ Deadline Xuất Hiện! Dùng đủ token trong 2 giờ để xua đuổi nó.', `   "${at(LINES.tamma, seed)}"`]
    case 'tamma-defeated': return ['🗡️ Xua Đuổi Tâm Ma Thành Công! +5 linh thạch.', `   "${at(LINES.tammaDefeated, seed)}"`]
    case 'tamma-failed': return ['😈 Tâm Ma Cười Lớn Rồi Biến Mất. Đạo hữu mất một chút tiến độ.', `   "${at(LINES.tammaLeaves, seed)}"`]
    default: return []
  }
}
