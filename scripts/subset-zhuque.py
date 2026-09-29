#!/usr/bin/env python3
"""Build a Zhuque Fangsong subset and write it into the site.

The site only needs the characters that actually appear in content and templates.
The full TTF is about 8.4MB; the subset is one woff2 under static/fonts/zhuque/.
Hugo copies that directory into the site, and GitHub Pages serves it with the
journal. Characters the font does not contain fall back to PingFang SC or
Microsoft YaHei.

GitHub Actions runs this on every deploy, before Hugo:

  python3 scripts/subset-zhuque.py
"""

import hashlib
import io
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "static", "fonts", "zhuque")
ZHUQUE_URL = "https://github.com/TrionesType/zhuque/releases/download/v0.212/ZhuqueFangsong-v0.212.zip"
SKIP_DIRS = {".git", "public", "resources", "node_modules"}
EXTS = {".md", ".html", ".css", ".toml", ".txt", ".js"}

# Punctuation a new post is likely to use before the next subset rebuild.
EXTRA = (
    "".join(chr(i) for i in range(32, 127))
    + "，。、；：？！「」『』《》〈〉（）【】〔〕［］｛｝…—–·～“”‘’％＋－×÷＝￥　"
)


def collect() -> str:
    chars = set(EXTRA)
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and d != "fonts"]
        for name in files:
            if os.path.splitext(name)[1] not in EXTS:
                continue
            if name == "subset-zhuque.py":
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding="utf-8", errors="ignore") as handle:
                chars.update(ch for ch in handle.read() if ch.isprintable())
    return "".join(sorted(chars))


def ensure_source() -> str:
    configured = os.environ.get("ZHUQUE_TTF", "")
    candidates = []
    if configured:
        candidates.append(configured)
    else:
        candidates.append("/tmp/fontrec/ZhuqueFangsong-Regular.ttf")
    candidates.append(os.path.join(tempfile.gettempdir(), "ZhuqueFangsong-Regular.ttf"))
    for candidate in candidates:
        if os.path.isfile(candidate) and os.path.getsize(candidate) > 1_000_000:
            return candidate
    dest = configured or candidates[-1]
    os.makedirs(os.path.dirname(os.path.abspath(dest)) or ".", exist_ok=True)
    print("downloading Zhuque Fangsong")
    with urllib.request.urlopen(ZHUQUE_URL, timeout=120) as response:
        payload = response.read()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        name = next(item for item in archive.namelist() if item.endswith("ZhuqueFangsong-Regular.ttf"))
        with archive.open(name) as src, open(dest, "wb") as out:
            out.write(src.read())
    return dest


def main() -> int:
    source = ensure_source()
    text = collect()
    out_dir = tempfile.mkdtemp(prefix="zhuque-")
    chars_path = os.path.join(out_dir, "chars.txt")
    woff_path = os.path.join(out_dir, "subset.woff2")
    with open(chars_path, "w", encoding="utf-8") as handle:
        handle.write(text)

    from fontTools.ttLib import TTFont

    font = TTFont(source)
    cmap = font.getBestCmap() or {}
    asked = [ch for ch in text if ord(ch) > 127]
    missing = [ch for ch in asked if ord(ch) not in cmap]
    print("chars %d  cjk-or-symbol %d  not in font %d" % (len(text), len(asked), len(missing)))
    if missing:
        print("fallback: " + "".join(missing[:80]))

    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "fontTools.subset",
            source,
            "--text-file=" + chars_path,
            "--flavor=woff2",
            "--output-file=" + woff_path,
            "--layout-features=*",
            "--recommended-glyphs",
            "--notdef-glyph",
            "--name-IDs=*",
            "--drop-tables+=DSIG",
        ]
    )

    digest = hashlib.sha256(open(woff_path, "rb").read()).hexdigest()[:12]
    filename = "zhuque-%s.woff2" % digest
    css = (
        "/* Zhuque Fangsong v0.212 subset. SIL Open Font License 1.1. */\n"
        "@font-face{"
        'font-family:"Zhuque Fangsong";'
        "font-style:normal;"
        "font-weight:400;"
        "font-display:swap;"
        'src:local("Zhuque Fangsong (technical preview)"),'
        'local("朱雀仿宋（预览测试版）"),'
        'url("./%s") format("woff2");'
        "}\n" % filename
    )
    os.makedirs(OUT_DIR, exist_ok=True)
    dest = os.path.join(OUT_DIR, filename)
    shutil.copyfile(woff_path, dest)
    with open(os.path.join(OUT_DIR, "result.css"), "w", encoding="utf-8") as handle:
        handle.write(css)
    for name in os.listdir(OUT_DIR):
        if name.startswith("zhuque-") and name.endswith(".woff2") and name != filename:
            os.remove(os.path.join(OUT_DIR, name))
    print("woff2 %d bytes static/fonts/zhuque/%s" % (os.path.getsize(dest), filename))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
