"""Read AMO addon metadata via the v5 API."""
import jwt, time, requests, os, secrets, sys, json, pathlib

cred = pathlib.Path.home() / ".amo-credentials"
issuer = secret = None
for line in cred.read_text().splitlines():
    if line.startswith("issuer="): issuer = line.split("=",1)[1].strip()
    if line.startswith("secret="): secret = line.split("=",1)[1].strip()

now = int(time.time())
token = jwt.encode(
    {"iss": issuer, "jti": secrets.token_hex(8), "iat": now, "exp": now + 60},
    secret, algorithm="HS256",
)

slug = sys.argv[1] if len(sys.argv) > 1 else "e8375f8440b7404a82c1"
r = requests.get(
    f"https://addons.mozilla.org/api/v5/addons/addon/{slug}/",
    headers={"Authorization": f"JWT {token}"},
)
print(r.status_code)
print(json.dumps(r.json(), indent=2)[:4000])
