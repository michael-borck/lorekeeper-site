/* Static pack catalogue browser with search and filters. */
(function () {
  const catalogUrl = new URL("../store/catalog.json", location.href);
  const CATEGORIES = [
    { id: "all", label: "All", tags: [] },
    { id: "ai", label: "AI and judgement", tags: ["ai", "judgement", "conversation", "evaluation", "prompting"] },
    { id: "security", label: "Security and audit", tags: ["security", "audit", "forensics", "incident", "risk", "assurance"] },
    { id: "systems", label: "Systems and design", tags: ["systems", "analysis", "design", "requirements"] },
    { id: "networks", label: "Networks", tags: ["networking", "routing", "simulation"] },
    { id: "programming", label: "Programming", tags: ["python", "web", "html", "css", "javascript", "react", "llm", "api"] },
    { id: "education", label: "Education", tags: ["education", "teaching", "projects"] },
    { id: "reference", label: "Reference", tags: ["reference"] },
  ];
  let bound = false;
  let catalogPacks = [];
  let filters = { q: "", category: "all", level: "all", installed: false, sort: "title" };

  const $ = (id) => document.getElementById(id);
  const ART = {
    ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="6" width="16" height="13" rx="3"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><path d="M12 3v3M8 21h8"/></svg>',
    security: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    systems: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="8" height="6" rx="2"/><rect x="13" y="14" width="8" height="6" rx="2"/><path d="M11 7h4v10"/></svg>',
    networks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.5 7L6 15.5M13.5 7L18 15.5M7.5 18h9"/></svg>',
    programming: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 6L4 12l5 6M15 6l5 6-5 6"/></svg>',
    education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 6c-2-1.5-4-2-7-2v14c3 0 5 .5 7 2 2-1.5 4-2 7-2V4c-3 0-5 .5-7 2z"/><path d="M12 6v14"/></svg>',
    reference: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="5" width="16" height="5" rx="2"/><rect x="4" y="14" width="16" height="5" rx="2"/></svg>',
  };

  function storeArt(id) {
    return ART[id] || ART.all;
  }

  function hex(buffer) {
    return [...new Uint8Array(buffer)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function base64Bytes(value) {
    const binary = atob(String(value || ""));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function categoryFor(pack) {
    const tags = new Set((pack.tags || []).map((tag) => String(tag).toLowerCase()));
    return CATEGORIES.find((category) =>
      category.tags.some((tag) => tags.has(tag))
    ) || CATEGORIES[0];
  }

  function matches(pack) {
    const category = CATEGORIES.find((item) => item.id === filters.category) || CATEGORIES[0];
    const tags = new Set((pack.tags || []).map((tag) => String(tag).toLowerCase()));
    if (category.id !== "all" && !category.tags.some((tag) => tags.has(tag))) return false;
    if (filters.level !== "all" && pack.level !== filters.level) return false;
    if (filters.installed && !window.LorekeeperLibrary.getPack(pack.id)) return false;
    const query = filters.q.trim().toLowerCase();
    if (!query) return true;
    return [pack.title, pack.description, ...(pack.tags || [])]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function sortPacks(packs) {
    const copy = [...packs];
    if (filters.sort === "lessons") copy.sort((a, b) => (a.lessons || 0) - (b.lessons || 0));
    else if (filters.sort === "longest") copy.sort((a, b) => (b.lessons || 0) - (a.lessons || 0));
    else if (filters.sort === "level") copy.sort((a, b) => String(a.level).localeCompare(String(b.level)));
    else copy.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return copy;
  }

  function card(pack) {
    const installed = !!window.LorekeeperLibrary.getPack(pack.id);
    const category = categoryFor(pack);
    return `
      <article class="store-card" data-pack="${escapeHtml(pack.id)}">
        <div class="store-card-head">
          <span class="store-art" aria-hidden="true">${storeArt(category.id)}</span>
          <span class="store-level">${escapeHtml(pack.level || "pack")}</span>
        </div>
        <h3>${escapeHtml(pack.title || pack.id)}</h3>
        <p>${escapeHtml(pack.description || "")}</p>
        <div class="store-meta">
          ${(pack.tags || []).slice(0, 5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="store-card-foot">
          <span class="widget-note">${pack.lessons || 0} lessons · ${Math.round((pack.size || 0) / 1024)} KB</span>
          <button class="btn ${installed ? "" : "primary"}" type="button" data-store-add="${escapeHtml(pack.id)}" ${installed ? "disabled" : ""}>
            ${installed ? "Installed" : "Add"}
          </button>
        </div>
      </article>`;
  }

  function render() {
    const body = $("store-body");
    const packs = sortPacks(catalogPacks.filter(matches));
    const levels = [...new Set(catalogPacks.map((pack) => pack.level).filter(Boolean))].sort();
    body.innerHTML = `
      <div class="store-toolbar">
        <label class="store-search">
          <span>Search</span>
          <input id="store-search" type="search" placeholder="Search packs, topics, tools" value="${escapeHtml(filters.q)}">
        </label>
        <label class="store-select">
          <span>Level</span>
          <select id="store-level">
            <option value="all">All levels</option>
            ${levels.map((level) => `<option value="${escapeHtml(level)}" ${filters.level === level ? "selected" : ""}>${escapeHtml(level)}</option>`).join("")}
          </select>
        </label>
        <label class="store-select">
          <span>Sort</span>
          <select id="store-sort">
            <option value="title" ${filters.sort === "title" ? "selected" : ""}>Title</option>
            <option value="lessons" ${filters.sort === "lessons" ? "selected" : ""}>Shortest</option>
            <option value="longest" ${filters.sort === "longest" ? "selected" : ""}>Longest</option>
            <option value="level" ${filters.sort === "level" ? "selected" : ""}>Level</option>
          </select>
        </label>
        <label class="store-installed">
          <input id="store-installed" type="checkbox" ${filters.installed ? "checked" : ""}>
          <span>Installed only</span>
        </label>
      </div>
      <div class="store-categories" role="group" aria-label="Categories">
        ${CATEGORIES.map((category) => `<button class="store-cat ${filters.category === category.id ? "active" : ""}" type="button" data-store-cat="${category.id}">${category.label}</button>`).join("")}
      </div>
      <p class="widget-note">${packs.length} pack${packs.length === 1 ? "" : "s"} shown. Packs are signed and verified before install.</p>
      <div class="store-grid">
        ${packs.length ? packs.map(card).join("") : '<p class="store-empty">No packs match those filters.</p>'}
      </div>`;
    bindControls();
  }

  function bindControls() {
    const search = $("store-search");
    search?.addEventListener("input", (event) => {
      filters.q = event.target.value;
      render();
      const input = $("store-search");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
    $("store-level")?.addEventListener("change", (event) => {
      filters.level = event.target.value;
      render();
    });
    $("store-sort")?.addEventListener("change", (event) => {
      filters.sort = event.target.value;
      render();
    });
    $("store-installed")?.addEventListener("change", (event) => {
      filters.installed = event.target.checked;
      render();
    });
    document.querySelectorAll("[data-store-cat]").forEach((button) => {
      button.addEventListener("click", () => {
        filters.category = button.dataset.storeCat;
        render();
      });
    });
    document.querySelectorAll("[data-store-add]").forEach((button) => {
      const pack = catalogPacks.find((item) => item.id === button.dataset.storeAdd);
      button.addEventListener("click", () => addPack(pack, button));
    });
  }

  async function addPack(entry, button) {
    if (!entry) return;
    if (!confirm("Packs can contain exercise test code. Only add packs you trust. Continue?")) return;
    button.disabled = true;
    button.textContent = "Adding...";
    try {
      const response = await fetch(new URL(entry.url, catalogUrl));
      if (!response.ok) throw new Error(`Pack download failed (${response.status}).`);
      const buffer = await response.arrayBuffer();
      if (entry.sha256) {
        if (!crypto.subtle) throw new Error("This browser cannot verify the pack hash.");
        const actual = hex(await crypto.subtle.digest("SHA-256", buffer));
        if (actual !== String(entry.sha256).toLowerCase()) {
          throw new Error("The pack hash does not match the catalogue.");
        }
      }
      if (!entry.signature || !entry.keyId) {
        throw new Error("This pack is not signed.");
      }
      const trusted = window.LOREKEEPER_TRUSTED_KEYS?.[entry.keyId];
      if (!trusted) throw new Error("The pack is signed by an unknown key.");
      if (!window.nacl?.sign?.detached?.verify) {
        throw new Error("Signature verification is not available in this browser.");
      }
      const valid = window.nacl.sign.detached.verify(
        new Uint8Array(buffer),
        base64Bytes(entry.signature),
        base64Bytes(trusted)
      );
      if (!valid) throw new Error("The pack signature is invalid.");
      const data = JSON.parse(new TextDecoder().decode(buffer));
      const reserved = (state.index?.allCourses || state.index?.courses || [])
        .filter((course) => course.source !== "local")
        .map((course) => course.slug);
      const pack = await window.LorekeeperLibrary.store(data, reserved);
      button.textContent = "Installed";
      button.disabled = true;
      if (typeof toast === "function") toast(`Added ${pack.title}.`);
      setTimeout(() => location.reload(), 600);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Add";
      if (typeof toast === "function") toast(error.message || "Could not add the pack.");
    }
  }

  async function open() {
    const dialog = $("store-dialog");
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const body = $("store-body");
    body.innerHTML = '<p class="widget-note">Loading the pack store...</p>';
    try {
      const response = await fetch(catalogUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("not found");
      const catalog = await response.json();
      if (catalog.format !== "lorekeeper.catalog" || Number(catalog.version) !== 1) {
        throw new Error("not a Lorekeeper catalogue");
      }
      await window.LorekeeperLibrary?.ready();
      catalogPacks = Array.isArray(catalog.packs) ? catalog.packs : [];
      render();
    } catch {
      body.innerHTML =
        '<p class="widget-note bad">The pack store is not available. You can still import a pack file from the course picker.</p>';
    }
  }

  function bind() {
    if (bound) return;
    const dialog = $("store-dialog");
    const close = $("store-close");
    if (!dialog || !close) return;
    bound = true;
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-store-open]")) {
        event.preventDefault();
        open();
      }
    });
  }

  bind();
  window.LorekeeperStore = { open };
})();
