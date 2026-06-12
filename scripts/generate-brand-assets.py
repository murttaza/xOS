"""
Generate every mOS brand asset from the canonical mark (Rebrand/masters/mark.svg).

Run from repo root:
    py scripts/generate-brand-assets.py

The mark is ".م" — the Arabic meem (the m in mOS) followed by a full stop,
placed where Arabic puts it: after the letter, to the left. Bone ink + red
period on the dark tile. Calibrated Jun 2026 (dot r16, stroke 26,
smaller-head/longer-tail, 64% tile presence).

Outputs:
    public/favicon.ico            16/32 (small cut) + 48 (master)   — browser tab + Electron window icon
    public/app-icon.ico           16/32 (small cut) + 48..256       — electron-builder, taskbar, tray
    public/logo.ico               same as app-icon                  — kept for path compat
    public/apple-touch-icon.png   180, opaque tile                  — iOS home screen
    public/icon-192.png           192, opaque tile                  — PWA manifest
    public/icon-512.png           512, opaque tile (maskable-safe)  — PWA manifest
    src/assets/wordmark-dark.png  "mos." bone + red dot, 1200w      — dark theme UI wordmark
    src/assets/wordmark-light.png "mos." charcoal + red dot, 1200w  — light theme UI wordmark

Optical sizing: 48px and up use the master cut (stroke 26, with the period);
16/32 use a heavier cut (stroke 36) without the period — the dot would be mush
at those sizes, and the meem alone holds.

Method: tiles are laid out as HTML (same mechanics as the approved concept
boards), rendered by headless Chrome/Edge at 1024px, downsampled with LANCZOS,
and packed into ICOs manually (PNG-compressed entries) so different cuts can
share one ICO.
"""
from __future__ import annotations

import io
import shutil
import struct
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
ASSETS = ROOT / "src" / "assets"
TMP = ROOT / "build" / "brand-tmp"

TILE_BG = "#0C0C0E"
BONE = "#D4C8BC"
INK_LIGHT = "#201A16"   # warm near-black for the light-theme wordmark
RED = "#EF4444"

OUTFIT_WOFF2 = (
    ROOT / "node_modules" / "@fontsource-variable" / "outfit" / "files"
    / "outfit-latin-wght-normal.woff2"
)

BROWSER_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
]

# ---- the mark, in its 240-unit box (keep in sync with Rebrand/masters/mark.svg) ----
# Master cut: meem + period. Bbox center sits at (118.5, 120.5); the inner
# translate trues it up to (120, 120) so flex-centering is exact.
MARK_MASTER = f"""
<g transform="translate(1.5 -0.5)">
  <g fill="none" stroke="{BONE}" stroke-width="26" stroke-linecap="round">
    <circle cx="165" cy="83" r="37"/>
    <path d="M128 83 V148 C128 180 114 192 86 195"/>
  </g>
  <circle cx="38" cy="192" r="16" fill="{RED}"/>
</g>
"""

# Small cut (16/32 px): heavier pen, no period. Meem-only bbox centers at
# (144, 120.5) with stroke 36 — translate recenters.
MARK_SMALL = f"""
<g transform="translate(-24 -0.5)">
  <g fill="none" stroke="{BONE}" stroke-width="36" stroke-linecap="round">
    <circle cx="165" cy="83" r="37"/>
    <path d="M128 83 V148 C128 180 114 192 86 195"/>
  </g>
</g>
"""


def find_browser() -> Path:
    for p in BROWSER_CANDIDATES:
        if p.exists():
            return p
    raise SystemExit("No Chrome/Edge found for headless rendering")


def render(browser: Path, html: Path, out_png: Path, size: tuple[int, int],
           transparent: bool) -> Image.Image:
    args = [
        str(browser), "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={size[0]},{size[1]}",
        "--virtual-time-budget=4000",
    ]
    if transparent:
        args.append("--default-background-color=00000000")
    args += [f"--screenshot={out_png}", html.as_uri()]
    subprocess.run(args, check=True, capture_output=True)
    if not out_png.exists():
        raise SystemExit(f"Headless render produced no file for {html.name}")
    return Image.open(out_png).convert("RGBA")


def tile_html(inner_svg: str, presence_px: float, rounded: bool) -> str:
    """A 1024px tile with the 240-box mark SVG centered at `presence_px` wide —
    the exact mechanics of the approved concept-board cells."""
    radius = "border-radius:256px;" if rounded else ""
    bg = "background:transparent;" if rounded else f"background:{TILE_BG};"
    inner_bg = f"background:{TILE_BG};" if rounded else ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{{margin:0;{bg}}}
    </style></head><body>
      <div style="width:1024px;height:1024px;{inner_bg}{radius}overflow:hidden;display:grid;place-items:center">
        <svg width="{presence_px}" height="{presence_px}" viewBox="0 0 240 240">{inner_svg}</svg>
      </div>
    </body></html>"""


def wordmark_html(color: str) -> str:
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face {{
        font-family: 'Outfit Variable';
        src: url('{OUTFIT_WOFF2.as_uri()}') format('woff2-variations');
        font-weight: 100 900;
        font-display: block;
      }}
      html,body{{margin:0;background:transparent;}}
      .wm {{
        font-family: 'Outfit Variable', sans-serif;
        font-weight: 545;
        font-size: 700px;
        letter-spacing: -0.015em;
        line-height: 1;
        color: {color};
        white-space: nowrap;
        padding: 60px;
        display: inline-block;
      }}
    </style></head><body>
      <div class="wm">mos<span style="color:{RED}">.</span></div>
    </body></html>"""


def pack_ico(dest: Path, frames: list[Image.Image]) -> None:
    """Write an ICO with PNG-compressed entries — lets different artwork
    (master vs small cut) share one file, which Pillow's writer can't do."""
    blobs = []
    for im in frames:
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        blobs.append(buf.getvalue())
    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    entries = b""
    for im, blob in zip(frames, blobs):
        w = im.width if im.width < 256 else 0
        h = im.height if im.height < 256 else 0
        entries += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    dest.write_bytes(header + entries + b"".join(blobs))
    print(f"  wrote {dest.relative_to(ROOT)}  frames={[im.width for im in frames]}")


def save_png(im: Image.Image, dest: Path, size: int) -> None:
    im.resize((size, size), Image.Resampling.LANCZOS).save(dest, format="PNG", optimize=True)
    print(f"  wrote {dest.relative_to(ROOT)}  {size}x{size}")


def main() -> None:
    browser = find_browser()
    if not OUTFIT_WOFF2.exists():
        raise SystemExit("Outfit woff2 not found — run npm install first")
    TMP.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    # 64% presence (as calibrated); the small cut takes 72% for legibility.
    presence_master = round(1024 * 0.64, 2)   # 655.36
    presence_small = round(1024 * 0.72, 2)    # 737.28

    renders = {
        "tile-opaque": (tile_html(MARK_MASTER, presence_master, rounded=False), (1024, 1024), False),
        "tile-rounded": (tile_html(MARK_MASTER, presence_master, rounded=True), (1024, 1024), True),
        "tile-small": (tile_html(MARK_SMALL, presence_small, rounded=True), (1024, 1024), True),
        "wordmark-dark": (wordmark_html(BONE), (2600, 1000), True),
        "wordmark-light": (wordmark_html(INK_LIGHT), (2600, 1000), True),
    }
    images: dict[str, Image.Image] = {}
    for name, (html, size, transparent) in renders.items():
        html_path = TMP / f"{name}.html"
        html_path.write_text(html, encoding="utf-8")
        images[name] = render(browser, html_path, TMP / f"{name}.png", size, transparent)
        print(f"rendered {name}  {images[name].size}")

    opaque, rounded, small = images["tile-opaque"], images["tile-rounded"], images["tile-small"]

    # ---- PWA / iOS tiles (opaque — iOS masks corners itself) ----
    save_png(opaque, PUBLIC / "icon-512.png", 512)
    save_png(opaque, PUBLIC / "icon-192.png", 192)
    save_png(opaque, PUBLIC / "apple-touch-icon.png", 180)

    # ---- ICOs (rounded silhouette; small cut below 48px) ----
    def frame(src: Image.Image, s: int) -> Image.Image:
        return src.resize((s, s), Image.Resampling.LANCZOS)

    favicon = [frame(rounded, 48), frame(small, 32), frame(small, 16)]
    appicon = [frame(rounded, 256), frame(rounded, 128), frame(rounded, 64),
               frame(rounded, 48), frame(small, 32), frame(small, 16)]
    pack_ico(PUBLIC / "favicon.ico", favicon)
    pack_ico(PUBLIC / "app-icon.ico", appicon)
    pack_ico(PUBLIC / "logo.ico", appicon)

    # ---- wordmarks: trim to letterforms, normalize to 1200w ----
    for name, dest in [("wordmark-dark", ASSETS / "wordmark-dark.png"),
                       ("wordmark-light", ASSETS / "wordmark-light.png")]:
        im = images[name]
        bbox = im.split()[3].getbbox()
        if not bbox:
            raise SystemExit(f"{name} rendered empty — font load failed?")
        im = im.crop(bbox)
        h = round(im.height * 1200 / im.width)
        im.resize((1200, h), Image.Resampling.LANCZOS).save(dest, format="PNG", optimize=True)
        print(f"  wrote {dest.relative_to(ROOT)}  1200x{h}")

    shutil.rmtree(TMP, ignore_errors=True)
    # ASCII only: the Windows console default codepage (cp1252) can't print the meem.
    print("done - all brand assets regenerated from the meem master")


if __name__ == "__main__":
    main()
