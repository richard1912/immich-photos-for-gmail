(async () => {
  const { baseUrl, apiKey } = await browser.storage.local.get(["baseUrl", "apiKey"]);
  if (!baseUrl || !apiKey) {
    renderSetupPrompt();
    return;
  }
  initPicker();
})();

function renderSetupPrompt() {
  document.body.innerHTML = `
    <div class="setup-prompt">
      <h2>Welcome</h2>
      <p>Configure your Immich server to start attaching photos.</p>
      <div class="setup-actions">
        <button id="open-options" class="primary">Open settings</button>
        <button id="setup-close">Close</button>
      </div>
    </div>
  `;
  document.getElementById("open-options").addEventListener("click", () => {
    browser.runtime.sendMessage({ type: "openOptions" });
    parent.postMessage({ source: "immich-picker", type: "close" }, "*");
  });
  document.getElementById("setup-close").addEventListener("click", () => {
    parent.postMessage({ source: "immich-picker", type: "close" }, "*");
  });
}

function initPicker() {
  const state = {
    tab: "recent",
    page: 1,
    pageSize: 60,
    query: "",
    albumId: null,
    loading: false,
    done: false,
    selected: new Map(),
    thumbCache: new Map(),
    allAlbums: null,
    albumFilter: "",
  };

  const els = {
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    loading: document.getElementById("loading"),
    error: document.getElementById("error"),
    toolbar: document.getElementById("toolbar"),
    searchInput: document.getElementById("search-input"),
    searchBtn: document.getElementById("search-btn"),
    albumSearch: document.getElementById("album-search"),
    albumFilter: document.getElementById("album-filter"),
    albumList: document.getElementById("album-list"),
    count: document.getElementById("count"),
    attach: document.getElementById("attach"),
    cancel: document.getElementById("cancel"),
    close: document.getElementById("close"),
    sentinel: document.getElementById("sentinel"),
    optShrink: document.getElementById("opt-shrink"),
    version: document.getElementById("version"),
  };

  try {
    const v = browser.runtime.getManifest().version;
    if (els.version) els.version.textContent = `v${v}`;
  } catch (_) {}

  // Persist toggle state across sessions.
  browser.storage.local.get("attachOpts").then(({ attachOpts }) => {
    if (attachOpts) els.optShrink.checked = !!attachOpts.shrink;
  });
  els.optShrink.addEventListener("change", () => {
    browser.storage.local.set({ attachOpts: { shrink: els.optShrink.checked } });
  });

  function call(type, payload) {
    return browser.runtime.sendMessage({ type, payload }).then((resp) => {
      if (!resp) throw new Error("no response");
      if (!resp.ok) throw new Error(resp.error || "unknown error");
      return resp.data;
    });
  }

  function setTab(tab) {
    state.tab = tab;
    state.page = 1;
    state.done = false;
    state.albumId = null;
    for (const t of document.querySelectorAll(".tab")) {
      t.classList.toggle("active", t.dataset.tab === tab);
    }
    els.toolbar.hidden = tab !== "search";
    els.albumSearch.hidden = tab !== "albums";
    els.albumList.hidden = tab !== "albums";
    els.grid.innerHTML = "";
    setStatus("none");
    removeAlbumBack();
    if (tab === "albums") {
      showAlbums();
    } else {
      loadMore();
    }
  }

  // Mutex helper: only one of loading / empty / error can be visible.
  function setStatus(kind, message) {
    els.loading.hidden = kind !== "loading";
    els.empty.hidden = kind !== "empty";
    els.error.hidden = kind !== "error";
    if (kind === "error") {
      const text = String(message || "Something went wrong");
      els.error.innerHTML = "";
      const title = document.createElement("div");
      title.className = "err-title";
      title.textContent = "Couldn't load from Immich";
      const pre = document.createElement("pre");
      pre.textContent = text;
      els.error.appendChild(title);
      els.error.appendChild(pre);
      console.warn("[immich-picker] error:\n" + text);
    } else {
      els.error.innerHTML = "";
    }
  }
  function showError(msg) { setStatus("error", String(msg)); }
  function clearError() { if (!els.error.hidden) setStatus("none"); }

  async function loadThumb(assetId, imgEl) {
    if (state.thumbCache.has(assetId)) {
      imgEl.src = state.thumbCache.get(assetId);
      return;
    }
    try {
      const { buffer, mime } = await call("fetchThumbnail", { assetId, size: "preview" });
      const blob = new Blob([buffer], { type: mime || "image/jpeg" });
      const url = URL.createObjectURL(blob);
      state.thumbCache.set(assetId, url);
      imgEl.src = url;
    } catch (e) {
      imgEl.alt = "thumb error";
      console.warn("[immich-picker] thumb load failed for", assetId, "\n" + (e && e.message || e));
    }
  }

  function renderAssets(assets) {
    const frag = document.createDocumentFragment();
    for (const a of assets) {
      if (a.type && a.type !== "IMAGE") continue;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.id = a.id;
      if (state.selected.has(a.id)) cell.classList.add("selected");

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = a.originalFileName || a.id;
      cell.appendChild(img);

      const check = document.createElement("div");
      check.className = "check";
      check.textContent = "✓";
      cell.appendChild(check);

      cell.addEventListener("click", () => {
        if (state.selected.has(a.id)) {
          state.selected.delete(a.id);
          cell.classList.remove("selected");
        } else {
          state.selected.set(a.id, { id: a.id, name: a.originalFileName });
          cell.classList.add("selected");
        }
        updateFooter();
      });

      frag.appendChild(cell);
      thumbObs.observe(cell);
      cell._loadThumb = () => loadThumb(a.id, img);
    }
    els.grid.appendChild(frag);
  }

  const thumbObs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.target._loadThumb) {
          e.target._loadThumb();
          e.target._loadThumb = null;
          thumbObs.unobserve(e.target);
        }
      }
    },
    { rootMargin: "200px" }
  );

  function updateFooter() {
    const n = state.selected.size;
    els.count.textContent = `${n} selected`;
    els.attach.disabled = n === 0;
    els.attach.textContent = n > 0 ? `Attach (${n})` : "Attach";
  }

  async function loadMore() {
    if (state.loading || state.done) return;
    state.loading = true;
    setStatus("loading");
    try {
      let data;
      if (state.tab === "recent") {
        data = await call("listRecent", { page: state.page, size: state.pageSize });
      } else if (state.tab === "search") {
        if (!state.query) { state.loading = false; setStatus("none"); return; }
        data = await call("searchSmart", { query: state.query, page: state.page, size: state.pageSize });
      } else if (state.tab === "albums" && state.albumId) {
        data = await call("listAlbumAssets", { albumId: state.albumId });
        const assets = (data && data.assets) || [];
        renderAssets(assets);
        state.done = true;
        setStatus(assets.length === 0 ? "empty" : "none");
        state.loading = false;
        return;
      } else {
        state.loading = false;
        setStatus("none");
        return;
      }

      const items = (data && data.assets && data.assets.items) || [];
      const nextPage = data && data.assets && data.assets.nextPage;
      renderAssets(items);
      if (items.length === 0 && state.page === 1) setStatus("empty");
      else setStatus("none");
      if (!nextPage || items.length < state.pageSize) state.done = true;
      else state.page = parseInt(nextPage, 10) || state.page + 1;
    } catch (e) {
      showError(String(e.message || e));
      state.done = true;
    } finally {
      state.loading = false;
    }
  }

  const scrollObs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) loadMore();
      }
    },
    { root: document.querySelector(".grid-wrap"), rootMargin: "300px" }
  );
  scrollObs.observe(els.sentinel);

  // Per-card ResizeObserver: whenever a card's rendered width changes
  // (initial layout, window resize, scrollbar appearing, etc.), force
  // its height to match its width so the card stays square. This bypasses
  // any aspect-ratio / padding-bottom interaction with grid sizing that
  // earlier attempts kept getting wrong.
  const cardRO = (typeof ResizeObserver !== "undefined")
    ? new ResizeObserver((entries) => {
        for (const e of entries) {
          const w = e.contentRect && e.contentRect.width;
          if (w && w > 0) e.target.style.height = w + "px";
        }
      })
    : null;

  function renderAlbumCard(a) {
    const card = document.createElement("div");
    card.className = "album-card";
    card.title = a.albumName || "(untitled)";

    const cover = document.createElement("div");
    cover.className = "cover";
    const coverImg = document.createElement("img");
    coverImg.alt = "";
    cover.appendChild(coverImg);
    card.appendChild(cover);

    const meta = document.createElement("div");
    meta.className = "meta";
    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = a.albumName || "(untitled)";
    const countEl = document.createElement("div");
    countEl.className = "count";
    countEl.textContent = `${a.assetCount || 0} items`;
    meta.appendChild(nameEl);
    meta.appendChild(countEl);
    card.appendChild(meta);

    if (a.albumThumbnailAssetId) {
      loadThumb(a.albumThumbnailAssetId, coverImg);
    }
    card.addEventListener("click", () => openAlbum(a.id, a.albumName));
    if (cardRO) cardRO.observe(card);
    return card;
  }

  function renderAlbumList(albums) {
    els.albumList.innerHTML = "";
    if (!albums || albums.length === 0) {
      setStatus("empty");
      return;
    }
    setStatus("none");
    const frag = document.createDocumentFragment();
    for (const a of albums) frag.appendChild(renderAlbumCard(a));
    els.albumList.appendChild(frag);
  }

  function applyAlbumFilter() {
    const all = state.allAlbums || [];
    const q = state.albumFilter.trim().toLowerCase();
    if (!q) {
      renderAlbumList(all);
      return;
    }
    const filtered = all.filter((a) => (a.albumName || "").toLowerCase().includes(q));
    renderAlbumList(filtered);
  }

  els.albumFilter.addEventListener("input", () => {
    state.albumFilter = els.albumFilter.value;
    applyAlbumFilter();
  });

  async function showAlbums() {
    setStatus("loading");
    try {
      const albums = await call("listAlbums");
      console.warn("[immich-picker] albums loaded:", Array.isArray(albums) ? albums.length : albums);
      state.allAlbums = Array.isArray(albums) ? albums : [];
      applyAlbumFilter();
    } catch (e) {
      showError(String(e.message || e));
    }
  }

  function removeAlbumBack() {
    const back = document.querySelector(".album-back");
    if (back) back.remove();
  }

  function openAlbum(id, name) {
    state.albumId = id;
    state.page = 1;
    state.done = false;
    els.albumSearch.hidden = true;
    els.albumList.hidden = true;
    els.grid.innerHTML = "";
    setStatus("none");
    removeAlbumBack();
    const back = document.createElement("button");
    back.className = "album-back";
    back.textContent = `← ${name || "Albums"}`;
    back.addEventListener("click", () => {
      state.albumId = null;
      removeAlbumBack();
      els.albumSearch.hidden = false;
      els.albumList.hidden = false;
      els.grid.innerHTML = "";
      state.done = false;
    });
    document.body.insertBefore(back, document.querySelector(".grid-wrap"));
    loadMore();
  }

  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => setTab(t.dataset.tab));
  });
  els.searchBtn.addEventListener("click", runSearch);
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
  function runSearch() {
    state.query = els.searchInput.value.trim();
    state.page = 1;
    state.done = false;
    els.grid.innerHTML = "";
    setStatus("none");
    if (state.query) loadMore();
  }

  els.attach.addEventListener("click", () => {
    const ids = Array.from(state.selected.keys());
    const options = { shrink: els.optShrink.checked };
    parent.postMessage({ source: "immich-picker", type: "attach", assetIds: ids, options }, "*");
  });
  els.cancel.addEventListener("click", () => {
    parent.postMessage({ source: "immich-picker", type: "close" }, "*");
  });
  els.close.addEventListener("click", () => {
    parent.postMessage({ source: "immich-picker", type: "close" }, "*");
  });

  setTab("recent");
  updateFooter();
}
