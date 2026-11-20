"""Download the 20 Pokemon images for Zayn's Kahoot and make their backgrounds transparent.

Run from the zayn-kahoot folder:   python3 download_pokemon_artwork.py
Needs Pillow:                      pip install pillow
"""
from pathlib import Path
from io import BytesIO
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw

NAMES = [
    'pikachu', 'charmander', 'charizard', 'bulbasaur', 'squirtle', 'mewtwo', 'mew',
    'dragonite', 'slowpoke', 'snorlax', 'eevee', 'jigglypuff', 'psyduck', 'gengar',
    'gyarados', 'meowth', 'magikarp', 'lapras', 'vulpix', 'onix',
]
OUT = Path('public/assets/pokemon')
OUT.mkdir(parents=True, exist_ok=True)
SENTINEL = (255, 0, 255)


def clear_background(img: Image.Image, tolerance: int = 28) -> Image.Image:
    """Flood-fill the white background from every edge pixel, then make it transparent.
    White areas enclosed inside the character are left untouched."""
    rgb = img.convert('RGB')
    w, h = rgb.size
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)] + \
            [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    for s in seeds:
        r, g, b = rgb.getpixel(s)
        if min(r, g, b) > 255 - tolerance:          # only start from near-white pixels
            ImageDraw.floodfill(rgb, s, SENTINEL, thresh=tolerance)
    rgba = rgb.convert('RGBA')
    px = rgba.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][:3] == SENTINEL:
                px[x, y] = (255, 255, 255, 0)
    return rgba.crop(rgba.getbbox() or (0, 0, w, h))


ok, failed = 0, []
for name in NAMES:
    url = f'https://img.pokemondb.net/artwork/{name}.jpg'
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=30) as r:
            img = Image.open(BytesIO(r.read()))
        clear_background(img).save(OUT / f'{name}.png')
        ok += 1
        print(f'  ok  {name}.png')
    except Exception as e:  # keep going if one fails
        failed.append(name)
        print(f'  FAIL {name}: {e}')

print(f'\nSaved {ok}/{len(NAMES)} images to {OUT.resolve()}')
if failed:
    print('Missing (grab these by hand):', ', '.join(failed))
