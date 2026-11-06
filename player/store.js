/* Static pack catalogue browser. */
(function () {
  const catalogUrl = new URL("../store/catalog.json", location.href);
  let bound = false;

  const $ = (id) => document.getElementById(id);

  function hex(buffer) {
    return [...new Uint8Array(buffer)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function render(catalog) {
    const body = $("store-body");
    const packs = Array.isArray(catalog.packs) ? catalog.packs : [];
    if (!packs.length) {
      body.innerHTML = '<p class="widget-note">No packs are published yet.</p>';
      return;
    }
    body.innerHTML = `
      <div class="store-list">
        ${packs
          .map((pack) => {
            const installed = !!window.LorekeeperLibrary.getPack(pack.id);
            return `
            <div class="store-pack">
              <div class="store-pack-body">
                <p class="eyebrow">${escapeHtml(pack.level || "pack")}</p>
                <h3>${escapeHtml(pack.title || pack.id)}</h3>
                <p>${escapeHtml(pack.description || "")}</p>
                <div class="store-meta">
                  ${(pack.tags || [])
                    .slice(0, 4)
                    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                    .join("")}
                </div>
                <p class="widget-note">${pack.lessons || 0} lessons · ${Math.round((pack.size || 0) / 1024)} KB</p>
              </div>
              <button class="btn ${installed ? "" : "primary"}" type="button" data-store-add="${escapeHtml(pack.id)}" ${installed ? "disabled" : ""}>
                ${installed ? "Installed" : "Add"}
              </button>
            </div>`;
          })
          .join("")}
      </div>`;
    body.querySelectorAll("[data-store-add]").forEach((button) => {
      const pack = packs.find((item) => item.id === button.dataset.storeAdd);
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
      const data = JSON.parse(new TextDecoder().decode(buffer));
      const reserved = (state.index?.courses || [])
        .filter((course) => course.source !== "local")
        .map((course) => course.slug);
      const pack = window.LorekeeperLibrary.store(data, reserved);
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
      render(catalog);
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
