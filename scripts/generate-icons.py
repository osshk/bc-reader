#!/usr/bin/env python3
"""Render the BC Reader PNG icons from the app's own geometry.

Chrome on Android refuses to offer "Install app" when the manifest lists only an
SVG icon, so the same mark as public/icon.svg is rasterised here at the sizes the
manifest and iOS ask for. Run with the repo as the working directory:

    python3 scripts/generate-icons.py

Writes public/icon-192.png, public/icon-512.png,
public/icon-maskable-512.png and public/apple-touch-icon.png.
"""

from pathlib import Path

from PIL import Image, ImageDraw

BG = (0x8C, 0x62, 0x39, 255)
CARD = (0xF7, 0xF1, 0xE6, 255)
UNIT = 32.0  # icon.svg uses a 32x32 viewBox
SS = 4  # supersample factor, downsampled with LANCZOS


def render(size: int, inset: float = 0.0, rounded: bool = True) -> Image.Image:
    """Draw the mark at `size` px. `inset` shrinks the artwork for maskable icons."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = s / UNIT

    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=8 * k, fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)

    # Shrink the artwork around the centre so maskable variants survive cropping.
    scale = 1.0 - inset
    offset = (s - s * scale) / 2.0

    def p(x: float, y: float) -> tuple[float, float]:
        return (offset + x * k * scale, offset + y * k * scale)

    x0, y0 = p(6.5, 9)
    x1, y1 = p(6.5 + 19, 9 + 14)
    d.rounded_rectangle([x0, y0, x1, y1], radius=2 * k * scale, fill=CARD)

    width = max(1, round(1.4 * k * scale))
    for y, length in ((13.5, 8.5), (16.5, 6.5), (19.5, 4.0)):
        d.line([p(10, y), p(10 + length, y)], fill=BG, width=width)
        # round caps, matching stroke-linecap="round"
        for x in (10, 10 + length):
            cx, cy = p(x, y)
            r = width / 2.0
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BG)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    out = Path("public")
    out.mkdir(exist_ok=True)
    render(192).save(out / "icon-192.png")
    render(512).save(out / "icon-512.png")
    # Maskable: full bleed square, artwork inside the 80% safe zone.
    render(512, inset=0.24, rounded=False).save(out / "icon-maskable-512.png")
    # iOS applies its own rounding, so no transparent corners here.
    render(180, rounded=False).save(out / "apple-touch-icon.png")
    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"):
        path = out / name
        with Image.open(path) as check:
            print(f"{path} {check.size[0]}x{check.size[1]} {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
