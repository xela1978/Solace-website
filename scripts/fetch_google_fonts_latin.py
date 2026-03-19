"""Download latin (+ latin-ext) woff2 from Google Fonts API and emit css/site-fonts.css."""
from __future__ import annotations

import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS_DIR = ROOT / "fonts"
OUT_CSS = ROOT / "css" / "site-fonts.css"

GOOGLE_CSS_URL = (
    "https://fonts.googleapis.com/css2?"
    "family=Inter:wght@400;500;600;700&"
    "family=Playfair+Display:ital,wght@0,400;0,600;0,700&"
    "display=swap"
)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def main() -> None:
    req = urllib.request.Request(GOOGLE_CSS_URL, headers={"User-Agent": UA})
    css = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")

    # Keep only latin + latin-ext (covers EN + common accented chars)
    parts = re.split(r"(/\* [^*]+ \*/)", css)
    blocks: list[str] = []
    i = 0
    while i < len(parts):
        if i + 1 < len(parts) and parts[i].strip().startswith("/*") and "@font-face" in parts[i + 1]:
            comment = parts[i].lower()
            if ("latin" in comment or "latin-ext" in comment) and all(
                x not in comment
                for x in ("cyrillic", "greek", "vietnamese", "hebrew", "arabic")
            ):
                blocks.append(parts[i] + parts[i + 1])
            i += 2
        else:
            i += 1

    local_css_parts: list[str] = [
        "/* Self-hosted subset (latin + latin-ext) — shorter critical path than fonts.googleapis.com */\n"
    ]
    FONTS_DIR.mkdir(parents=True, exist_ok=True)

    url_re = re.compile(r"url\((https://fonts\.gstatic\.com[^)]+\.woff2)\)")

    for block in blocks:
        m = url_re.search(block)
        if not m:
            continue
        gurl = m.group(1)
        fname = gurl.split("/")[-1]
        local_path = FONTS_DIR / fname
        if not local_path.is_file():
            print("download", fname)
            urllib.request.urlretrieve(gurl, local_path)
        new_block = block.replace(gurl, f"../fonts/{fname}")
        local_css_parts.append(new_block.strip() + "\n\n")

    OUT_CSS.parent.mkdir(parents=True, exist_ok=True)
    OUT_CSS.write_text("".join(local_css_parts), encoding="utf-8")
    print("Wrote", OUT_CSS, "bytes", OUT_CSS.stat().st_size)


if __name__ == "__main__":
    main()
