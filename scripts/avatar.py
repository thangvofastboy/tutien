"""Đổi một ảnh bất kỳ thành hình nhân vật cho /tutien hinh.

Ảnh được đặt giữa nền trong suốt cho vuông (không méo), thu về 96×96.
In ra stdout JSON {"png": <PNG 96×96 base64>, "cells": <ô Raster 48×24 base64>, "file": <đường dẫn tuyệt đối>}.

Chạy: python3 scripts/avatar.py <đường-dẫn-ảnh>
"""
import base64, io, json, pathlib, sys
from PIL import Image, ImageOps
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_cells import encode_cells

SIZE = 96

def square(im: Image.Image) -> Image.Image:
    im = ImageOps.exif_transpose(im).convert('RGBA')
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    return out

def convert(path: str) -> dict:
    src = pathlib.Path(path).expanduser().resolve()
    im = square(Image.open(src))
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return {'png': base64.b64encode(buf.getvalue()).decode('ascii'), 'cells': encode_cells(im), 'file': str(src)}

if __name__ == '__main__':
    print(json.dumps(convert(sys.argv[1])))
