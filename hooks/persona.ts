// hooks/persona.ts — tính cách nhân vật: chỉ đổi giọng nói, không đổi luật (spec mục 17).
export type Persona = { id: string; name: string; catchphrase: string; lines: string[] }

export const PERSONAS: Persona[] = [
  { id: 'lam-loi', name: 'Lầy Lội', catchphrase: 'Tu thì tu, nhưng cười cái đã.',
    lines: ['Tu thì tu, nhưng cười cái đã.', 'Tâm ma cũng phải cười khi thấy mặt ta.', 'Đan điền của ta rỗng, nhưng tiếng cười thì đầy.', 'Ta vừa đột phá xong, đi ăn bánh bao nào!', 'Lên bậc rồi, nhớ đừng quên mời ta một chầu.', 'Thiên kiếp? Nghe như tên một quán trà.'] },
  { id: 'lanh-lung', name: 'Lạnh Lùng', catchphrase: 'Hừ.',
    lines: ['Hừ.', 'Không cần nói nhiều. Tu là đủ.', 'Thiên kiếp đến, ta đứng yên.', 'Nhìn đủ rồi thì tiếp tục.', 'Lạnh là cách ta bảo vệ đạo tâm.', 'Đừng hỏi. Ta không muốn trả lời.'] },
  { id: 'hien-lanh', name: 'Hiền Lành', catchphrase: 'Không sao đâu, từ từ mà tu.',
    lines: ['Không sao đâu, từ từ mà tu.', 'Trượt rồi cũng không sao, lần sau sẽ được.', 'Ngươi đã cố gắng nhiều rồi, nghỉ một chút đi.', 'Đừng nóng vội, đường tu còn dài.', 'Ta tin ngươi sẽ vượt qua được.', 'Uống chén trà rồi tiếp tục nhé.'] },
  { id: 'kieu-ngao', name: 'Kiêu Ngạo', catchphrase: 'Thiên phạt? Chỉ đáng làm khởi động.',
    lines: ['Thiên phạt? Chỉ đáng làm khởi động.', 'Đám mây kia cũng phải cúi đầu trước ta.', 'Ta không cần giúp, chỉ cần đứng nhìn.', 'Các ngươi tu chậm quá, nhìn ta đây.', 'Thiên đạo cũng phải nể ta một chút.', 'Đừng than khó, chỉ có kẻ yếu mới than.'] },
  { id: 'luoi-bieng', name: 'Lười Biếng', catchphrase: 'Để mai tu tiếp.',
    lines: ['Để mai tu tiếp.', 'Ngủ thêm năm phút nữa, đạo tâm vẫn đợi.', 'Tu luyện mệt quá, ta nằm nghỉ chút.', 'Việc gì để sau cũng được, miễn là có trà.', 'Ngủ gật cũng là một cách thiền.', 'Thiên kiếp đến thì gọi ta dậy.'] },
  { id: 'cuong-code', name: 'Cuồng Code', catchphrase: 'git commit -m "đột phá"',
    lines: ['git commit -m "đột phá"', 'Ta vừa push một bậc mới lên production.', 'Lỗi này không phải của ta, là của môi trường.', 'Đạo tâm đã được test đầy đủ.', 'Thiên kiếp là một cái CI đỏ lớn.', 'Đừng merge trước khi ta review.'] },
  { id: 'triet-gia', name: 'Triết Gia', catchphrase: 'Token là gì, nếu không phải là thời gian?',
    lines: ['Token là gì, nếu không phải là thời gian?', 'Tu tiên là đi tìm điều mình chưa hỏi.', 'Cái đích là một câu hỏi, không phải một con số.', 'Đột phá để làm gì, khi đường đi đã đẹp?', 'Ngươi có chắc mình đang tu, hay đang chờ?', 'Thiên đạo không trả lời, chỉ im lặng và đợi.'] },
]

export const personaById = (id: string) => PERSONAS.find(p => p.id === id) ?? null

// Prompt gửi model khi người chơi tự mô tả tính cách: mô tả cắt ở 200 ký tự, yêu cầu đúng 15 câu.
export function buildPersonaPrompt(desc: string): string {
  const d = desc.slice(0, 200)
  return [
    'Viết đúng 15 câu thoại ngắn cho một nhân vật tu tiên trong game hài, bằng tiếng Việt.',
    `Tính cách: ${d}`,
    'Mỗi câu dưới 120 ký tự, một câu trên mỗi dòng, không đánh số, không giải thích.',
    'Giữ giọng hài nhẹ, không xúc phạm ai, không dùng chữ Hán hay chữ nước ngoài.',
  ].join('\n')
}

// Phân tích phản hồi model: bỏ dòng rỗng, cắt câu dài, tối đa 15 câu.
export function parsePersonaLines(raw: string): string[] {
  return raw
    .split('\n')
    .map(l => l.trim().replace(/^\d+[.)]\s*/, ''))
    .filter(l => l.length > 0)
    .map(l => (l.length > 120 ? l.slice(0, 120) : l))
    .slice(0, 15)
}

// Chọn thoại: nửa số lần lấy từ persona, nửa còn lại lấy từ thoại chung (tất định theo seed).
export function pickPersonaLine(p: Persona, seed: number, common: string[] = []): string {
  const pool = seed % 2 === 0 || common.length === 0 ? p.lines : common
  return pool[Math.abs(seed) % pool.length]
}
