"""Apply category, icon, plain-text description, ko-fi URL to AMO listing.

The description is plain text only — AMO's API sanitizer escapes inline tags
like <strong>/<b>/<code> when submitted via the v5 API, even though those
same tags survive when entered via the web form. So we use line breaks and
ALL-CAPS section headers instead.
"""
import jwt, time, requests, secrets, json, pathlib, sys

cred = pathlib.Path.home() / ".amo-credentials"
issuer = secret_key = None
for line in cred.read_text().splitlines():
    if line.startswith("issuer="): issuer = line.split("=",1)[1].strip()
    if line.startswith("secret="): secret_key = line.split("=",1)[1].strip()

def jwt_token():
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer, "jti": secrets.token_hex(8), "iat": now, "exp": now + 60},
        secret_key, algorithm="HS256",
    )

description = """\
A Firefox extension that lets you attach photos from your self-hosted Immich library directly to Gmail emails. No more download-then-re-upload round trip.

HOW IT WORKS
An "Immich" button is added to the Gmail compose toolbar (next to the paperclip). Click it and a picker opens with three tabs:
• Recent — your timeline, infinite-scrolled.
• Search — full-text Immich smart search ("beach 2024", "Alice", "snow").
• Albums — browse your existing albums with a live filter.

Multi-select photos, click Attach, and they appear as real Gmail attachment chips — exactly the same as if you had picked them from disk via the paperclip.

OPTIONAL RESIZE + STRIP METADATA
A single checkbox in the picker footer downscales the longest side to 1920px and re-encodes as JPEG, dropping EXIF / GPS / camera tags. Useful for smaller and more privacy-friendly attachments.

PRIVACY
Your Immich URL and API key are stored locally in your browser and are only ever sent to your own Immich server. No telemetry, no analytics, no third-party servers. The extension only runs on mail.google.com and the Immich origin you configure.

SETUP
1. In Immich, go to your profile → Account Settings → API Keys → New API Key.
2. Tick these permissions (or just "all"): asset.read, asset.download, asset.view, album.read, albumAsset.read, search.read.
3. Open the extension settings, paste your Immich base URL and API key, and click Save & Connect.
4. Open Gmail, click Compose, and the Immich button appears next to the paperclip.

SOURCE & BUG REPORTS
https://github.com/richard1912/immich-photos-for-gmail — MIT licensed, free forever.\
"""

# Step 1: JSON PATCH for category + description.
print("=== Step 1: category + description (JSON PATCH) ===")
r = requests.patch(
    "https://addons.mozilla.org/api/v5/addons/addon/immich-photos-for-gmail/",
    headers={"Authorization": f"JWT {jwt_token()}", "Content-Type": "application/json"},
    json={
        "categories": ["photos-music-videos"],
        "description": {"en-US": description},
    },
)
print(f"  Status: {r.status_code}")
if r.status_code >= 400:
    print(json.dumps(r.json(), indent=2)[:1500])
    sys.exit(1)
body = r.json()
print(f"  categories: {body.get('categories')}")

# Step 2: multipart PATCH for icon.
print("\n=== Step 2: icon (multipart PATCH) ===")
icon_path = pathlib.Path("icons/icon-512.png")
with icon_path.open("rb") as fh:
    r = requests.patch(
        "https://addons.mozilla.org/api/v5/addons/addon/immich-photos-for-gmail/",
        headers={"Authorization": f"JWT {jwt_token()}"},
        files={"icon": (icon_path.name, fh, "image/png")},
    )
print(f"  Status: {r.status_code}")
if r.status_code >= 400:
    print(r.text[:1500])
    sys.exit(1)
body = r.json()
print(f"  icon_url: {body.get('icon_url')}")
