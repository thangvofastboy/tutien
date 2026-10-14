"""Đổi ảnh nhân vật thành ô nửa khối ▀ có màu, đóng gói cho element Raster (spec mục 8, 19.5).

Mỗi ảnh 96×96 → thu xuống 48×48 điểm (lấy trung bình) → 48 cột × 24 dòng ô.
Mỗi ô: [mã ký tự ▀, màu trên 0x00RRGGBB, màu dưới 0x00RRGGBB], u32 little-endian, rồi base64.

Chạy: python3 scripts/build_cells.py   → assets/cells/<lớp>/<giới>/NN.b64
"""
import base64, pathlib, struct
from PIL import Image

COLS, ROWS = 48, 24
GLYPH = 0x2580  # ▀
CLASSES = ['Kiếm Tu', 'Đan Sư', 'Trận Pháp Sư', 'Luyện Khí Sư', 'Phù Tu', 'Thể Tu', 'Ma Tu']
GENDERS = ['Nam', 'Nữ']
ROOT = pathlib.Path(__file__).resolve().parent.parent

DEFAULT = 0x01000000  # Raster: màu mặc định của terminal (dùng cho điểm trong suốt)

def _color(px) -> int:
    r, g, b, a = px
    return DEFAULT if a < 128 else (r << 16) | (g << 8) | b

def encode_cells(im: Image.Image) -> str:
    small = im.convert('RGBA').resize((COLS, COLS), Image.BOX)  # thu xuống 48×48, lấy trung bình
    buf = bytearray()
    for y in range(ROWS):
        for x in range(COLS):
            top = _color(small.getpixel((x, 2 * y)))
            bot = _color(small.getpixel((x, 2 * y + 1)))
            buf += struct.pack('<III', GLYPH, top, bot)
    return base64.b64encode(bytes(buf)).decode('ascii')

def build(src: pathlib.Path, out: pathlib.Path, classes, genders, realms):
    for c in classes:
        for g in genders:
            (out / c / g).mkdir(parents=True, exist_ok=True)
            for r in realms:
                f = src / c / g / f'{r:02d}.png'
                if not f.exists():
                    f = src / c / g / f'{r:02d}-1.png'  # ảnh do gen_realms.py tạo
                if not f.exists():
                    continue
                im = Image.open(f)
                (out / c / g / f'{r:02d}.b64').write_text(encode_cells(im), encoding='ascii')

if __name__ == '__main__':
    src = ROOT / 'assets' / 'realms'
    out = ROOT / 'assets' / 'cells'
    build(src, out, CLASSES, GENDERS, range(1, 34))
    print(f'ô đã ghi vào {out}')
