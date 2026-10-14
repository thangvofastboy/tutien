"""Chuẩn hóa ảnh do AI vẽ: xóa nền xanh #00FF00 thành trong suốt, thu về 96×96 (nearest neighbor).

Dùng: python3 scripts/prepare_art.py [thư mục, mặc định assets/realms]
Ghi đè từng file PNG tại chỗ. Ảnh JPG được đổi thành PNG cùng tên.
"""
import pathlib, sys
from PIL import Image

SIZE = 96

def is_key_green(r: int, g: int, b: int) -> bool:
    # Chịu được nhiễu nén: xanh lá chiếm ưu thế rõ rệt so với đỏ và lam.
    return g > 180 and r < 90 and b < 90

def prepare(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    if im.size != (SIZE, SIZE):
        im = im.resize((SIZE, SIZE), Image.NEAREST)
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            if is_key_green(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return im

def run(root: pathlib.Path) -> int:
    n = 0
    for f in sorted(list(root.rglob('*.png')) + list(root.rglob('*.jpg')) + list(root.rglob('*.jpeg'))):
        out = prepare(Image.open(f))
        target = f.with_suffix('.png')
        out.save(target)
        if target != f:
            f.unlink()
        n += 1
    return n

if __name__ == '__main__':
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/realms')
    print(f'{run(root)} ảnh đã chuẩn hóa trong {root}')
