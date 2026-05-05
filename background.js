// Cross-browser shim: Firefox exposes `browser`, Chrome only `chrome`.
// Modern Chrome (88+) returns Promises from chrome.* APIs, so the rest of
// the file can use `browser.*` unchanged.
globalThis.browser ||= globalThis.chrome;

async function getConfig() {
  const { baseUrl, apiKey } = await browser.storage.local.get(["baseUrl", "apiKey"]);
  return {
    baseUrl: (baseUrl || "").replace(/\/+$/, ""),
    apiKey: apiKey || "",
  };
}

// Map an HTTP status or thrown fetch error into a multi-line, actionable
// message. Each line is a separate piece of context that the picker renders
// stacked, so the user sees: what happened, where, what the server said,
// and what to try next.
function explainHttp(method, url, status, body) {
  const head = `HTTP ${status} from ${method} ${url}`;
  const trimmed = (body || "").trim();
  const snippet = trimmed.slice(0, 400);
  let hint = "";
  if (status === 401) hint = "API key is invalid or missing. Re-check it in Settings.";
  else if (status === 403) hint = "API key does not have access to this resource. Check the key's permissions in Immich.";
  else if (status === 404) hint = "Endpoint not found. Make sure the base URL points at your Immich install (no /api suffix).";
  else if (status === 429) hint = "Immich is rate-limiting requests. Wait a moment and try again.";
  else if (status >= 500) hint = "Immich server error. Check the Immich server logs.";
  return [head, snippet ? `Response: ${snippet}` : null, hint].filter(Boolean).join("\n");
}

function explainFetchError(method, url, err) {
  const msg = String(err && err.message || err);
  const head = `Could not reach ${method} ${url}`;
  let hint = `Reason: ${msg}`;
  if (/NetworkError|Failed to fetch|Load failed|TypeError/i.test(msg)) {
    hint = `Reason: ${msg}\nThis usually means one of: (a) the URL is wrong, (b) Firefox does not have permission to reach this origin (open Settings and click Save & Connect again), or (c) the server is unreachable from this machine.`;
  } else if (/SSL|certificate|TLS/i.test(msg)) {
    hint = `Reason: ${msg}\nFirefox refused the TLS handshake. Check that the Immich server has a valid certificate.`;
  }
  return [head, hint].filter(Boolean).join("\n");
}

async function immichJson(path, { method = "GET", body } = {}) {
  const { baseUrl, apiKey } = await getConfig();
  if (!baseUrl) throw new Error("Immich URL not configured. Open the extension Settings and click Save & Connect.");
  if (!apiKey) throw new Error("Immich API key not configured. Open the extension Settings and click Save & Connect.");
  const url = `${baseUrl}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(explainFetchError(method, url, err));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(explainHttp(method, url, res.status, text));
  }
  try {
    return await res.json();
  } catch (err) {
    throw new Error(`Could not parse JSON from ${method} ${url}\nReason: ${err && err.message || err}`);
  }
}

// Encode a binary array as base64 in chunks. Direct
// String.fromCharCode(...new Uint8Array(buf)) blows the JS argument-count
// limit on multi-MB images.
function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function immichBytes(path) {
  const { baseUrl, apiKey } = await getConfig();
  if (!baseUrl) throw new Error("Immich URL not configured. Open Settings.");
  if (!apiKey) throw new Error("Immich API key not configured. Open Settings.");
  const url = `${baseUrl}${path}`;
  let res;
  try {
    res = await fetch(url, { headers: { "x-api-key": apiKey } });
  } catch (err) {
    throw new Error(explainFetchError("GET", url, err));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(explainHttp("GET", url, res.status, text));
  }
  // Return base64. Chrome's chrome.runtime.sendMessage JSON-serializes the
  // payload, which silently drops ArrayBuffer to {}. Firefox uses structured
  // clone and would preserve the buffer, but encoding unconditionally keeps
  // a single transport path across browsers. Recipients decode via atob.
  const bytes = new Uint8Array(await res.arrayBuffer());
  const data = bytesToBase64(bytes);
  const mime = res.headers.get("Content-Type") || "application/octet-stream";
  const disposition = res.headers.get("Content-Disposition") || "";
  let filename = "";
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition);
  if (m) filename = decodeURIComponent(m[1]);
  return { data, mime, filename };
}

const handlers = {
  async openOptions() {
    await browser.runtime.openOptionsPage();
  },

  async ping() {
    const { baseUrl, apiKey } = await getConfig();
    if (!baseUrl) return { ok: false, error: "Immich URL not set" };
    if (!apiKey) return { ok: false, error: "API key not set" };
    try {
      const ping = await fetch(`${baseUrl}/api/server/ping`, { headers: { "x-api-key": apiKey } });
      if (!ping.ok) return { ok: false, error: `ping ${ping.status}` };
      const me = await fetch(`${baseUrl}/api/users/me`, { headers: { "x-api-key": apiKey } });
      if (!me.ok) return { ok: false, error: `users/me ${me.status}` };
      const user = await me.json();
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  },

  async listRecent({ page = 1, size = 60 }) {
    return immichJson("/api/search/metadata", {
      method: "POST",
      body: { page, size, order: "desc", withExif: false, type: "IMAGE" },
    });
  },

  async searchSmart({ query, page = 1, size = 60 }) {
    return immichJson("/api/search/smart", {
      method: "POST",
      body: { query, page, size, type: "IMAGE" },
    });
  },

  async listAlbums() {
    return immichJson("/api/albums");
  },

  async listAlbumAssets({ albumId }) {
    return immichJson(`/api/albums/${encodeURIComponent(albumId)}`);
  },

  async fetchThumbnail({ assetId, size = "preview" }) {
    return immichBytes(`/api/assets/${encodeURIComponent(assetId)}/thumbnail?size=${encodeURIComponent(size)}`);
  },

  async fetchOriginal({ assetId }) {
    const got = await immichBytes(`/api/assets/${encodeURIComponent(assetId)}/original`);
    if (!got.filename) {
      const meta = await immichJson(`/api/assets/${encodeURIComponent(assetId)}`).catch(() => null);
      if (meta && meta.originalFileName) got.filename = meta.originalFileName;
    }
    if (!got.filename) got.filename = `${assetId}.jpg`;
    return got;
  },
};

// On install (or update from a version that didn't have config), pop the
// options page so the user knows where to enter their Immich URL + API key.
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;
  try {
    await browser.runtime.openOptionsPage();
  } catch (_) {
    // Falls through silently. User can still open via about:addons.
  }
});

// Use the sendResponse + return true pattern. Chrome MV3 ignores a Promise
// returned from a listener, so a Firefox-only Promise return would silently
// drop replies in Chrome. This pattern works in both browsers.
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fn = handlers[msg && msg.type];
  if (!fn) return false;
  Promise.resolve()
    .then(() => fn(msg.payload || {}))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true;
});
