const $ = (id) => document.getElementById(id);

async function load() {
  const { baseUrl, apiKey } = await browser.storage.local.get(["baseUrl", "apiKey"]);
  $("baseUrl").value = baseUrl || "";
  $("apiKey").value = apiKey || "";
}

function setStatus(msg, kind) {
  const el = $("status");
  el.textContent = msg;
  el.className = "status " + (kind || "");
}

function readForm() {
  return {
    baseUrl: $("baseUrl").value.trim().replace(/\/+$/, ""),
    apiKey: $("apiKey").value.trim(),
  };
}

function originPattern(baseUrl) {
  try {
    return new URL(baseUrl).origin + "/*";
  } catch {
    return null;
  }
}

// Save & Connect: validates URL, requests host permission for the user's
// Immich origin, persists the credentials, then verifies via /api/users/me.
$("save").addEventListener("click", async () => {
  const { baseUrl, apiKey } = readForm();
  if (!baseUrl) { setStatus("Enter your Immich base URL.", "err"); return; }
  if (!apiKey) { setStatus("Enter your Immich API key.", "err"); return; }
  const origin = originPattern(baseUrl);
  if (!origin) { setStatus("Invalid URL. Must be https://host", "err"); return; }

  setStatus("Requesting site access…", "");
  let granted;
  try {
    granted = await browser.permissions.request({
      origins: [origin, "https://mail.google.com/*"],
    });
  } catch (e) {
    setStatus("Permission request failed: " + (e.message || e), "err");
    return;
  }
  if (!granted) {
    setStatus("Site access was not granted. Click Save & Connect again to retry.", "err");
    return;
  }

  await browser.storage.local.set({ baseUrl, apiKey });
  setStatus("Testing connection…", "");
  const resp = await browser.runtime.sendMessage({ type: "ping" });
  if (resp && resp.ok && resp.data && resp.data.ok) {
    const user = resp.data.user || {};
    setStatus(`Connected as ${user.email || user.name || "user"}.`, "ok");
  } else {
    const err = (resp && (resp.error || (resp.data && resp.data.error))) || "unknown error";
    setStatus(`Saved, but connection failed: ${err}`, "err");
  }
});

load();
