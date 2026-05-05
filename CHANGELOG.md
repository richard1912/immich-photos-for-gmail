# Changelog

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
