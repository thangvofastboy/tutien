import base64, io, pathlib, sys, tempfile
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import avatar

def test_portrait_jpeg_letterboxed_to_square():
    with tempfile.TemporaryDirectory() as d:
        f = pathlib.Path(d) / 'a.jpg'
        Image.new('RGB', (40, 200), (255, 0, 0)).save(f)  # ảnh dọc, JPEG
        out = avatar.convert(str(f))
        im = Image.open(io.BytesIO(base64.b64decode(out['png'])))
        assert im.size == (96, 96)
        assert im.getpixel((0, 48))[3] == 0          # hai bên trong suốt, không kéo méo
        assert im.getpixel((48, 48))[0] > 200        # giữa là ảnh đỏ
        assert len(base64.b64decode(out['cells'])) == 48 * 24 * 12

def test_file_is_absolute_and_tilde_expanded():
    with tempfile.TemporaryDirectory(dir=pathlib.Path.home()) as d:
        f = pathlib.Path(d) / 'b.png'
        Image.new('RGBA', (10, 10), (0, 255, 0, 255)).save(f)
        out = avatar.convert('~/' + str(f.relative_to(pathlib.Path.home())))
        assert out['file'] == str(f.resolve())
