/* Local progress export, import and storage helpers. */
(function () {
  const FORMAT = "lorekeeper.progress";
  const VERSION = 1;
  const PREFIX = "lorekeeper:";
  const RESERVED = new Set(["lorekeeper:theme"]);
  const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
  const SLUG = /^[a-z0-9][a-z0-9-]*$/;
  const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,200}$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const MAX_DRAFT = 500 * 1024;
  const MAX_TOTAL_DRAFTS = 2 * 1024 * 1024;

  let bound = false;
  let pending = null;

  const $ = (id) => document.getElementById(id);

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function safeKey(key) {
    return KEY.test(key) && !DANGEROUS.has(key);
  }

  function courseEntry(courses, slug) {
    if (!courses[slug]) courses[slug] = {};
    return courses[slug];
  }

  function progressValue(value) {
    const data = safeParse(value);
    return data && typeof data === "object" ? data : null;
  }

  function collect() {
    const courses = {};
    const other = {};
    let theme = null;
    let keys = [];
    try {
      keys = Object.keys(localStorage);
    } catch {
      keys = [];
    }

    for (const key of keys) {
      if (!key.startsWith(PREFIX)) continue;
      if (key.startsWith("lorekeeper:pack:")) continue;
      let value = "";
      try {
        value = localStorage.getItem(key) || "";
      } catch {
        continue;
      }
      if (key === "lorekeeper:theme") {
        theme = value || null;
        continue;
      }
      const progress = key.match(/^lorekeeper:progress:([a-z0-9-]+)$/);
      if (progress) {
        const parsed = progressValue(value);
        if (parsed) courseEntry(courses, progress[1]).progress = parsed;
        continue;
      }
      const draft = key.match(/^lorekeeper:(sql|code):([a-z0-9-]+):(.+)$/);
      if (draft) {
        const slug = draft[2];
        const id = draft[3];
        if (!SLUG.test(slug) || !safeKey(id)) continue;
        const entry = courseEntry(courses, slug);
        const field = draft[1];
        entry[field] = entry[field] || {};
        entry[field][id] = value;
        continue;
      }
      if (safeKey(key) && !RESERVED.has(key)) other[key] = value;
    }

    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      theme,
      courses,
      other,
    };
  }

  function validateProgress(raw) {
    if (!raw || typeof raw !== "object") {
      throw new Error("The progress entry is not an object.");
    }
    const completed = {};
    const source = raw.completed && typeof raw.completed === "object" ? raw.completed : {};
    for (const [id, value] of Object.entries(source)) {
      if (value === true && safeKey(id)) completed[id] = true;
    }
    const activity = [
      ...new Set(
        (Array.isArray(raw.activity) ? raw.activity : []).filter(
          (item) => typeof item === "string" && DATE.test(item)
        )
      ),
    ].sort();
    const badges = [
      ...new Set(
        (Array.isArray(raw.badges) ? raw.badges : []).filter(
          (item) => typeof item === "string" && safeKey(item)
        )
      ),
    ].sort();
    return { completed, activity, badges };
  }

  function validateDrafts(raw) {
    if (raw === undefined) return undefined;
    if (!raw || typeof raw !== "object") throw new Error("Drafts must be an object.");
    const out = {};
    let total = 0;
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value !== "string") throw new Error(`Draft "${id}" is not text.`);
      if (!safeKey(id)) continue;
      if (value.length > MAX_DRAFT) throw new Error(`Draft "${id}" is too large.`);
      total += value.length;
      if (total > MAX_TOTAL_DRAFTS) throw new Error("The import contains too much draft text.");
      out[id] = value;
    }
    return out;
  }

  function validate(data) {
    if (!data || data.format !== FORMAT || Number(data.version) !== VERSION) {
      throw new Error("This is not a Lorekeeper progress file.");
    }
    if (!data.courses || typeof data.courses !== "object") {
      throw new Error("The file has no courses.");
    }
    const clean = {
      format: FORMAT,
      version: VERSION,
      exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
      theme: typeof data.theme === "string" && data.theme ? data.theme : null,
      courses: {},
      other: {},
    };
    for (const [slug, raw] of Object.entries(data.courses)) {
      if (!SLUG.test(slug)) throw new Error(`Invalid course key "${slug}".`);
      if (!raw || typeof raw !== "object") throw new Error(`Course "${slug}" is invalid.`);
      const entry = {};
      if (raw.progress !== undefined) entry.progress = validateProgress(raw.progress);
      const sql = validateDrafts(raw.sql);
      const code = validateDrafts(raw.code);
      if (sql) entry.sql = sql;
      if (code) entry.code = code;
      clean.courses[slug] = entry;
    }
    if (data.other && typeof data.other === "object") {
      for (const [key, value] of Object.entries(data.other)) {
        if (typeof value !== "string") continue;
        if (!key.startsWith(PREFIX) || RESERVED.has(key) || !safeKey(key.replace(PREFIX, ""))) continue;
        if (key.startsWith("lorekeeper:pack:")) continue;
        if (key.startsWith("lorekeeper:progress:") || /^lorekeeper:(sql|code):/.test(key)) continue;
        clean.other[key] = value;
      }
    }
    return clean;
  }

  function preview(data) {
    const clean = validate(data);
    let completed = 0;
    let badges = 0;
    let drafts = 0;
    for (const course of Object.values(clean.courses)) {
      if (course.progress) {
        completed += Object.keys(course.progress.completed).length;
        badges += course.progress.badges.length;
      }
      drafts += Object.keys(course.sql || {}).length + Object.keys(course.code || {}).length;
    }
    const courses = Object.keys(clean.courses).length;
    return {
      clean,
      text: `${courses} course${courses === 1 ? "" : "s"} · ${completed} completed lesson${completed === 1 ? "" : "s"} · ${badges} badge${badges === 1 ? "" : "s"} · ${drafts} draft${drafts === 1 ? "" : "s"}`,
    };
  }

  function mergeProgress(existing, incoming) {
    const a = existing || {};
    const b = incoming || {};
    return {
      completed: { ...(a.completed || {}), ...(b.completed || {}) },
      activity: [...new Set([...(a.activity || []), ...(b.activity || [])])].sort(),
      badges: [...new Set([...(a.badges || []), ...(b.badges || [])])].sort(),
    };
  }

  function apply(data, mode = "merge") {
    const clean = validate(data);
    const replace = mode === "replace";
    if (replace) {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) localStorage.removeItem(key);
      }
    }

    if (clean.theme && (replace || !localStorage.getItem("lorekeeper:theme"))) {
      localStorage.setItem("lorekeeper:theme", clean.theme);
    }

    for (const [slug, entry] of Object.entries(clean.courses)) {
      if (entry.progress) {
        const key = `lorekeeper:progress:${slug}`;
        const existing = replace ? null : progressValue(localStorage.getItem(key) || "");
        const value = replace ? entry.progress : mergeProgress(existing, entry.progress);
        localStorage.setItem(key, JSON.stringify(value));
      }
      for (const field of ["sql", "code"]) {
        for (const [id, value] of Object.entries(entry[field] || {})) {
          const key = `lorekeeper:${field}:${slug}:${id}`;
          if (replace || !localStorage.getItem(key)) localStorage.setItem(key, value);
        }
      }
    }

    for (const [key, value] of Object.entries(clean.other || {})) {
      if (replace || !localStorage.getItem(key)) localStorage.setItem(key, value);
    }
    return clean;
  }

  function download() {
    const data = collect();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `lorekeeper-progress-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return data;
  }

  function summary() {
    const data = collect();
    const courses = Object.keys(data.courses).length;
    let completed = 0;
    let badges = 0;
    let drafts = 0;
    for (const entry of Object.values(data.courses)) {
      if (entry.progress) {
        completed += Object.keys(entry.progress.completed || {}).length;
        badges += (entry.progress.badges || []).length;
      }
      drafts += Object.keys(entry.sql || {}).length + Object.keys(entry.code || {}).length;
    }
    return `${courses} course${courses === 1 ? "" : "s"} · ${completed} completed lesson${completed === 1 ? "" : "s"} · ${badges} badge${badges === 1 ? "" : "s"} · ${drafts} draft${drafts === 1 ? "" : "s"}`;
  }

  async function storageState() {
    if (!navigator.storage || !navigator.storage.persisted) {
      return "This browser does not report storage persistence.";
    }
    try {
      const persisted = await navigator.storage.persisted();
      if (persisted) {
        return "Browser storage is persistent. It can still be cleared manually.";
      }
      if (navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }
      return "Browser storage is best effort. The browser may clear it under pressure. Export a backup.";
    } catch {
      return "Browser storage status could not be checked.";
    }
  }

  async function updateStorageNote() {
    const el = $("progress-storage");
    if (!el) return;
    el.textContent = "Checking browser storage...";
    el.textContent = await storageState();
  }

  function updateSummary() {
    const el = $("progress-summary");
    if (el) el.textContent = summary();
  }

  function resetImport() {
    pending = null;
    const panel = $("progress-import-panel");
    if (panel) panel.hidden = true;
    const input = $("progress-import");
    if (input) input.value = "";
  }

  function bind() {
    if (bound) return;
    const button = $("progress-button");
    const dialog = $("progress-dialog");
    const close = $("progress-close");
    if (!button || !dialog || !close) return;
    bound = true;

    button.addEventListener("click", () => {
      updateSummary();
      updateStorageNote();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", resetImport);

    $("progress-export").addEventListener("click", () => {
      try {
        download();
        if (typeof toast === "function") toast("Progress exported.");
      } catch (error) {
        if (typeof toast === "function") toast(error.message || "Export failed.");
      }
    });

    $("progress-import-button").addEventListener("click", () => {
      $("progress-import").click();
    });

    $("progress-import").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = preview(data);
        pending = result.clean;
        $("progress-import-summary").textContent = `Ready to import: ${result.text}.`;
        $("progress-import-panel").hidden = false;
      } catch (error) {
        pending = null;
        $("progress-import-summary").textContent = error.message || "Import failed.";
        $("progress-import-panel").hidden = false;
      }
    });

    $("progress-apply").addEventListener("click", () => {
      if (!pending) {
        if (typeof toast === "function") toast("Choose a valid progress file first.");
        return;
      }
      try {
        apply(pending, $("progress-import-mode").value);
        if (typeof toast === "function") toast("Progress imported. Reloading...");
        setTimeout(() => location.reload(), 500);
      } catch (error) {
        if (typeof toast === "function") toast(error.message || "Import failed.");
      }
    });

    $("progress-cancel").addEventListener("click", resetImport);

    $("progress-clear").addEventListener("click", () => {
      if (!confirm("Clear all Lorekeeper progress, badges, drafts and theme on this device?")) {
        return;
      }
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) localStorage.removeItem(key);
      }
      location.reload();
    });
  }

  function init() {
    bind();
    updateStorageNote();
  }

  window.LorekeeperProgress = {
    init,
    collect,
    download,
    validate,
    preview,
    apply,
    summary,
    storageState,
  };
})();
