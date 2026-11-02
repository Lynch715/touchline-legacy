"""生成与游戏配色一致的球场图标；仅构建图标时需要 Pillow。"""
from math import cos, sin, pi
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parent.parent / 'assets' / 'pwa'
out.mkdir(parents=True, exist_ok=True)


def icon(size, maskable=False):
    scale = 3
    image = Image.new('RGB', (512 * scale, 512 * scale), '#0d1117')
    draw = ImageDraw.Draw(image)
    factor = .8 if maskable else 1

    def point(x, y):
        return ((256 + (x - 256) * factor) * scale,
                (256 + (y - 256) * factor) * scale)

    def rect(box, radius, fill=None, outline=None, width=1):
        draw.rounded_rectangle([point(*box[:2]), point(*box[2:])], radius * scale * factor,
                               fill=fill, outline=outline, width=round(width * scale * factor))

    def line(points, fill, width=1):
        draw.line([point(*p) for p in points], fill=fill, width=round(width * scale * factor))

    rect((68, 100, 444, 412), 46, '#087b4c')
    rect((96, 130, 416, 382), 12, outline='#b5f5d5', width=7)
    line([(256, 130), (256, 382)], '#b5f5d5', 6)
    rect((96, 206, 140, 306), 2, outline='#b5f5d5', width=6)
    rect((372, 206, 416, 306), 2, outline='#b5f5d5', width=6)
    draw.ellipse([point(183, 183), point(329, 329)], fill='#f5f7f8', outline='#0d1117', width=6 * scale)
    vertices = [(256 + 29 * cos(-pi / 2 + i * 2 * pi / 5),
                 256 + 29 * sin(-pi / 2 + i * 2 * pi / 5)) for i in range(5)]
    draw.polygon([point(*p) for p in vertices], fill='#0d1117')
    for x, y in vertices:
        edge = (256 + (x - 256) * 2.3, 256 + (y - 256) * 2.3)
        line([(x, y), edge], '#0d1117', 5)
        draw.ellipse([point(edge[0] - 10, edge[1] - 10), point(edge[0] + 10, edge[1] + 10)], fill='#0d1117')
    return image.resize((size, size), Image.Resampling.LANCZOS)


for size in (192, 512):
    icon(size).save(out / f'icon-{size}.png')
icon(512, maskable=True).save(out / 'icon-maskable-512.png')
