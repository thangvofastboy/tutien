import base64, pathlib, struct, sys, tempfile
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import build_cells as b

def test_cell_count_and_format():
    im = Image.new('RGB', (96, 96), (10, 20, 30))
    data = base64.b64decode(b.encode_cells(im))
    assert len(data) == 48 * 24 * 12  # 48 cột × 24 dòng × 3 u32 × 4 byte

def test_top_and_bottom_colors_and_glyph():
    im = Image.new('RGB', (96, 96), (0, 0, 0))
    for x in range(96):
        for y in range(48):
            im.putpixel((x, y), (255, 0, 0))   # nửa trên 48 dòng gốc đỏ
    data = base64.b64decode(b.encode_cells(im))
    cell = lambda i: struct.unpack_from('<III', data, i * 12)
    cp, fg, bg = cell(0)                        # dòng ô 0: cả hai điểm đều trong vùng đỏ
    assert cp == 0x2580 and fg == 0x00FF0000 and bg == 0x00FF0000
    cp, fg, bg = cell(12 * 48)                  # dòng ô 12: nằm ở ranh giới, phần dưới đen
    assert fg == 0x00000000 and bg == 0x00000000

def test_build_writes_file(tmp_path=None):
    with tempfile.TemporaryDirectory() as d:
        src = pathlib.Path(d) / 'src'; (src / 'Kiếm Tu' / 'Nam').mkdir(parents=True)
        Image.new('RGB', (96, 96), (1, 2, 3)).save(src / 'Kiếm Tu' / 'Nam' / '01-1.png')
        out = pathlib.Path(d) / 'out'
        b.build(src, out, ['Kiếm Tu'], ['Nam'], [1])
        assert (out / 'Kiếm Tu' / 'Nam' / '01.b64').exists()

if __name__ == '__main__':
    import pytest
    raise SystemExit(pytest.main([__file__]))

def test_transparent_pixels_use_terminal_default_color():
    im = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    data = base64.b64decode(b.encode_cells(im))
    cp, fg, bg = struct.unpack_from('<III', data, 0)
    assert fg == 0x01000000 and bg == 0x01000000

def test_build_reads_plain_name():
    with tempfile.TemporaryDirectory() as d:
        src = pathlib.Path(d) / 'src'; (src / 'Ma Tu' / 'Nữ').mkdir(parents=True)
        Image.new('RGBA', (96, 96), (5, 5, 5, 255)).save(src / 'Ma Tu' / 'Nữ' / '01.png')
        out = pathlib.Path(d) / 'out'
        b.build(src, out, ['Ma Tu'], ['Nữ'], [1])
        assert (out / 'Ma Tu' / 'Nữ' / '01.b64').exists()
