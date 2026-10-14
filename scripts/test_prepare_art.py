import pathlib, sys, tempfile
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import prepare_art as p

def test_green_becomes_transparent_and_character_stays():
    im = Image.new('RGB', (192, 192), (0, 255, 0))
    for x in range(80, 112):
        for y in range(40, 160):
            im.putpixel((x, y), (200, 30, 40))
    out = p.prepare(im)
    assert out.size == (96, 96)
    assert out.mode == 'RGBA'
    assert out.getpixel((0, 0))[3] == 0            # nền xanh → trong suốt
    assert out.getpixel((48, 48))[3] == 255        # nhân vật giữ nguyên
    assert out.getpixel((48, 48))[:3] == (200, 30, 40)

def test_near_green_from_jpeg_noise_also_removed():
    im = Image.new('RGB', (96, 96), (8, 247, 12))  # xanh lệch nhẹ như ảnh nén JPG
    assert p.prepare(im).getpixel((10, 10))[3] == 0

def test_run_folder():
    with tempfile.TemporaryDirectory() as d:
        src = pathlib.Path(d) / 'Kiếm Tu' / 'Nam'; src.mkdir(parents=True)
        Image.new('RGB', (96, 96), (0, 255, 0)).save(src / '01.png')
        n = p.run(pathlib.Path(d))
        assert n == 1
        assert Image.open(src / '01.png').mode == 'RGBA'

if __name__ == '__main__':
    import pytest
    raise SystemExit(pytest.main([__file__]))
