/* Library management: visibility and removal for built-in and local packs. */
(function () {
  const HIDDEN_KEY = "hidden-courses";
  let bound = false;

  const $ = (id) => document.getElementById(id);

  function allCourses() {
    return state.index?.allCourses || state.index?.courses || [];
  }

  function hiddenSet() {
    const value = window.LorekeeperPackStorage?.getSetting(HIDDEN_KEY, []);
    return new Set(Array.isArray(value) ? value : []);
  }

  async function saveHidden(set) {
    await window.LorekeeperPackStorage?.setSetting(HIDDEN_KEY, [...set]);
    const all = allCourses();
    state.index.courses = all.filter((course) => !set.has(course.slug));
  }

  function row(course, hidden) {
    const local = course.source === "local";
    return `
      <div class="manage-row">
        <div class="manage-main">
          <strong>${escapeHtml(course.title)}</strong>
          <span>${local ? "Local pack" : "Built-in"} · ${course.lessons} lessons</span>
        </div>
        <label class="manage-toggle">
          <input type="checkbox" data-manage-visible="${escapeHtml(course.slug)}" ${hidden.has(course.slug) ? "" : "checked"}>
          <span>Visible</span>
        </label>
        ${
          local
            ? `<button class="ghost small" type="button" data-manage-remove="${escapeHtml(course.packId || "")}">Remove</button>`
            : ""
        }
      </div>`;
  }

  function render() {
    const body = $("manage-body");
    if (!body) return;
    const hidden = hiddenSet();
    const courses = allCourses();
    if (!courses.length) {
      body.innerHTML = '<p class="widget-note">No courses are installed. Add a pack from the store or import one.</p>';
      return;
    }
    body.innerHTML = `
      <p class="widget-note">Hide a course to keep its progress and remove it from the library. Remove a local pack to delete its data from this device.</p>
      <div class="manage-list">
        ${courses.map((course) => row(course, hidden)).join("")}
      </div>
      <div class="toolbar manage-toolbar">
        <button class="btn" type="button" data-manage-starter>Restore starter kit</button>
        <button class="btn" type="button" data-manage-empty>Hide all</button>
      </div>`;
  }

  async function toggle(slug, visible) {
    const hidden = hiddenSet();
    if (visible) hidden.delete(slug);
    else hidden.add(slug);
    await saveHidden(hidden);
    render();
    window.LorekeeperApp?.renderPicker?.();
  }

  async function remove(packId) {
    const pack = window.LorekeeperLibrary?.getPack(packId);
    if (!pack) return;
    if (!confirm(`Remove "${pack.title}" and its local progress from this device?`)) return;
    await window.LorekeeperLibrary.removePack(packId);
    const hidden = hiddenSet();
    for (const course of pack.courses || []) hidden.delete(course.slug);
    await saveHidden(hidden);
    state.index.allCourses = allCourses().filter((course) => course.packId !== packId);
    render();
    window.LorekeeperApp?.renderPicker?.();
  }

  async function restoreStarter() {
    const hidden = hiddenSet();
    for (const course of allCourses()) {
      if (course.source !== "local") hidden.delete(course.slug);
    }
    await saveHidden(hidden);
    render();
    window.LorekeeperApp?.renderPicker?.();
    const dialog = $("manage-dialog");
    if (dialog?.open) dialog.close();
  }

  async function hideAll() {
    if (!confirm("Hide every course? Progress stays on this device.")) return;
    const hidden = new Set(allCourses().map((course) => course.slug));
    await saveHidden(hidden);
    render();
    window.LorekeeperApp?.renderPicker?.();
  }

  function open() {
    render();
    const dialog = $("manage-dialog");
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function bind() {
    if (bound) return;
    const dialog = $("manage-dialog");
    const close = $("manage-close");
    if (!dialog || !close) return;
    bound = true;
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-manage-open]")) {
        event.preventDefault();
        open();
        return;
      }
      if (event.target.closest("[data-manage-starter]")) {
        event.preventDefault();
        restoreStarter();
        return;
      }
      if (event.target.closest("[data-manage-empty]")) {
        event.preventDefault();
        hideAll();
      }
    });
    dialog.addEventListener("change", (event) => {
      const input = event.target.closest("[data-manage-visible]");
      if (!input) return;
      toggle(input.dataset.manageVisible, input.checked);
    });
    dialog.addEventListener("click", (event) => {
      const button = event.target.closest("[data-manage-remove]");
      if (!button) return;
      event.preventDefault();
      remove(button.dataset.manageRemove);
    });
  }

  window.LorekeeperManage = {
    open,
    restoreStarter,
    hideAll,
  };
  bind();
})();
