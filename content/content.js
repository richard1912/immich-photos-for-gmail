(() => {
  // Guard against double-injection on extension reload, otherwise duplicate
  // click handlers would fire and produce duplicate attachments.
  if (window.__IMMICH_CONTENT_LOADED__) return;
  window.__IMMICH_CONTENT_LOADED__ = true;

  const debug = () => !!window.__IMMICH_DEBUG__;
  const log = (...a) => { if (debug()) console.log("[immich-attach]", ...a); };
  const warn = (...a) => console.warn("[immich-attach]", ...a);

  const BUTTON_MARK = "data-immich-attach-injected";
  const BRIDGE_TAG = "__IMMICH_ATTACH__";

  let pickerFrame = null;
  let pickerOverlay = null;
  let pickerTargetCompose = null;

  function findComposeDialogs() {
    return Array.from(document.querySelectorAll('div[role="dialog"]'))
      .filter((d) => d.querySelector('div[contenteditable="true"][role="textbox"]'));
  }

  function injectButton(compose) {
    if (compose.getAttribute(BUTTON_MARK)) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "immich-attach-btn";
    btn.title = "Attach from Immich";
    btn.setAttribute("aria-label", "Attach from Immich");
    btn.innerHTML = `<span class="immich-attach-icon" aria-hidden="true"></span><span class="immich-attach-label">Immich</span>`;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker(compose);
    });

    // Prefer placing the button inline with the toolbar icons by inserting
    // right after the paperclip ("Attach files") button. Falls back to the
    // outer .btC container, then to a floating absolute-positioned button.
    const paperclip = compose.querySelector(
      '[aria-label="Attach files"], [data-tooltip="Attach files"], [command="Files"]'
    );
    if (paperclip && paperclip.parentNode) {
      paperclip.parentNode.insertBefore(btn, paperclip.nextSibling);
    } else {
      const iconRow = compose.querySelector(".aDh, .a8X, .btC");
      if (iconRow) {
        iconRow.appendChild(btn);
      } else {
        btn.classList.add("immich-attach-floating");
        compose.appendChild(btn);
      }
    }

    compose.setAttribute(BUTTON_MARK, "1");
  }

  function scanCompose() {
    for (const dlg of findComposeDialogs()) injectButton(dlg);
  }

  function openPicker(compose) {
    pickerTargetCompose = compose;
    if (pickerFrame) closePicker();

    pickerOverlay = document.createElement("div");
    pickerOverlay.className = "immich-picker-overlay";
    pickerOverlay.addEventListener("click", (e) => {
      if (e.target === pickerOverlay) closePicker();
    });

    pickerFrame = document.createElement("iframe");
    pickerFrame.className = "immich-picker-frame";
    pickerFrame.src = browser.runtime.getURL("picker/picker.html");
    pickerFrame.allow = "fullscreen";

    pickerOverlay.appendChild(pickerFrame);
    document.body.appendChild(pickerOverlay);
  }

  function closePicker() {
    if (pickerOverlay && pickerOverlay.parentNode) {
      pickerOverlay.parentNode.removeChild(pickerOverlay);
    }
    pickerFrame = null;
    pickerOverlay = null;
    pickerTargetCompose = null;
  }

  window.addEventListener("message", async (event) => {
    if (!event.data || event.data.source !== "immich-picker") return;
    if (event.data.type === "close") {
      closePicker();
      return;
    }
    if (event.data.type === "attach") {
      const ids = event.data.assetIds || [];
      const options = event.data.options || {};
      const compose = pickerTargetCompose;
      closePicker();
      if (!compose || ids.length === 0) return;
      await attachAssetsToCompose(compose, ids, options);
    }
  });

  // Re-encode an image via OffscreenCanvas: downscale longest side to 1920px
  // (only if larger) and drop EXIF/GPS/camera metadata as a side effect of the
  // re-encode. HEIC/HEIF/RAW that Firefox can't decode falls back to original.
  async function processImage(buffer, mime, filename, opts) {
    if (!opts.shrink) return null;
    let bitmap;
    try {
      bitmap = await createImageBitmap(new Blob([buffer], { type: mime }));
    } catch (e) {
      warn("decode failed, sending original:", filename, e.message || e);
      return null;
    }
    let { width: w, height: h } = bitmap;
    const MAX = 1920;
    if (w > MAX || h > MAX) {
      const scale = Math.min(MAX / w, MAX / h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const outBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    const outBuffer = await outBlob.arrayBuffer();
    const newName = filename.replace(/\.[^./\\]+$/, "") + ".jpg";
    return { buffer: outBuffer, mime: "image/jpeg", filename: newName };
  }

  async function attachAssetsToCompose(compose, assetIds, options) {
    log("attaching", assetIds.length, "asset(s)", "opts:", options);
    const files = [];
    for (const id of assetIds) {
      const resp = await browser.runtime.sendMessage({
        type: "fetchOriginal",
        payload: { assetId: id },
      });
      if (!resp || !resp.ok) {
        warn("fetchOriginal failed", id, resp && resp.error);
        continue;
      }
      let { buffer, mime, filename } = resp.data;
      log("fetched", filename, buffer.byteLength, "bytes,", mime);
      const processed = await processImage(buffer, mime, filename, options);
      if (processed) {
        log("processed", filename, "→", processed.filename,
            buffer.byteLength, "→", processed.buffer.byteLength, "bytes");
        buffer = processed.buffer;
        mime = processed.mime;
        filename = processed.filename;
      }
      files.push({ buffer, mime, filename });
    }
    if (files.length === 0) {
      warn("no files fetched, aborting");
      return;
    }

    const dropTarget = compose.querySelector('div[contenteditable="true"][role="textbox"]') || compose;
    const buffers = files.map((f) => f.buffer);
    const meta = files.map((f) => ({ name: f.filename, type: f.mime || "application/octet-stream" }));

    dropTarget.setAttribute("data-immich-drop-target", "1");

    log("posting to bridge:", meta.length, "files");
    window.postMessage(
      { [BRIDGE_TAG]: true, type: "attach", meta, buffers },
      window.location.origin
    );

    setTimeout(() => dropTarget.removeAttribute("data-immich-drop-target"), 1000);
  }

  const obs = new MutationObserver(() => scanCompose());
  obs.observe(document.body, { childList: true, subtree: true });
  scanCompose();
})();
