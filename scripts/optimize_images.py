"""
One-off / repeatable: generate WebP variants for faster LCP (run from repo root):
  python scripts/optimize_images.py
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
        ("tmh.png", "tmh-1200.webp", 1200, 80),
        # costilla: mobile hub + WCU (large PNG)
        ("costilla.png", "costilla-640.webp", 640, 78),
        ("costilla.png", "costilla-1080.webp", 1080, 78),
        # about / dishes — extra widths + slightly lower q for Lighthouse byte savings
        ("experience-churrasco.png", "experience-churrasco-480.webp", 480, 76),
        ("experience-churrasco.png", "experience-churrasco-720.webp", 720, 76),
        ("experience-churrasco.png", "experience-churrasco-900.webp", 900, 76),
        ("experience-cocktail.png", "experience-cocktail-420.webp", 420, 76),
        ("experience-cocktail.png", "experience-cocktail-560.webp", 560, 76),
        ("experience-cocktail.png", "experience-cocktail-820.webp", 820, 76),
        ("BEEF-RIBS.jpg", "BEEF-RIBS-480.webp", 480, 76),
        ("BEEF-RIBS.jpg", "BEEF-RIBS-640.webp", 640, 76),
        ("BEEF-RIBS.jpg", "BEEF-RIBS-900.webp", 900, 76),
        ("filet_mignon_1200x.jpg", "filet_mignon-480.webp", 480, 76),
        ("filet_mignon_1200x.jpg", "filet_mignon-640.webp", 640, 76),
        ("filet_mignon_1200x.jpg", "filet_mignon-900.webp", 900, 76),
        # card strip ~140px tall; 400w covers 2x DPR ~200px layout width
        ("tmh1.webp", "tmh1-card-400.webp", 400, 74),
        ("tmh1.webp", "tmh1-card-560.webp", 560, 74),
        # logo: keep readable; small savings vs q88
        ("logo1.png", "logo1-240.webp", 240, 82),
        ("logo1.png", "logo1-460.webp", 460, 82),
    ]
    for src_name, out_name, max_side, q in jobs:
        src = IMG / src_name
        if not src.exists():
            print(f"Skip missing: {src_name}")
            continue
        to_webp(src, IMG / out_name, max_side=max_side, quality=q)


if __name__ == "__main__":
    main()
