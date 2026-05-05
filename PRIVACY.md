# Privacy Policy

**Immich Photos for Gmail** is a Firefox extension. It does not have any backend servers and does not collect any data about you.

## What data is stored

The extension stores three small pieces of data in your browser, via `browser.storage.local`:

1. **`baseUrl`** — the Immich URL you enter on the settings page (e.g. `https://immich.example.com`).
2. **`apiKey`** — the API key you generate inside your Immich account.
3. **`attachOpts`** — the on/off state of the "Resize to 1080p & strip metadata" checkbox.

These values stay on your device. They are not synced to any server, are not transmitted anywhere by the extension, and are removed when you uninstall the extension.

## What network requests the extension makes

- **To your Immich server only**: the extension calls the Immich REST API (`/api/search/metadata`, `/api/assets/{id}/thumbnail`, `/api/assets/{id}/original`, `/api/albums`, `/api/users/me`, etc.) using the API key you configured. These requests are sent only to the URL you entered in the settings page.
- **To `mail.google.com`**: the extension injects a button into Gmail's compose UI and reads the compose dialog's DOM in order to add the selected files as attachments. No Gmail content is sent anywhere outside your browser.

The extension does **not** make any requests to:
- The author's servers
- Mozilla, Google, or any third-party telemetry / analytics service
- Any address other than the Immich URL you configured and `mail.google.com`

## Permissions explained

| Permission | Why |
|---|---|
| `storage` | Save your Immich URL, API key, and toggle preferences locally. |
| `https://mail.google.com/*` (host) | Inject the **Immich** button into the Gmail compose toolbar and place selected files into the compose dialog. |
| `https://*/*` (optional host) | Talk to the user-configured Immich server. The extension only ever requests the specific origin you typed into the settings page; it does not pre-grant access to "all sites". |

## Contact

For questions or concerns, open an issue at <https://github.com/richard1912/immich-photos-for-gmail/issues>.
