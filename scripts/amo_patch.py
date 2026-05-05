"""PATCH AMO addon metadata via the v5 API.

Usage: python scripts/amo_patch.py <current-slug> <field=value> [field=value...]

Examples:
  python scripts/amo_patch.py e8375f8440b7404a82c1 slug=immich-photos-for-gmail
  python scripts/amo_patch.py immich-photos-for-gmail contributions_url=https://ko-fi.com/richard1912
"""
import jwt, time, requests, secrets, sys, json, pathlib

if len(sys.argv) < 3:
    print(__doc__); sys.exit(2)

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

current_slug = sys.argv[1]
payload = {}
for kv in sys.argv[2:]:
    k, v = kv.split("=", 1)
    payload[k] = v

print(f"PATCH /api/v5/addons/addon/{current_slug}/")
print(f"Body: {json.dumps(payload, indent=2)}")

r = requests.patch(
    f"https://addons.mozilla.org/api/v5/addons/addon/{current_slug}/",
    headers={"Authorization": f"JWT {token}", "Content-Type": "application/json"},
    json=payload,
)
print(f"\nStatus: {r.status_code}")
try:
    body = r.json()
    print(json.dumps({k: body[k] for k in payload if k in body}, indent=2))
except Exception:
    print(r.text[:500])
