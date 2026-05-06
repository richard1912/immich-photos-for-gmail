"""Generate Chrome Web Store-sized screenshots and promo tile.

Chrome Web Store screenshot rules: 1280x800 or 640x400, JPEG or 24-bit PNG
(no alpha). The existing repo screenshots are aspect 4:3 (~1307x980), so we
fit-into-canvas with white padding to keep the full image visible.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets"
OUT = ROOT / "web-ext-artifacts" / "cws-assets"
OUT.mkdir(parents=True, exist_ok=True)

WHITE = (255, 255, 255)


def fit_into(src: Path, dst: Path, target=(1280, 800)) -> None:
    """Fit src into target canvas with white padding, save as 24-bit PNG
    with NO alpha channel and NO embedded metadata. Chrome's Web Store
    uploader has rejected JPEGs from this script with a generic "image
    size is incorrect" error even when dimensions were exactly right —
    PNG-without-metadata avoids whatever it was sniffing on."""
    img = Image.open(src).convert("RGB")
    tw, th = target
    sw, sh = img.size
    scale = min(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    resized = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGB", target, WHITE)
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
    canvas.save(dst, "PNG", optimize=True)
    print(f"  {dst.name}  ({nw}x{nh} centred on {tw}x{th})")


def main() -> None:
    print(f"writing to: {OUT}")
    print("Screenshots (1280x800 PNG, 24-bit no alpha):")
    fit_into(SRC / "upload-screen.jpg", OUT / "screenshot-1-picker.png")
    fit_into(SRC / "albums.jpg", OUT / "screenshot-2-albums.png")
    fit_into(SRC / "new-email.jpg", OUT / "screenshot-3-button.png")
    print("Small promo tile (440x280 PNG, 24-bit no alpha):")
    fit_into(SRC / "upload-screen.jpg", OUT / "promo-small-440x280.png", target=(440, 280))


if __name__ == "__main__":
    main()
