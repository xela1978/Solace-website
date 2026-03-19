"""
Minify the first <style>...</style> block in index.html (requires: pip install rcssmin).
Run from repo root: python scripts/minify_index_css.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import rcssmin
except ImportError:
    print("Install: pip install rcssmin", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def main() -> None:
    t = INDEX.read_text(encoding="utf-8")
    m = re.search(r"(<style>)(\s*)(.*?)(\s*)(</style>)", t, re.DOTALL)
    if not m:
        raise SystemExit("No <style> block found in index.html")
    raw = m.group(3)
    mini = rcssmin.cssmin(raw.strip(), keep_bang_comments=False)
    new_t = t[: m.start(3)] + mini + t[m.end(3) :]
    INDEX.write_text(new_t, encoding="utf-8")
    print(f"index.html <style>: {len(raw)} -> {len(mini)} bytes ({len(raw) - len(mini)} saved)")


if __name__ == "__main__":
    main()
