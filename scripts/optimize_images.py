"""
One-off / repeatable: generate WebP variants for faster LCP (run from repo root):
  python scripts/optimize_images.py

Note: In img srcset, each NNNw must match the file's intrinsic width in pixels.
Portrait exports (e.g. experience-cocktail) use max_side on the *longer* dimension, so
width is smaller than the filename suggests — see index.html cocktail srcset.
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "image"


def fit_max(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    if max(w, h) <= max_side:
        return im
    if w >= h:
        nw, nh = max_side, int(h * max_side / w)
    else:
        nw, nh = int(w * max_side / h), max_side
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def to_webp(src: Path, out: Path, *, max_side: int | None, quality: int) -> None:
    im = Image.open(src)
    im = im.convert("RGBA") if im.mode in ("P", "LA") and "transparency" in getattr(im, "info", {}) else im
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    if max_side:
        im = fit_max(im, max_side)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=quality, method=6)
    print(f"Wrote {out.name} ({out.stat().st_size // 1024} KiB)")


def main() -> None:
    jobs = [
        # desktop hero (large PNG → WebP for LCP)
        ("tmh.png", "tmh-1200.webp", 1200, 76),
        # costilla: mobile hub + WCU (large PNG)
        ("costilla.png", "costilla-640.webp", 640, 74),
        ("costilla.png", "costilla-1080.webp", 1080, 74),
        # Portrait cocktail: filenames use max HEIGHT; srcset must use intrinsic WIDTH (335,447,543,655)
        ("experience-churrasco.png", "experience-churrasco-480.webp", 480, 58),
        ("experience-churrasco.png", "experience-churrasco-640.webp", 640, 58),
        ("experience-churrasco.png", "experience-churrasco-700.webp", 700, 58),
        ("experience-churrasco.png", "experience-churrasco-720.webp", 720, 58),
        ("experience-churrasco.png", "experience-churrasco-900.webp", 900, 55),
        ("experience-cocktail.png", "experience-cocktail-420.webp", 420, 55),
        ("experience-cocktail.png", "experience-cocktail-560.webp", 560, 55),
        ("experience-cocktail.png", "experience-cocktail-680.webp", 680, 52),
        ("experience-cocktail.png", "experience-cocktail-820.webp", 820, 52),
        # ~784px wide for 2x mobile slots (~390px); max_side = long edge (height)
        ("experience-cocktail.png", "experience-cocktail-980.webp", 980, 50),
        ("BEEF-RIBS.jpg", "BEEF-RIBS-480.webp", 480, 55),
        ("BEEF-RIBS.jpg", "BEEF-RIBS-640.webp", 640, 52),
        ("BEEF-RIBS.jpg", "BEEF-RIBS-768.webp", 768, 50),
        ("BEEF-RIBS.jpg", "BEEF-RIBS-900.webp", 900, 45),
        ("filet_mignon_1200x.jpg", "filet_mignon-480.webp", 480, 55),
        ("filet_mignon_1200x.jpg", "filet_mignon-640.webp", 640, 52),
        ("filet_mignon_1200x.jpg", "filet_mignon-768.webp", 768, 50),
        ("filet_mignon_1200x.jpg", "filet_mignon-900.webp", 900, 45),
        ("tmh1.webp", "tmh1-card-400.webp", 400, 52),
        ("tmh1.webp", "tmh1-card-480.webp", 480, 52),
        ("tmh1.webp", "tmh1-card-560.webp", 560, 48),
        ("logo1.png", "logo1-240.webp", 240, 68),
        ("logo1.png", "logo1-460.webp", 460, 65),
    ]
    for src_name, out_name, max_side, q in jobs:
        src = IMG / src_name
        if not src.exists():
            print(f"Skip missing: {src_name}")
            continue
        to_webp(src, IMG / out_name, max_side=max_side, quality=q)


if __name__ == "__main__":
    main()
