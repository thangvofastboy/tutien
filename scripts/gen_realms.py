"""Sinh ảnh nhân vật theo lớp, giới, bậc và khung hào quang (spec mục 8, 15).

Chạy: python3 scripts/gen_realms.py   → assets/realms/<lớp>/<giới>/NN-F.png (1.386 file)
Deterministic: cùng lớp, giới, bậc, khung → cùng bytes.
"""
import hashlib, pathlib, random
from PIL import Image, ImageDraw

SIZE = 96
CLASSES = ['Kiếm Tu', 'Đan Sư', 'Trận Pháp Sư', 'Luyện Khí Sư', 'Phù Tu', 'Thể Tu', 'Ma Tu']
GENDERS = ['Nam', 'Nữ']
REALMS = 33
FRAMES = (1, 2, 3)
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'realms'

# Mỗi đại cảnh giới một kiểu hào quang (spec 15): (tên, màu gốc, số vòng, kiểu)
MAJOR_AURA = [
    ('sương', (170, 200, 190), 1, 'mist'),        # Luyện Khí
    ('vòng nhạt', (150, 220, 180), 1, 'ring'),    # Trúc Cơ
    ('quầng vàng', (230, 190, 90), 2, 'ring'),    # Kim Đan
    ('hai vòng', (200, 170, 240), 2, 'ring'),     # Nguyên Anh
    ('lửa linh hồn', (255, 130, 60), 3, 'flame'), # Hóa Thần
    ('gợn hư không', (150, 110, 230), 3, 'ripple'),# Luyện Hư
    ('trời đất', (80, 160, 210), 3, 'ring'),      # Hợp Thể
    ('vầng sen', (240, 150, 190), 4, 'petal'),    # Đại Thừa
    ('sét quanh người', (120, 200, 255), 4, 'bolt'),# Độ Kiếp
    ('tia nắng', (255, 240, 170), 5, 'ray'),      # Chân Tiên
    ('vương miện', (255, 215, 100), 6, 'crown'),  # Tiên Đế
]

def palette(cls: str):
    h = int(hashlib.sha256(cls.encode()).hexdigest(), 16)
    rng = random.Random(h)
    return [tuple(rng.randrange(40, 230) for _ in range(3)) for _ in range(3)]

def _aura(d, realm, frame, glow):
    group = min((realm - 1) // 3, len(MAJOR_AURA) - 1)
    sub = (realm - 1) % 3                      # 0 sơ, 1 trung, 2 hậu: sáng dần
    _, base, rings, kind = MAJOR_AURA[group]
    strength = 0.45 + 0.25 * sub               # độ rõ tăng theo kỳ
    breath = (-4, 0, 4)[frame - 1]             # 3 khung: co, vừa, giãn
    col = tuple(int(c * strength + g * (1 - strength)) for c, g in zip(base, glow))
    for i in range(rings):
        r = 46 - i * 6 + breath
        d.ellipse([SIZE / 2 - r, SIZE / 2 - r, SIZE / 2 + r, SIZE / 2 + r], outline=col)
    if kind == 'mist':
        d.rectangle([0, SIZE - 14 + breath // 2, SIZE, SIZE], fill=col)
    elif kind == 'flame':
        for x in range(12, SIZE, 14):
            d.line([(x, SIZE - 10), (x + breath, SIZE - 22)], fill=col, width=2)
    elif kind == 'petal':
        for k in range(8):
            a = k * 0.785
            x, y = SIZE / 2 + 44 * (0.9 * __import__('math').cos(a)), SIZE / 2 + 44 * (0.9 * __import__('math').sin(a))
            d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col)
    elif kind == 'ray':
        for k in range(10):
            a = k * 0.628
            d.line([(SIZE / 2, SIZE / 2), (SIZE / 2 + 46 * __import__('math').cos(a), SIZE / 2 + 46 * __import__('math').sin(a))], fill=col)

def frame(cls: str, gender: str, realm: int, frame_idx: int) -> Image.Image:
    rng = random.Random(f'{cls}|{gender}|{realm}')
    img = Image.new('RGB', (SIZE, SIZE), (18, 20, 32))
    d = ImageDraw.Draw(img)
    main, accent, glow = palette(cls)
    _aura(d, realm, frame_idx, glow)
    shoulder = 18 if gender == 'Nam' else 14
    d.ellipse([SIZE / 2 - 7, 18, SIZE / 2 + 7, 34], fill=main)
    d.polygon([(SIZE / 2 - shoulder, 40), (SIZE / 2 + shoulder, 40), (SIZE / 2 + 10, 78), (SIZE / 2 - 10, 78)], fill=main)
    d.rectangle([SIZE / 2 - 2, 40, SIZE / 2 + 2, 60], fill=accent)
    if realm >= 25:
        for _ in range(3):
            x = rng.randrange(8, SIZE - 8)
            d.line([(x, 0), (x + rng.randrange(-6, 6), SIZE // 2)], fill=glow, width=2)
    return img

def render(out: pathlib.Path, cls: str, gender: str, realm: int):
    path = out / cls / gender
    path.mkdir(parents=True, exist_ok=True)
    for f in FRAMES:
        frame(cls, gender, realm, f).save(path / f'{realm:02d}-{f}.png')

def all_paths(out: pathlib.Path):
    return [out / c / g / f'{r:02d}-{f}.png' for c in CLASSES for g in GENDERS for r in range(1, REALMS + 1) for f in FRAMES]

if __name__ == '__main__':
    n = 0
    for c in CLASSES:
        for g in GENDERS:
            for r in range(1, REALMS + 1):
                render(OUT, c, g, r)
                n += 1
    print(f'{n * len(FRAMES)} ảnh -> {OUT}')
