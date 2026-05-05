(() => {
  const TAG = "__IMMICH_ATTACH__";
  const debug = () => !!window.__IMMICH_DEBUG__;
  const log = (...a) => { if (debug()) console.log("[immich-bridge]", ...a); };
  const warn = (...a) => console.warn("[immich-bridge]", ...a);

  // Guard against double-injection across extension reloads on the same Gmail
  // tab. Multiple message listeners would each populate the file input and
  // produce duplicate attachments.
  if (window.__IMMICH_BRIDGE_LOADED__) {
    log("already loaded; skipping duplicate bridge");
    return;
  }
  window.__IMMICH_BRIDGE_LOADED__ = true;
  log("loaded");

  function buildFiles(meta, buffers) {
    return meta.map((m, i) => {
      const buf = buffers[i];
      if (!buf) throw new Error(`buffer ${i} missing`);
      return new File([buf], m.name || `immich-${i}.jpg`, {
        type: m.type || "application/octet-stream",
      });
    });
  }

  function buildDataTransfer(files) {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    return dt;
  }

  // Populate Gmail's existing "Filedata" file input. Gmail wires a change
  // handler on it that uploads the file as a real attachment chip — same code
  // path as clicking the paperclip + picking a file from disk.
  function attachViaFileInput(target, files) {
    const compose = target.closest('[role="dialog"]') || document;
    const input =
      compose.querySelector('input[type="file"]') ||
      document.querySelector('input[type="file"]');
    if (!input) {
      warn("no file input found in compose dialog");
      return false;
    }
    try {
      const dt = buildDataTransfer(files);
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "files"
      ).set;
      nativeSetter.call(input, dt.files);
      log("set input.files, count=", input.files.length);
      // Only dispatch 'change' — Gmail's handler reacts to that. Firing 'input'
      // as well caused the file to be uploaded twice.
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      return input.files.length === files.length;
    } catch (e) {
      warn("attachViaFileInput failed", e);
      return false;
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data[TAG] !== true) return;
    if (data.type !== "attach") return;

    log("recv attach", { fileCount: (data.meta || []).length });

    let files;
    try {
      files = buildFiles(data.meta || [], data.buffers || []);
    } catch (e) {
      warn("file build failed", e);
      return;
    }
    log("built files", files.map((f) => `${f.name} ${f.size}b`));

    const target = document.querySelector('[data-immich-drop-target="1"]');
    if (!target) { warn("drop target marker not found"); return; }

    if (attachViaFileInput(target, files)) {
      log("done");
    } else {
      warn("attachment failed — no file input available in this compose dialog");
    }
  });
})();
