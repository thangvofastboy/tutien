// hooks/effects.ts — logic hiệu ứng thuần (spec 14, 15, 19.7). Không đụng DOM hay mạng.

// Chạy chữ: đưa ra số ký tự hiện và thời gian chờ tới bước kế.
// Dừng 400 ms sau dấu kết thúc câu, 150 ms sau dấu phẩy, 25 ms cho ký tự thường.
export function typeStep(full: string, shownCount: number, reduced: boolean): { shown: string; next: number } {
  if (reduced) return { shown: full, next: 0 }
  const shown = full.slice(0, shownCount)
  const ch = full.charAt(shownCount - 1)
  const next = '.!?'.includes(ch) ? 400 : ',:;'.includes(ch) ? 150 : 25
  return { shown, next }
}

// Hào quang: khung 1, 2, 3 lặp lại (400 ms mỗi khung ở pane).
export const auraFrame = (tick: number) => (tick % 3) + 1

// Hiệu ứng thiên phạt theo sự kiện của server (spec 14).
export function tribEffect(event: string): { kind: 'lightning' | 'gold' | 'rain' | 'red' | 'tamma'; ms: number } | null {
  switch (event) {
    case 'tribulation-started': return { kind: 'lightning', ms: 4000 }
    case 'breakthrough': return { kind: 'gold', ms: 1500 }
    case 'tribulation-failed': return { kind: 'rain', ms: 3000 }
    case 'death': return { kind: 'red', ms: 1000 }
    case 'tamma': return { kind: 'tamma', ms: 3000 }
    default: return null
  }
}

// Khung hình chữ cho overlay: nhịp đổi theo tick (mỗi 250 ms ở pane).
export function overlayFrame(kind: 'lightning' | 'gold' | 'rain' | 'red' | 'tamma', tick: number): string {
  const t = tick % 4
  switch (kind) {
    case 'lightning': return ['  ╱╲⚡╱╲  ', ' ⚡ ╲╱ ⚡ ', '  ╲⚡╱   ', ' ⚡╱╲⚡╱  '][t]
    case 'gold': return ['✦ ✧ Đột Phá ✧ ✦', '✧ ✦ Đột Phá ✦ ✧', '✦ ✧ Đột Phá ✧ ✦', '✧ ✦ Đột Phá ✦ ✧'][t]
    case 'rain': return ['ˇ  ˇ  ˇ  ˇ', ' ˇ  ˇ  ˇ  ˇ', 'ˇ  ˇ  ˇ  ˇ ', ' ˇ  ˇ  ˇ  ˇ'][t]
    case 'red': return ['✖ Đan Điền Vỡ ✖', '✖ Đan Điền Vỡ ✖', '  ✖ Vỡ ✖  ', '✖ Đan Điền Vỡ ✖'][t]
    case 'tamma': return ['👹 Tâm Ma Trễ Deadline', '  👹 Tâm Ma Trễ Deadline', '👹 Tâm Ma Trễ Deadline  ', ' 👹 Tâm Ma Trễ Deadline '][t]
  }
}

// Hiệu ứng còn hiệu lực tại thời điểm now (until là mốc kết thúc, không tính).
export const effectActive = (e: { kind: string; until: number } | null, now: number) => !!e && now < e.until
