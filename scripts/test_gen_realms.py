import pathlib, sys, tempfile
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import gen_realms as g

def test_palette_differs_per_class():
    assert g.palette('Kiếm Tu') != g.palette('Đan Sư')

def test_frame_size():
    assert g.frame('Kiếm Tu', 'Nam', 1, 1).size == (g.SIZE, g.SIZE)

def test_deterministic():
    a = g.frame('Kiếm Tu', 'Nam', 7, 2).tobytes()
    b = g.frame('Kiếm Tu', 'Nam', 7, 2).tobytes()
    assert a == b

def test_aura_grows_with_realm_and_frame_moves():
    low = g.frame('Kiếm Tu', 'Nam', 1, 1).tobytes()
    high = g.frame('Kiếm Tu', 'Nam', 30, 1).tobytes()
    assert low != high
    assert g.frame('Kiếm Tu', 'Nam', 10, 1).tobytes() != g.frame('Kiếm Tu', 'Nam', 10, 2).tobytes()

def test_render_writes_named_file():
    with tempfile.TemporaryDirectory() as d:
        g.render(pathlib.Path(d), 'Kiếm Tu', 'Nam', 1)
        for f in (1, 2, 3):
            assert (pathlib.Path(d) / 'Kiếm Tu' / 'Nam' / f'01-{f}.png').exists()

def test_full_count():
    assert len(g.all_paths(pathlib.Path('/x'))) == 7 * 2 * 33 * 3

if __name__ == '__main__':
    import pytest
    raise SystemExit(pytest.main([__file__]))
