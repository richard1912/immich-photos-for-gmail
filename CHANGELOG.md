# Changelog

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
