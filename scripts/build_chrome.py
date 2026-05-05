"""Build a Chrome-compatible zip of the extension.

Reads manifest.chrome.json, copies the runtime files into a staging directory
under web-ext-artifacts/chrome/, and zips it as
web-ext-artifacts/immich-photos-for-gmail-X.Y.Z-chrome.zip.

The same source .js/.css/.html files are reused — only the manifest differs
between the Firefox and Chrome builds.
"""

import json
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "web-ext-artifacts"
STAGE_DIR = OUT_DIR / "chrome"

# Files that go into the Chrome build, relative to repo root. The Chrome
# manifest is written as `manifest.json` inside the zip.
INCLUDE = [
    "background.js",
    "page-bridge.js",
    "content/content.js",
    "content/content.css",
    "picker/picker.html",
    "picker/picker.js",
    "picker/picker.css",
    "options/options.html",
    "options/options.js",
    "icons/icon-48.png",
    "icons/icon-96.png",
    "icons/icon-128.png",
    "icons/icon-512.png",
]


def main() -> None:
    manifest_src = ROOT / "manifest.chrome.json"
    manifest = json.loads(manifest_src.read_text(encoding="utf-8"))
    version = manifest["version"]

    if STAGE_DIR.exists():
        shutil.rmtree(STAGE_DIR)
    STAGE_DIR.mkdir(parents=True)

    (STAGE_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    for rel in INCLUDE:
        src = ROOT / rel
        if not src.exists():
            raise SystemExit(f"missing source file: {rel}")
        dst = STAGE_DIR / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    zip_path = OUT_DIR / f"immich-photos-for-gmail-{version}-chrome.zip"
    if zip_path.exists():
        zip_path.unlink()

    with ZipFile(zip_path, "w", ZIP_DEFLATED) as zf:
        for path in sorted(STAGE_DIR.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(STAGE_DIR))

    print(f"built {zip_path}")
    print(f"unpacked dir: {STAGE_DIR}")


if __name__ == "__main__":
    main()
