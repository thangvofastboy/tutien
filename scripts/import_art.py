"""Nhập file zip ảnh do AI vẽ: đặt từng file vào đúng thư mục theo tên.

Dùng: python3 scripts/import_art.py tutien-art.zip
Quy tắc tên (xem docs/art/prompt-*.md):
  <class>_<gender>_<NN>.png  → assets/realms/<Lớp>/<Giới>/NN.png
  tam-ma_<N>.png             → assets/tamma/N.png
Sau đó chạy prepare_art.py và build_cells.py.
"""
import pathlib, re, sys, zipfile

CLASS = {
    'kiem-tu': 'Kiếm Tu', 'dan-su': 'Đan Sư', 'tran-phap-su': 'Trận Pháp Sư',
    'luyen-khi-su': 'Luyện Khí Sư', 'phu-tu': 'Phù Tu', 'the-tu': 'Thể Tu', 'ma-tu': 'Ma Tu',
}
GENDER = {'nam': 'Nam', 'nu': 'Nữ'}
SPRITE = re.compile(r'^([a-z-]+)_(nam|nu)_(\d{2})\.(png|jpg|jpeg)$')
DEMON = re.compile(r'^tam-ma_([123])\.(png|jpg|jpeg)$')

def target(name: str):
    m = SPRITE.match(name)
    if m and m.group(1) in CLASS and 1 <= int(m.group(3)) <= 33:
        return ('realms', CLASS[m.group(1)], GENDER[m.group(2)], f'{m.group(3)}.{m.group(4)}')
    m = DEMON.match(name)
    if m:
        return ('tamma', None, None, f'{m.group(1)}.{m.group(2)}')
    return None

def expected():
    names = {f'{c}_{g}_{r:02d}' for c in CLASS for g in GENDER for r in range(1, 34)}
    return names | {f'tam-ma_{i}' for i in (1, 2, 3)}

def import_zip(zpath: pathlib.Path, root: pathlib.Path) -> dict:
    placed, bad, seen = 0, [], set()
    with zipfile.ZipFile(zpath) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = pathlib.PurePosixPath(info.filename).name  # bỏ mọi đường dẫn trong zip (chống zip slip)
            t = target(name)
            if t is None:
                bad.append(name)
                continue
            kind, cls, gender, fname = t
            dest = root / 'assets' / kind
            if cls:
                dest = dest / cls / gender
            dest.mkdir(parents=True, exist_ok=True)
            (dest / fname).write_bytes(zf.read(info))
            seen.add(name.rsplit('.', 1)[0])
            placed += 1
    missing = sorted(expected() - seen)
    return {'placed': placed, 'bad_names': bad, 'missing_count': len(missing), 'missing': missing}

if __name__ == '__main__':
    root = pathlib.Path(__file__).resolve().parent.parent
    r = import_zip(pathlib.Path(sys.argv[1]), root)
    print(f"Đã đặt {r['placed']} file.")
    if r['bad_names']:
        print('Sai tên (bỏ qua):', ', '.join(r['bad_names']))
    print(f"Còn thiếu {r['missing_count']} file." + (f" Ví dụ: {', '.join(r['missing'][:10])}" if r['missing'] else ''))
