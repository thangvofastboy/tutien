"""Xem trước ảnh bằng ký tự nửa ô ▀ có màu 24-bit, chạy được trên terminal không hỗ trợ ảnh.

Dùng: python3 scripts/preview_halfblock.py <ảnh> [số cột, mặc định 48]
"""
import sys
from PIL import Image

def render(path: str, cols: int = 48) -> str:
    im = Image.open(path).convert('RGBA')
    w = cols
    h = max(2, round(im.height * w / im.width))
    h += h % 2  # cần số dòng điểm ảnh chẵn: mỗi ô ký tự chứa 2 điểm
    im = im.resize((w, h), Image.NEAREST)
    bg = (18, 20, 31)  # nền navy giống bộ ảnh
    def px(x, y):
        r, g, b, a = im.getpixel((x, y))
        if a < 128:
            return bg
        return (r, g, b)
    lines = []
    for y in range(0, h, 2):
        row = []
        for x in range(w):
            (r1, g1, b1), (r2, g2, b2) = px(x, y), px(x, y + 1)
            row.append(f'\x1b[38;2;{r1};{g1};{b1}m\x1b[48;2;{r2};{g2};{b2}m▀')
        lines.append(''.join(row) + '\x1b[0m')
    return '\n'.join(lines)

if __name__ == '__main__':
    print(render(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 48))
