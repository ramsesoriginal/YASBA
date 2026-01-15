#!/usr/bin/env python3
"""
YASBA — SVG logo -> favicons + app icons generator.

Purpose
-------
Convert a single SVG logo (source of truth) into the standard favicon + PWA + Apple touch
icon assets used by modern web apps, in a reproducible way.

Dependencies
------------
- Python 3.x
- cairosvg  (SVG -> PNG rendering)
- Pillow    (PNG understand/resize + ICO writing)

Install:
  pip install cairosvg pillow

Usage
-----
  python scripts/generate_icons.py assets/branding/logo.svg --out assets/icons

Outputs (default structure)
---------------------------
assets/icons/
  favicon/
    favicon.ico               (16, 32, 48 embedded)
    favicon-16x16.png
    favicon-32x32.png
  pwa/
    icon-192x192.png
    icon-256x256.png
    icon-384x384.png
    icon-512x512.png
    icon-maskable-512x512.png (optional; padded safe-area)
  apple/
    apple-touch-icon.png      (180x180)

How to reference
----------------
HTML:
  <link rel="icon" href="/assets/icons/favicon/favicon.ico">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple/apple-touch-icon.png">

manifest.json (example):
  {
    "icons": [
      {"src": "/assets/icons/pwa/icon-192x192.png", "sizes": "192x192", "type": "image/png"},
      {"src": "/assets/icons/pwa/icon-256x256.png", "sizes": "256x256", "type": "image/png"},
      {"src": "/assets/icons/pwa/icon-384x384.png", "sizes": "384x384", "type": "image/png"},
      {"src": "/assets/icons/pwa/icon-512x512.png", "sizes": "512x512", "type": "image/png"},
      {"src": "/assets/icons/pwa/icon-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
    ]
  }
"""

from __future__ import annotations

import argparse
import io
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

# ---- Fail clearly if dependencies are missing ----
try:
    import cairosvg  # type: ignore
except Exception as e:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: cairosvg\n"
        "Install with: pip install cairosvg\n"
        f"Original error: {e}"
    )

try:
    from PIL import Image  # type: ignore
except Exception as e:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: Pillow\n"
        "Install with: pip install pillow\n"
        f"Original error: {e}"
    )


# ---- Sizes ----
FAVICON_PNG_SIZES: tuple[int, ...] = (16, 32)
FAVICON_ICO_SIZES: tuple[int, ...] = (16, 32, 48)

PWA_ICON_SIZES: tuple[int, ...] = (192, 256, 384, 512)
APPLE_TOUCH_SIZE: int = 180

# Maskable: keep artwork within safe area; common guidance is ~80% of icon size.
MASKABLE_SIZE: int = 512
MASKABLE_SAFE_FRACTION: float = 0.80  # 80% content, 20% padding


@dataclass(frozen=True)
class OutputPaths:
    base: Path
    favicon_dir: Path
    pwa_dir: Path
    apple_dir: Path

    @staticmethod
    def from_base(base: Path) -> "OutputPaths":
        return OutputPaths(
            base=base,
            favicon_dir=base / "favicon",
            pwa_dir=base / "pwa",
            apple_dir=base / "apple",
        )


def ensure_dirs(paths: OutputPaths) -> None:
    paths.favicon_dir.mkdir(parents=True, exist_ok=True)
    paths.pwa_dir.mkdir(parents=True, exist_ok=True)
    paths.apple_dir.mkdir(parents=True, exist_ok=True)


def render_svg_to_png_bytes(svg_path: Path, size_px: int, background: str | None = None) -> bytes:
    """
    Render SVG to a square PNG (size_px x size_px).
    background: hex or named color; if None, preserves SVG transparency.
    """
    svg_bytes = svg_path.read_bytes()

    # cairosvg accepts background_color=None for transparent.
    png_bytes: bytes = cairosvg.svg2png(
        bytestring=svg_bytes,
        output_width=size_px,
        output_height=size_px,
        background_color=background,
    )
    return png_bytes


def png_bytes_to_image(png_bytes: bytes) -> Image.Image:
    with Image.open(io.BytesIO(png_bytes)) as im:
        # Ensure a predictable format (RGBA) for compositing/resizing.
        return im.convert("RGBA")


def save_png(svg_path: Path, out_path: Path, size_px: int, background: str | None = None) -> None:
    png_bytes = render_svg_to_png_bytes(svg_path, size_px=size_px, background=background)
    out_path.write_bytes(png_bytes)


def save_ico(svg_path: Path, out_path: Path, sizes: Sequence[int]) -> None:
    """
    Create a multi-size favicon.ico by rendering each size from SVG and embedding.
    """
    images: list[Image.Image] = []
    for s in sizes:
        png_bytes = render_svg_to_png_bytes(svg_path, size_px=s, background=None)
        images.append(png_bytes_to_image(png_bytes))

    # Pillow writes ICO from the first image, using append_images for additional frames.
    # Also pass sizes to ensure correct embedded size table.
    images[0].save(
        out_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[1:],
    )


def save_maskable_icon(svg_path: Path, out_path: Path, size_px: int, safe_fraction: float) -> None:
    """
    Generate a maskable icon variant:
    - Render the SVG to the full size.
    - Scale it down to safe area (e.g., 80%).
    - Center it on a transparent canvas.
    This helps avoid clipping on Android adaptive mask shapes.
    """
    base_png = png_bytes_to_image(render_svg_to_png_bytes(svg_path, size_px=size_px, background=None))

    safe_size = max(1, int(round(size_px * safe_fraction)))
    content = base_png.resize((safe_size, safe_size), resample=Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size_px, size_px), (0, 0, 0, 0))
    offset = ((size_px - safe_size) // 2, (size_px - safe_size) // 2)
    canvas.alpha_composite(content, dest=offset)

    # Optimize a bit without being fancy; keep PNG.
    canvas.save(out_path, format="PNG", optimize=True)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate favicons + PWA + Apple touch icons from a single SVG logo."
    )
    p.add_argument("svg", type=Path, help="Path to the source SVG logo.")
    p.add_argument(
        "--out",
        type=Path,
        default=Path("assets/icons"),
        help="Base output directory (default: assets/icons).",
    )
    p.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing files (default: skip existing).",
    )
    p.add_argument(
        "--no-maskable",
        action="store_true",
        help="Do not generate the maskable icon variant.",
    )
    p.add_argument(
        "--background",
        type=str,
        default=None,
        help="Optional background color for rendered PNGs (e.g., '#ffffff'). "
        "Default keeps SVG transparency.",
    )
    return p.parse_args(argv)


def maybe_write(path: Path, overwrite: bool, write_fn) -> bool:
    """
    Write a file using write_fn() if missing or overwrite=True.
    Returns True if written.
    """
    if path.exists() and not overwrite:
        return False
    write_fn()
    return True


def main() -> None:
    args = parse_args()
    svg_path: Path = args.svg
    out_base: Path = args.out

    if not svg_path.exists():
        raise SystemExit(f"SVG not found: {svg_path}")
    if svg_path.suffix.lower() != ".svg":
        raise SystemExit(f"Input must be an .svg file: {svg_path}")

    paths = OutputPaths.from_base(out_base)
    ensure_dirs(paths)

    written: list[Path] = []
    skipped: list[Path] = []

    # Favicons (PNG)
    for s in FAVICON_PNG_SIZES:
        out_path = paths.favicon_dir / f"favicon-{s}x{s}.png"
        did_write = maybe_write(
            out_path,
            args.overwrite,
            lambda s=s, out_path=out_path: save_png(svg_path, out_path, s, background=args.background),
        )
        (written if did_write else skipped).append(out_path)

    # Favicon ICO (multi-size)
    ico_path = paths.favicon_dir / "favicon.ico"
    did_write = maybe_write(
        ico_path,
        args.overwrite,
        lambda: save_ico(svg_path, ico_path, sizes=FAVICON_ICO_SIZES),
    )
    (written if did_write else skipped).append(ico_path)

    # PWA icons
    for s in PWA_ICON_SIZES:
        out_path = paths.pwa_dir / f"icon-{s}x{s}.png"
        did_write = maybe_write(
            out_path,
            args.overwrite,
            lambda s=s, out_path=out_path: save_png(svg_path, out_path, s, background=args.background),
        )
        (written if did_write else skipped).append(out_path)

    # Apple touch icon
    apple_path = paths.apple_dir / "apple-touch-icon.png"
    did_write = maybe_write(
        apple_path,
        args.overwrite,
        lambda: save_png(svg_path, apple_path, APPLE_TOUCH_SIZE, background=args.background),
    )
    (written if did_write else skipped).append(apple_path)

    # Maskable icon (optional)
    if not args.no_maskable:
        maskable_path = paths.pwa_dir / f"icon-maskable-{MASKABLE_SIZE}x{MASKABLE_SIZE}.png"
        did_write = maybe_write(
            maskable_path,
            args.overwrite,
            lambda: save_maskable_icon(
                svg_path, maskable_path, size_px=MASKABLE_SIZE, safe_fraction=MASKABLE_SAFE_FRACTION
            ),
        )
        (written if did_write else skipped).append(maskable_path)

    # Summary
    def rel(p: Path) -> str:
        try:
            return str(p.relative_to(Path.cwd()))
        except Exception:
            return str(p)

    print("\nYASBA icon generation complete.")
    print(f"Source SVG: {svg_path}")
    print(f"Output dir: {out_base.resolve()}\n")

    if written:
        print("Written:")
        for p in written:
            print(f"  - {rel(p)}")
    if skipped:
        print("\nSkipped (already exists; use --overwrite to replace):")
        for p in skipped:
            print(f"  - {rel(p)}")

    print("\nNext steps:")
    print("  - Reference favicon and apple-touch-icon in HTML <head> (see docstring).")
    print("  - Reference PWA icons (including maskable) in manifest.json (see docstring).")


if __name__ == "__main__":
    main()
