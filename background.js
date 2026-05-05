async function getConfig() {
  const { baseUrl, apiKey } = await browser.storage.local.get(["baseUrl", "apiKey"]);
  return {
    baseUrl: (baseUrl || "").replace(/\/+$/, ""),
    apiKey: apiKey || "",
  };
}

async function immichJson(path, { method = "GET", body } = {}) {
  const { baseUrl, apiKey } = await getConfig();
  if (!baseUrl) throw new Error("Immich URL not configured. Open the extension options.");
  if (!apiKey) throw new Error("Immich API key not configured. Open the extension options.");
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-api-key": apiKey,
      "Accept": "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Immich ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function immichBytes(path) {
  const { baseUrl, apiKey } = await getConfig();
  if (!baseUrl) throw new Error("Immich URL not configured.");
  if (!apiKey) throw new Error("Immich API key not configured.");
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`Immich GET ${path} → ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const mime = res.headers.get("Content-Type") || "application/octet-stream";
  const disposition = res.headers.get("Content-Disposition") || "";
  let filename = "";
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition);
  if (m) filename = decodeURIComponent(m[1]);
  return { buffer, mime, filename };
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

browser.runtime.onMessage.addListener((msg, sender) => {
  const fn = handlers[msg && msg.type];
  if (!fn) return false;
  return Promise.resolve()
    .then(() => fn(msg.payload || {}))
    .then((data) => ({ ok: true, data }))
    .catch((e) => ({ ok: false, error: String(e.message || e) }));
});
