"""One-shot: fill in description, contributions URL, tags, dev comments."""
import jwt, time, requests, secrets, json, pathlib

cred = pathlib.Path.home() / ".amo-credentials"
issuer = secret_key = None
for line in cred.read_text().splitlines():
    if line.startswith("issuer="): issuer = line.split("=",1)[1].strip()
    if line.startswith("secret="): secret_key = line.split("=",1)[1].strip()

now = int(time.time())
token = jwt.encode(
    {"iss": issuer, "jti": secrets.token_hex(8), "iat": now, "exp": now + 60},
    secret_key, algorithm="HS256",
)

# AMO description sanitizer ALLOWS: <a>, <ul>, <ol>, <li>, <strong>, <em>, <br>.
# It STRIPS: <b> (use <strong>), <code> (no equivalent — falls back to plain).
description = """\
A Firefox extension that lets you attach photos from your self-hosted Immich library directly to Gmail emails. No more download-then-re-upload round trip.

<strong>How it works</strong>
An "Immich" button is added to the Gmail compose toolbar (next to the paperclip). Click it and a picker opens with three tabs:
<ul>
<li><strong>Recent</strong> — your timeline, infinite-scrolled.</li>
<li><strong>Search</strong> — full-text Immich smart search ("beach 2024", "Alice", "snow").</li>
<li><strong>Albums</strong> — browse your existing albums with a live filter.</li>
</ul>
Multi-select photos, click <strong>Attach</strong>, and they appear as real Gmail attachment chips — exactly the same as if you had picked them from disk via the paperclip.

<strong>Optional resize + strip metadata</strong>
A single checkbox in the picker footer downscales the longest side to 1920px and re-encodes as JPEG, dropping EXIF / GPS / camera tags. Useful for smaller and more privacy-friendly attachments.

<strong>Privacy</strong>
Your Immich URL and API key are stored locally in your browser and are only ever sent to your own Immich server. No telemetry, no analytics, no third-party servers. The extension only runs on mail.google.com and the Immich origin you configure.

<strong>Setup</strong>
<ol>
<li>In Immich, go to your profile → Account Settings → API Keys → New API Key.</li>
<li>Tick these permissions (or just "all"): asset.read, asset.download, asset.view, album.read, albumAsset.read, search.read.</li>
<li>Open the extension settings, paste your Immich base URL and API key, and click Save &amp; Connect.</li>
<li>Open Gmail, click Compose, and the Immich button appears next to the paperclip.</li>
</ol>

<strong>Source &amp; bug reports</strong>
<a href="https://github.com/richard1912/immich-photos-for-gmail">github.com/richard1912/immich-photos-for-gmail</a> — MIT licensed, free forever.\
"""

payload = {
    "description": {"en-US": description},
    "contributions_url": "https://ko-fi.com/richard1912",
    # AMO has a small fixed tag whitelist (no "email"/"photo"/"productivity").
    # Full list: GET /api/v5/addons/tags/. "google" is the only one that fits.
    "tags": ["google"],
    "developer_comments": {
        "en-US": (
            "Self-distributed unlisted addon — users provide their own self-hosted "
            "Immich URL and API key at install time. The extension only contacts the "
            "user's configured Immich origin and Gmail (mail.google.com). No telemetry."
        )
    },
}

print(f"PATCH /api/v5/addons/addon/immich-photos-for-gmail/")
r = requests.patch(
    "https://addons.mozilla.org/api/v5/addons/addon/immich-photos-for-gmail/",
    headers={"Authorization": f"JWT {token}", "Content-Type": "application/json"},
    json=payload,
)
print(f"Status: {r.status_code}")
try:
    body = r.json()
    print(json.dumps({
        "tags": body.get("tags"),
        "contributions_url": body.get("contributions_url"),
        "description_set": bool(body.get("description")),
        "developer_comments_set": bool(body.get("developer_comments")),
    }, indent=2))
    if r.status_code >= 400:
        print("\nFull error:")
        print(json.dumps(body, indent=2)[:2000])
except Exception:
    print(r.text[:1000])
