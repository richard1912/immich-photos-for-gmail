# Changelog

## 0.2.11 (2026-05-05)

### Changed
- Album cards now stretch to fully fill the picker width while staying square. The 0.2.10 fixed-200px grid worked but left a wasted gutter on the right at wider sizes; the card size is now computed in JS (`fitAlbumGrid`) based on the available width and a 180px minimum, exposed as `--card-size`, and recomputed on window resize.
- Added a discreet coffee-cup icon in the picker footer next to the version label that links to Ko-fi. Stays grey by default, turns Ko-fi red on hover.

## 0.2.10 (2026-05-05)

### Fixed
- Album cards still overlapped each other after 0.2.9. Replaced the responsive 1fr-column grid + intrinsic-ratio sizing with a fixed-pixel grid: each card is a hard `200x200` box, with the grid using `repeat(auto-fill, 200px)` columns and `grid-auto-rows: 200px`. Math is now deterministic, the 12px gap is honored, and cards can never bleed into adjacent rows.

## 0.2.9 (2026-05-05)

### Fixed
- Album cards overlapped each other: rows touched with no gap and the bottom of one row's cards rendered behind the top of the next row's. The 0.2.7 layout used `aspect-ratio: 1/1` on the card with only absolutely-positioned children, so the grid had no real content height to size against. Switched the cover back to a flow-content block sized by `padding-bottom: 100%` so each card has a real intrinsic square height; the grid track sizes correctly and the 12px gap shows up again.

## 0.2.8 (2026-05-05)

### Changed
- Settings: the placeholder for the Immich base URL is now `https://demo.immich.app`, so first-time users can try the public demo instance immediately without needing their own server set up.

## 0.2.7 (2026-05-05)

### Fixed
- Album titles were not visible. The previous layout put name+count in a meta block below a square cover, which got clipped to the cover height by a CSS Grid + intrinsic-ratio interaction. Title and item count are now overlaid on the bottom of the cover with a dark gradient, so they are always visible regardless of how the grid sizes the card.

### Changed
- API and network errors now report multi-line, structured context: HTTP method + URL, status code, the first 400 chars of the server response, plus a status-specific hint (e.g. 401 -> "API key is invalid", 404 -> "make sure the base URL is right and has no /api suffix"). Network-layer failures (TLS, DNS, blocked origin) are explained too. The picker renders the error in a monospace block so URLs and JSON snippets stay readable, and the same text is also printed to the console.
- Thumbnail load failures now log the underlying error to `console.warn` so individual broken thumbs are debuggable in dev tools.

## 0.2.6 (2026-05-05)

### Changed
- Toolbar button now shows the official Immich five-petal flower logo instead of a generic stacked-photo glyph, so the button reads as "this attaches from Immich" at a glance.

## 0.2.5 (2026-05-05)

### Fixed
- "No photos found." and "Loading…" could overlap because tab switches did not reset the empty/error overlays before showing the loading overlay. They are now driven by a single mutex helper so only one status message is ever visible at a time.

### Changed
- Loading state now shows a small blue spinner instead of plain "Loading…" text.
- Empty state now shows a subtle photo-frame icon above the "No photos found" label.
- Album-card name is larger (14px) and bolder (600), in solid `#202124`, so the album title is the most prominent thing on each card.

## 0.2.4 (2026-05-05)

### Fixed
- Hard `min-height: 220px` safety net on `.album-card` so cards can never collapse to a thin line, even if the cover ratio fails for any reason. The 0.2.3 fix was correct but only worked once Firefox actually picked up the new CSS.

### Added
- Version label in the picker footer so it's unambiguous which build is loaded after a reload (e.g. `v0.2.4`).
- `console.warn` line on the Albums tab printing how many albums came back from the API.

## 0.2.3 (2026-05-05)

### Fixed
- Albums tab rendered as a stack of empty bordered rows instead of a grid of square album cards. The cover area was relying on `aspect-ratio` inside a flex column, which collapsed in some Firefox layout paths. Cover now uses a `position: relative` + `padding-bottom: 100%` square with a real `<img>` child loaded via the same thumbnail path the asset grid uses.

## 0.2.2 (2026-05-05)

### Fixed
- The Immich button no longer wraps below the Gmail compose toolbar (where it could be clipped by the dialog's bottom edge). The button is now inserted inline, immediately after the paperclip icon, and slimmed to match the surrounding icon row.

## 0.2.1 (2026-05-05)

### Added
- Settings page now has a footer with GitHub link, "Report a bug" link, and "Buy me a coffee" support button.
- Repository assets: brand icon (48 / 96 / 128 / 512 px), high-res source, and a 1280x640 social card.
- `.github/FUNDING.yml` to enable the GitHub Sponsor button.

### Changed
- Cosmetic prose cleanup across README, PRIVACY, CHANGELOG, comments, and UI strings.

## 0.2.0 (2026-05-05)

Initial public release.

### Added
- Firefox extension that injects an **Immich** button into Gmail's compose toolbar.
- Picker overlay with **Recent**, **Search**, and **Albums** tabs.
- Multi-select with thumbnail grid and infinite scroll.
- Native attachment via Gmail's existing file-input handler. Files appear as real attachment chips, not inline embeds.
- Optional "Resize to 1080p & strip metadata" toggle (single checkbox) that re-encodes selected photos via `OffscreenCanvas` before attaching, dropping EXIF / GPS / camera tags.
- Settings page with **Save & Connect** flow that validates the URL, requests host permission for the user's Immich origin, and tests the API.
- Auto-opens the settings page on first install.
- Friendly setup prompt in the picker when no Immich credentials are configured.
