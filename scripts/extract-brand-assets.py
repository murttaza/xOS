"""
Extract favicon / app-icon / wordmark from Rebrand/FavIcon Wordmark Logo BrandBook.png.

Run from repo root:
    py scripts/extract-brand-assets.py

Outputs:
    public/favicon.ico, app-icon.ico, logo.ico  — multi-res Windows ICO
                                                  (rich design w/ spiral binding + bookmark)
    public/apple-touch-icon.png (180x180)       — iOS home-screen tile
    public/icon-192.png, icon-512.png           — PWA / Android manifest
                                                  (above 3 use the clean rounded-square favicon
                                                  variant from the brand book — no spiral
                                                  or bookmark — so iOS's corner mask doesn't
                                                  clip decorations)
    src/assets/wordmark-dark.png                — high-res cream wordmark
    src/assets/wordmark-light.png               — high-res near-black wordmark
                                                  (in src/assets so Vite emits relative URLs
                                                  that work in Electron's file:// context)
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Rebrand" / "FavIcon Wordmark Logo BrandBook.png"
PUBLIC = ROOT / "public"
ASSETS = ROOT / "src" / "assets"

# Crop rectangles inside the 1448x1086 brand-book sheet.
# Pinned empirically by inspecting the brand book.
# Bounds pinned by sampling brightness profiles on the source PNG. Previous crops were
# too tight: the main-icon box sliced 34px off the right (clipping the bookmark tab),
# and the favicon box missed 5px on top + left of the body and included an asymmetric
# drop shadow that pulled the bbox bottom-right.
ICON_DARK_BOX     = (435, 80, 745, 390)        # main app icon (dark): artwork at 441..739 / 86..385, +6px margin
ICON_FAVICON_BOX  = (1185, 110, 1290, 215)     # clean rounded-square variant: body at 1195..1279 / 120..200, +10px margin
WORDMARK_BOX      = (585, 488, 768, 590)       # 2nd "mOs" wordmark, the one with PREFERRED tag

# Sheet background brightness on this brand book is in the range ~2..16. Anything brighter
# than this is content. We threshold a little above the max bg so noise doesn't leak.
BG_THRESHOLD = 18


def extract_icon(rgba_crop: Image.Image, close_passes: int = 20,
                 bbox_threshold: int | None = None) -> tuple[Image.Image, tuple[int, int, int, int] | None]:
    """Cut the icon silhouette out of the sheet background.

    The icon body is dark gray (~25-60 brightness) and the sheet is even darker (~2-16).
    A brightness threshold alone leaves holes where the icon's own dark shadows sit at
    sheet-level brightness, so we follow it with morphological closing (dilate then erode)
    to fill those holes while keeping the rounded-square outer silhouette intact.

    Returns (rgba, bbox). The rgba uses the low-threshold alpha mask so antialiased edges
    survive. The bbox is computed from a tighter `bbox_threshold` mask (if provided) so
    callers can crop to just the bright body, ignoring soft drop shadows that would
    otherwise inflate the bbox and break symmetric centering after square_pad.
    """
    arr = np.array(rgba_crop.convert("RGBA"))
    lum = arr[..., :3].mean(axis=2)
    raw = (lum > BG_THRESHOLD).astype(np.uint8) * 255
    mask = Image.fromarray(raw, "L")
    # MaxFilter(3) = 1-pixel dilation, MinFilter(3) = 1-pixel erosion. N passes ≈ N-pixel
    # closing — enough to bridge the dark gutters between the icon's sub-tiles without
    # rounding off the outer shape.
    for _ in range(close_passes):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    for _ in range(close_passes):
        mask = mask.filter(ImageFilter.MinFilter(3))
    # Slight blur for clean antialiased edges.
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.8))
    arr[..., 3] = np.array(mask)
    rgba = Image.fromarray(arr, "RGBA")

    if bbox_threshold is not None:
        # Compute a tight bbox from only the bright body — excludes the soft drop shadow.
        body_mask = (lum > bbox_threshold).astype(np.uint8) * 255
        body_mask_img = Image.fromarray(body_mask, "L")
        # Same closing so the bbox spans the full body shape, not just the brightest pixels.
        for _ in range(close_passes):
            body_mask_img = body_mask_img.filter(ImageFilter.MaxFilter(3))
        for _ in range(close_passes):
            body_mask_img = body_mask_img.filter(ImageFilter.MinFilter(3))
        bbox = body_mask_img.getbbox()
    else:
        bbox = rgba.getbbox()
    return rgba, bbox


def extract_wordmark_alpha(rgba_crop: Image.Image) -> Image.Image:
    """Build a grayscale alpha mask of the wordmark. The wordmark is cream-colored text
    on dark sheet bg, so brightness directly drives alpha. We use a steep ramp (40..150)
    instead of a wide one so antialiased fringe pixels are mostly cut and the bbox hugs
    the actual letterforms tightly — important for downstream alignment with the Arabic
    easter-egg label that sits just below the rendered wordmark."""
    arr = np.array(rgba_crop.convert("RGB"))
    lum = arr.mean(axis=2)
    alpha = np.clip((lum - 40) / (150 - 40) * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(alpha, "L")


def tint(mask: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Render a single-color wordmark by multiplying the alpha mask with a solid fill."""
    w, h = mask.size
    canvas = Image.new("RGBA", (w, h), rgb + (0,))
    canvas.putalpha(mask)
    return canvas


def square_pad(img: Image.Image) -> Image.Image:
    """Pad to square with transparent margins so resize keeps aspect ratio crisp."""
    w, h = img.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas


def export_ico(square_img: Image.Image, dest: Path, sizes: list[int]) -> None:
    # Pillow's ICO writer accepts a `sizes` argument that downsamples internally with
    # nearest-neighbour, which makes small icons look chunky. Pre-render each target
    # size with LANCZOS, then save the highest as ICO with all sizes embedded.
    rendered = [square_img.resize((s, s), Image.Resampling.LANCZOS) for s in sorted(sizes)]
    rendered[-1].save(dest, format="ICO", sizes=[(s, s) for s in sorted(sizes)])
    print(f"  wrote {dest.name}  sizes={sorted(sizes)}")


def export_png(img: Image.Image, dest: Path, size: int | tuple[int, int]) -> None:
    if isinstance(size, int):
        size = (size, size)
    resized = img.resize(size, Image.Resampling.LANCZOS)
    resized.save(dest, format="PNG", optimize=True)
    print(f"  wrote {dest.name}  size={size}")


# Brand-book sheet bg color, sampled at corners of the source PNG. Used as the solid
# fill behind icons destined for iOS / PWA tiles, which fill transparent pixels with
# white (Safari) or otherwise mask in ways that expose the alpha channel.
TILE_BG = (12, 12, 14)


def to_tile_icon(icon_rgba: Image.Image, padding_pct: float = 0.10) -> Image.Image:
    """Render the icon on a square, fully-opaque dark tile with safe-area padding.

    iOS clips apple-touch-icon corners with its own mask, and Android maskable icons
    use the inner 80% as the "safe zone". Composing the rounded-square artwork onto
    a solid dark tile (rather than leaving transparency) avoids the white-halo + edge-
    clipping artifacts the user saw when adding the site to their iPhone home screen.
    """
    w, h = icon_rgba.size
    icon_side = max(w, h)
    canvas_side = int(round(icon_side * (1 + 2 * padding_pct)))
    canvas = Image.new("RGB", (canvas_side, canvas_side), TILE_BG)
    pos = ((canvas_side - w) // 2, (canvas_side - h) // 2)
    canvas.paste(icon_rgba, pos, icon_rgba)
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source brand book not found at {SRC}")
    PUBLIC.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SRC).convert("RGB")
    print(f"Loaded {SRC.name}  ({sheet.size[0]}x{sheet.size[1]})")

    # ---- Main app icon (dark) ----
    # Rich design — body fill, spiral binding, bookmark tab all sit at similar brightness,
    # so the default low-threshold bbox correctly includes every decoration.
    icon, bbox = extract_icon(sheet.crop(ICON_DARK_BOX).convert("RGBA"))
    if bbox:
        icon = icon.crop(bbox)
    icon_sq = square_pad(icon)
    print(f"Main icon bbox after trim+pad: {icon_sq.size}")

    # ICOs (browser tab favicon + Electron Windows installer/taskbar/tray) — keep the
    # transparent rounded-square silhouette; this is what makes them feel well-incorporated
    # against arbitrary tab/taskbar backgrounds.
    export_ico(icon_sq, PUBLIC / "favicon.ico",  [16, 32, 48])
    export_ico(icon_sq, PUBLIC / "app-icon.ico", [16, 32, 48, 64, 128, 256])
    export_ico(icon_sq, PUBLIC / "logo.ico",     [16, 32, 48, 64, 128, 256])

    # ---- Clean rounded-square variant for iOS / PWA ----
    # The main icon's spiral binding + bookmark tab don't survive iOS's home-screen mask.
    # The FAVICON panel in the brand book has a simpler design: just the rounded square
    # with the 4 sub-icons, no external decorations. Use that for iOS / Android tiles.
    # bbox_threshold=40 makes the bbox hug the body (sub-icons + dark gutters between them)
    # and ignore the drop shadow that extends bottom-right beyond it — keeps the body
    # symmetrically centered on the dark tile after square_pad.
    fav, bbox = extract_icon(
        sheet.crop(ICON_FAVICON_BOX).convert("RGBA"),
        close_passes=8,
        bbox_threshold=40,
    )
    if bbox:
        fav = fav.crop(bbox)
    fav_sq = square_pad(fav)
    # 12% padding inside the dark tile gives a tasteful margin without making the icon
    # feel small. Because there's no spiral/bookmark, iOS's corner mask can crop the
    # outer ~5% safely.
    tile = to_tile_icon(fav_sq, padding_pct=0.12)
    print(f"Clean icon bbox: {fav_sq.size}  Tile canvas: {tile.size}")
    export_png(tile, PUBLIC / "apple-touch-icon.png", 180)
    export_png(tile, PUBLIC / "icon-192.png", 192)
    export_png(tile, PUBLIC / "icon-512.png", 512)

    # ---- Wordmark ----
    # Single alpha mask drives both color variants. The mask is built from the cream
    # source; we tint it cream for dark theme and a deep warm-charcoal for light theme.
    wm_mask = extract_wordmark_alpha(sheet.crop(WORDMARK_BOX).convert("RGBA"))
    bbox = wm_mask.getbbox()
    if bbox:
        wm_mask = wm_mask.crop(bbox)
    target_w = 1200
    scale = target_w / wm_mask.size[0]
    target_h = int(round(wm_mask.size[1] * scale))
    wm_mask = wm_mask.resize((target_w, target_h), Image.Resampling.LANCZOS)

    # Dark-theme: cream ink, matches the brand-book primary wordmark color.
    tint(wm_mask, (212, 200, 188)).save(ASSETS / "wordmark-dark.png", format="PNG", optimize=True)
    print(f"  wrote src/assets/wordmark-dark.png   size={wm_mask.size}")
    # Light-theme: warm near-black for high contrast against the page bg without losing
    # the wordmark's warm character.
    tint(wm_mask, (32, 26, 22)).save(ASSETS / "wordmark-light.png", format="PNG", optimize=True)
    print(f"  wrote src/assets/wordmark-light.png  size={wm_mask.size}")


if __name__ == "__main__":
    main()
