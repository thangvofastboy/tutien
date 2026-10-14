import pathlib, sys, tempfile, zipfile
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import import_art as ia

def _png(path):
    Image.new('RGB', (96, 96), (0, 255, 0)).save(path)

def test_parse_names():
    assert ia.target('kiem-tu_nam_07.png') == ('realms', 'Kiếm Tu', 'Nam', '07.png')
    assert ia.target('tran-phap-su_nu_33.png') == ('realms', 'Trận Pháp Sư', 'Nữ', '33.png')
    assert ia.target('tam-ma_2.png') == ('tamma', None, None, '2.png')
    assert ia.target('kiem-tu_nam_34.png') is None      # bậc ngoài 1–33
    assert ia.target('Kiem Tu Nam 07.png') is None      # sai quy tắc
    assert ia.target('kiem-tu_nam_7.png') is None       # bậc phải 2 chữ số

def test_import_zip_places_files_and_reports():
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        for n in ['kiem-tu_nam_01.png', 'ma-tu_nu_33.png', 'tam-ma_1.png', 'sai-ten.png']:
            _png(d / n)
        z = d / 'tutien-art.zip'
        with zipfile.ZipFile(z, 'w') as zf:
            for n in ['kiem-tu_nam_01.png', 'ma-tu_nu_33.png', 'tam-ma_1.png', 'sai-ten.png']:
                zf.write(d / n, arcname=n)
        root = d / 'repo'
        report = ia.import_zip(z, root)
        assert (root / 'assets/realms/Kiếm Tu/Nam/01.png').exists()
        assert (root / 'assets/realms/Ma Tu/Nữ/33.png').exists()
        assert (root / 'assets/tamma/1.png').exists()
        assert report['placed'] == 3
        assert report['bad_names'] == ['sai-ten.png']
        assert report['missing_count'] == 462 + 3 - 3

def test_zip_slip_is_rejected():
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d); _png(d / 'x.png')
        z = d / 'evil.zip'
        with zipfile.ZipFile(z, 'w') as zf:
            zf.write(d / 'x.png', arcname='../../kiem-tu_nam_01.png')
        report = ia.import_zip(z, d / 'repo')
        assert report['placed'] == 1   # chỉ lấy tên file, bỏ đường dẫn
        assert not (d.parent / 'kiem-tu_nam_01.png').exists()

if __name__ == '__main__':
    import pytest
    raise SystemExit(pytest.main([__file__]))
