const state = {
  index: null,
  course: null,
  courseBaseUrl: null,
  coursePack: null,
  progress: { completed: {} },
  currentId: null,
};

const els = {
  outline: document.getElementById("outline"),
  courseMeta: document.getElementById("course-meta"),
  content: document.getElementById("content"),
  xp: document.getElementById("xp"),
  progressBar: document.getElementById("progress-bar"),
  toast: document.getElementById("toast"),
};

const THEME_KEY = "lorekeeper:theme";
const THEMES = ["ink", "pixel", "storybook"];

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "";
  } catch {
    return "";
  }
}

function applyTheme(name, persist = false) {
  const theme = THEMES.includes(name) ? name : "ink";
  document.documentElement.dataset.theme = theme;
  const select = document.getElementById("theme-select");
  if (select) select.value = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage disabled */
    }
  }
}

const KIND_LABEL = {
  reading: "read",
  checkpoint: "quiz",
  exercise: "code",
  order: "sort",
  fill: "fill",
  hotspot: "find",
  review: "diff",
  scenario: "choose",
  calibration: "judge",
  viva: "viva",
  api: "api",
  sql: "sql",
  terminal: "sh",
  story: "story",
};

init().catch((error) => fatal(error.message || String(error)));

async function init() {
  document.getElementById("reset-progress").addEventListener("click", resetProgress);
  applyTheme(savedTheme() || "pixel", false);
  document.getElementById("theme-select").addEventListener("change", (event) => {
    applyTheme(event.target.value, true);
  });
  window.LorekeeperProgress?.init();

  let index;
  try {
    index = await getJSON("../build/index.json");
  } catch {
    fatal(
      "No build found. Run lorekeeper build, or start with lorekeeper serve, then reload."
    );
    return;
  }
  const localCourses = window.LorekeeperLibrary?.courses() || [];
  const remoteSlugs = new Set(index.courses.map((course) => course.slug));
  index.courses = [
    ...index.courses,
    ...localCourses.filter((course) => !remoteSlugs.has(course.slug)),
  ];
  state.index = index;
  window.LorekeeperWayfinder?.init();
  warmOffline();

  const params = new URLSearchParams(location.search);
  const requested = params.get("course");
  if (requested) return loadCourse(requested);
  if (index.courses.length === 1) return loadCourse(index.courses[0].slug);
  renderPicker();
}

async function loadCourse(slug) {
  const local = window.LorekeeperLibrary?.course(slug);
  let course;
  if (local) {
    course = local.course;
    state.courseBaseUrl = null;
    state.coursePack = local.packId;
  } else {
    const meta = state.index.courses.find((item) => item.slug === slug);
    const courseUrl = new URL(meta ? `../build/${meta.slug}/course.json` : slug, location.href);
    try {
      course = await getJSON(courseUrl.href);
    } catch {
      fatal(`Could not load course "${slug}".`);
      return;
    }
    state.courseBaseUrl = new URL(".", courseUrl).href;
    state.coursePack = null;
  }

  state.course = course;
  applyTheme(savedTheme() || course.unit.theme || "pixel", false);
  loadProgress();
  window.LorekeeperBadges?.init();
  window.LorekeeperWayfinder?.renderSidebarTrail();
  document.title = `${course.unit.title} · Lorekeeper`;
  const emblem = window.LorekeeperArt
    ? window.LorekeeperArt.courseEmblem(course.unit.slug)
    : "";
  els.courseMeta.innerHTML = `
    <div class="course-emblem">${emblem}</div>
    <div class="course-meta-text">
      <div class="code">course</div>
      <div class="title">${escapeHtml(course.unit.title)}</div>
    </div>`;

  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  route();
}

function route() {
  const wanted = decodeURIComponent(location.hash.replace(/^#/, ""));
  const entries = allLessons();
  if (!entries.length) return;
  const match = entries.find((entry) => entry.lesson.id === wanted);
  const target = (match || entries[0]).lesson.id;
  if (!wanted) {
    history.replaceState({ id: target }, "", `#${encodeURIComponent(target)}`);
  }
  showLesson(target, false);
}

function showLesson(id, push = true) {
  const entry = allLessons().find((item) => item.lesson.id === id);
  if (!entry) return;
  state.currentId = id;
  if (push && location.hash !== `#${id}`) {
    history.pushState({ id }, "", `#${encodeURIComponent(id)}`);
  }
  renderSidebar();
  renderLesson(entry);
  updateStats();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function allLessons() {
  if (!state.course) return [];
  return state.course.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ module, lesson }))
  );
}

function currentEntry() {
  return allLessons().find((item) => item.lesson.id === state.currentId) || null;
}

function isDone(id) {
  return Boolean(state.progress.completed[id]);
}

/* Progress */

function progressKey() {
  return `lorekeeper:progress:${state.course.unit.slug}`;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(progressKey());
    const parsed = raw ? JSON.parse(raw) : null;
    state.progress = parsed && parsed.completed ? parsed : { completed: {} };
  } catch {
    state.progress = { completed: {} };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(progressKey(), JSON.stringify(state.progress));
  } catch {
    /* storage disabled: progress is session-only */
  }
}

function stats() {
  const lessons = allLessons().map((entry) => entry.lesson);
  const done = lessons.filter((lesson) => isDone(lesson.id));
  return {
    total: lessons.length,
    done: done.length,
    xp: done.reduce((sum, lesson) => sum + lesson.xp, 0),
  };
}

function updateStats() {
  const summary = stats();
  els.xp.textContent = String(summary.xp);
  const percent = summary.total ? (summary.done / summary.total) * 100 : 0;
  els.progressBar.style.width = `${percent}%`;
}

function completeLesson(lesson, { quiet = false } = {}) {
  if (isDone(lesson.id)) return;
  state.progress.completed[lesson.id] = true;
  window.LorekeeperBadges?.record();
  saveProgress();
  renderSidebar();
  updateStats();
  syncCompleteControls(lesson);
  if (!quiet) toast(`Lesson complete +${lesson.xp} XP`);
  else toast(`Passed. +${lesson.xp} XP`);
  window.LorekeeperBadges?.sync(true);
  window.LorekeeperWayfinder?.renderSidebarTrail();
}

function resetProgress() {
  if (!state.course) return;
  if (!confirm("Reset all progress and achievements for this course?")) return;
  state.progress = { completed: {} };
  saveProgress();
  renderSidebar();
  updateStats();
  const entry = currentEntry();
  if (entry) renderLesson(entry);
  window.LorekeeperBadges?.reset();
  window.LorekeeperWayfinder?.renderSidebarTrail();
  toast("Progress and achievements reset");
}

/* Sidebar */

function renderSidebar() {
  const openSlugs = new Set();
  for (const module of state.course.modules) {
    if (module.number === 1) openSlugs.add(module.slug);
    if (module.lessons.some((lesson) => lesson.id === state.currentId)) {
      openSlugs.add(module.slug);
    }
  }

  els.outline.innerHTML = state.course.modules
    .map((module) => {
      const open = openSlugs.has(module.slug) ? " open" : "";
      const lessons = module.lessons
        .map((lesson) => {
          const classes = ["lesson-link"];
          if (lesson.id === state.currentId) classes.push("current");
          if (isDone(lesson.id)) classes.push("done");
          return `
            <a class="${classes.join(" ")}" href="#${encodeURIComponent(lesson.id)}" data-lesson="${escapeHtml(lesson.id)}">
              <span class="dot"></span>
              <span class="label">${escapeHtml(lesson.title)}</span>
              <span class="kind">${KIND_LABEL[lesson.kind] || lesson.kind}</span>
            </a>`;
        })
        .join("");
      return `
        <details class="outline-module"${open}>
          <summary>
            <span class="num">${String(module.number).padStart(2, "0")}</span>
            <span>${escapeHtml(module.title)}</span>
          </summary>
          ${lessons}
        </details>`;
    })
    .join("");

  els.outline.querySelectorAll("[data-lesson]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showLesson(link.dataset.lesson);
    });
  });
}

/* Lesson rendering */

function renderLesson(entry) {
  const { module, lesson } = entry;
  const entries = allLessons();
  const index = entries.findIndex((item) => item.lesson.id === lesson.id);
  const previous = index > 0 ? entries[index - 1] : null;
  const next = index < entries.length - 1 ? entries[index + 1] : null;

  const wide = lesson.blocks.some((block) =>
    ["exercise", "sql", "terminal", "api", "calibration"].includes(block.type)
  );
  els.content.className = wide ? "content wide" : "content";
  els.content.innerHTML = `
    <div class="crumbs">
      <span>Module ${String(module.number).padStart(2, "0")}</span>
      <span class="sep">/</span>
      <span>${escapeHtml(module.title)}</span>
      <span class="pill ${lesson.kind}">${lesson.kind}</span>
      <span class="xp-pill">${lesson.xp} XP</span>
    </div>
    <h1 class="lesson-title">${escapeHtml(lesson.title)}</h1>
    <div data-blocks></div>
    <div class="lesson-footer" data-footer>
      <button class="btn" type="button" data-prev ${previous ? "" : "disabled"}>Previous</button>
      <span data-footer-status></span>
      <span class="spacer"></span>
      ${
        lesson.kind === "reading"
          ? `<button class="btn primary" type="button" data-complete>${isDone(lesson.id) ? "Completed" : "Mark as read"}</button>`
          : ""
      }
      <button class="btn primary" type="button" data-next ${next ? "" : "disabled"}>Next</button>
    </div>`;

  if (previous) {
    els.content.querySelector("[data-prev]").addEventListener("click", () => showLesson(previous.lesson.id));
  }
  if (next) {
    els.content.querySelector("[data-next]").addEventListener("click", () => showLesson(next.lesson.id));
  }

  const completeButton = els.content.querySelector("[data-complete]");
  if (completeButton) {
    completeButton.addEventListener("click", () => completeLesson(lesson));
  }
  syncCompleteControls(lesson);

  const blocksHost = els.content.querySelector("[data-blocks]");
  for (const block of lesson.blocks) {
    if (block.type === "html") {
      const prose = document.createElement("div");
      prose.className = "lesson-prose";
      prose.innerHTML = block.html;
      blocksHost.appendChild(prose);
    } else if (block.type === "checkpoint") {
      renderCheckpoint(blocksHost, block, lesson);
    } else if (block.type === "exercise") {
      renderExercise(blocksHost, block, lesson);
    } else if (window.WIDGET_RENDERERS && window.WIDGET_RENDERERS[block.type]) {
      window.WIDGET_RENDERERS[block.type](blocksHost, block, lesson);
    }
  }
}

function syncCompleteControls(lesson) {
  const status = els.content.querySelector("[data-footer-status]");
  const button = els.content.querySelector("[data-complete]");
  if (button) {
    const done = isDone(lesson.id);
    button.textContent = done ? "Completed" : "Mark as read";
    button.disabled = done;
  }
  if (status && lesson.kind !== "reading") {
    status.textContent = isDone(lesson.id) ? "Completed" : "";
    status.style.color = isDone(lesson.id) ? "var(--accent)" : "";
  }
}

/* Checkpoint */

function renderCheckpoint(host, block, lesson) {
  const wrap = document.createElement("div");
  wrap.className = "checkpoint";
  wrap.innerHTML =
    block.questions
      .map(
        (question, qIndex) => `
        <div class="question" data-question="${qIndex}">
          <h3>${qIndex + 1}. ${escapeHtml(question.prompt)}</h3>
          <div class="options">
            ${question.options
              .map(
                (option, oIndex) => `
              <label class="option">
                <input type="radio" name="q${qIndex}" value="${oIndex}">
                <span>${escapeHtml(option)}</span>
              </label>`
              )
              .join("")}
          </div>
          <div class="feedback" data-feedback></div>
        </div>`
      )
      .join("") +
    `<div class="toolbar"><button type="button" class="btn primary" data-check disabled>Check answers</button></div>`;

  host.appendChild(wrap);

  const answers = block.questions.map(() => -1);
  const checkButton = wrap.querySelector("[data-check]");
  let checked = false;

  wrap.addEventListener("change", (event) => {
    if (checked) return;
    const input = event.target;
    if (input.type !== "radio") return;
    const qIndex = Number(input.name.slice(1));
    answers[qIndex] = Number(input.value);
    checkButton.disabled = answers.some((answer) => answer < 0);
  });

  checkButton.addEventListener("click", () => {
    if (checked) {
      checked = false;
      answers.fill(-1);
      wrap.querySelectorAll(".option").forEach((option) => {
        option.classList.remove("correct", "wrong");
        const input = option.querySelector("input");
        input.disabled = false;
        input.checked = false;
      });
      wrap.querySelectorAll("[data-feedback]").forEach((feedback) => {
        feedback.textContent = "";
        feedback.className = "feedback";
      });
      checkButton.textContent = "Check answers";
      checkButton.disabled = true;
      return;
    }

    let allCorrect = true;
    block.questions.forEach((question, qIndex) => {
      const questionEl = wrap.querySelector(`[data-question="${qIndex}"]`);
      const options = [...questionEl.querySelectorAll(".option")];
      const correct = answers[qIndex] === question.answer;
      allCorrect = allCorrect && correct;

      options.forEach((option, oIndex) => {
        option.classList.toggle("correct", oIndex === question.answer);
        option.classList.toggle("wrong", oIndex === answers[qIndex] && !correct);
        option.querySelector("input").disabled = true;
      });

      const feedback = questionEl.querySelector("[data-feedback]");
      feedback.className = `feedback ${correct ? "ok" : "bad"}`;
      feedback.textContent = correct
        ? `Correct.${question.explanation ? ` ${question.explanation}` : ""}`
        : `Answer: ${question.options[question.answer]}.${question.explanation ? ` ${question.explanation}` : ""}`;
    });

    checked = true;
    checkButton.textContent = "Try again";
    checkButton.disabled = false;
    if (allCorrect) completeLesson(lesson, { quiet: true });
    else toast("Some answers are wrong. Read the feedback and try again.");
  });
}

/* Exercise */

function renderExercise(host, block, lesson) {
  const codeKey = `lorekeeper:code:${state.course.unit.slug}:${block.id}`;
  const isText = block.language === "text" || block.language === "markdown";
  const isScripted = block.language === "js";
  const wrap = document.createElement("div");
  wrap.className = "exercise";
  wrap.innerHTML = `
    <div class="lesson-prose">${block.prompt}</div>
    <div class="exercise-grid${isText ? " text-only" : ""}">
      <div class="editor-pane">
        <div class="pane-label">${isText ? "Your answer" : `Editor · ${escapeHtml(block.language)}`}</div>
        <textarea class="code" spellcheck="${isText ? "true" : "false"}" aria-label="${isText ? "Your answer" : "Code editor"}"></textarea>
      </div>
      ${
        isText
          ? ""
          : `<div class="preview-pane">
              <div class="pane-label">Preview${
                block.viewport ? ` · ${block.viewport.width} × ${block.viewport.height}` : ""
              }</div>
              <div class="preview-empty" data-preview-empty>Run tests to render your page</div>
            </div>`
      }
    </div>
    <div class="toolbar">
      <button type="button" class="btn primary" data-run>Run tests</button>
      <button type="button" class="btn" data-reset>Reset code</button>
    </div>
    <ul class="test-list" data-tests></ul>
    <div class="test-summary" data-summary></div>
    ${
      block.hints && block.hints.length
        ? `<details class="hints"><summary>Hints</summary><ul>${block.hints
            .map((hint) => `<li>${escapeHtml(hint)}</li>`)
            .join("")}</ul></details>`
        : ""
    }`;

  host.appendChild(wrap);

  const editor = wrap.querySelector("textarea");
  let saved = null;
  try {
    saved = localStorage.getItem(codeKey);
  } catch {
    saved = null;
  }
  editor.value = saved || block.starter;
  editor.addEventListener("input", () => {
    try {
      localStorage.setItem(codeKey, editor.value);
    } catch {
      /* ignore */
    }
  });

  const runButton = wrap.querySelector("[data-run]");
  const resetButton = wrap.querySelector("[data-reset]");
  const previewPane = wrap.querySelector(".preview-pane");
  const testList = wrap.querySelector("[data-tests]");
  const summary = wrap.querySelector("[data-summary]");

  const frameFor = () => {
    let frame = previewPane.querySelector("iframe");
    if (frame) return frame;
    const empty = previewPane.querySelector("[data-preview-empty]");
    if (empty) empty.remove();
    frame = document.createElement("iframe");
    frame.className = "preview";
    frame.setAttribute("title", "Rendered output");
    frame.setAttribute(
      "sandbox",
      isScripted ? "allow-scripts allow-same-origin" : "allow-same-origin"
    );
    if (block.viewport) {
      frame.style.width = `${block.viewport.width}px`;
      frame.style.height = `${block.viewport.height}px`;
      frame.style.maxWidth = "100%";
    }
    previewPane.appendChild(frame);
    return frame;
  };

  const run = async () => {
    runButton.disabled = true;
    summary.className = "test-summary";
    summary.textContent = "Running...";

    let doc = null;
    if (!isText) {
      const frame = frameFor();
      const source = isScripted
        ? scriptedDocument(block, editor.value)
        : editor.value;
      await loadFrame(frame, source);
      if (isScripted) await new Promise((resolve) => setTimeout(resolve, 80));
      doc = frame.contentDocument;
    }

    const results = block.tests.map((test) => {
      try {
        const fn = new Function("doc", "text", "assert", "assertEqual", test.script);
        fn(doc, editor.value, assert, assertEqual);
        return { name: test.name, ok: true };
      } catch (error) {
        return {
          name: test.name,
          ok: false,
          message: error && error.message ? error.message : String(error),
        };
      }
    });

    testList.innerHTML = results
      .map(
        (result) => `
        <li class="test-item ${result.ok ? "pass" : "fail"}">
          <span class="icon">${result.ok ? "✓" : "✗"}</span>
          <span>${escapeHtml(result.name)}${result.ok ? "" : `<div class="msg">${escapeHtml(result.message)}</div>`}</span>
        </li>`
      )
      .join("");

    const passed = results.filter((result) => result.ok).length;
    const allPassed = passed === results.length;
    summary.className = `test-summary ${allPassed ? "pass" : "fail"}`;
    summary.textContent = allPassed
      ? `All ${results.length} tests passed.`
      : `${passed} of ${results.length} tests passed. Keep going.`;

    if (allPassed) completeLesson(lesson, { quiet: true });
    runButton.disabled = false;
  };

  runButton.addEventListener("click", run);
  resetButton.addEventListener("click", () => {
    if (!confirm("Reset the editor to the starter code?")) return;
    editor.value = block.starter;
    try {
      localStorage.setItem(codeKey, editor.value);
    } catch {
      /* ignore */
    }
    testList.innerHTML = "";
    summary.textContent = "";
    run();
  });

  wrap.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });
}

function scriptedDocument(block, code) {
  const mock = block.mock || { status: 200, body: {} };
  const status = Number(mock.status ?? 200);
  const ok = status >= 200 && status < 300;
  const json = JSON.stringify(mock.body ?? {});
  const textBody = JSON.stringify(json);
  const mockCode = mock.error
    ? "window.fetch = () => Promise.reject(new Error('network'));"
    : `window.fetch = () => Promise.resolve({ ok: ${ok}, status: ${status}, json: () => Promise.resolve((${json})), text: () => Promise.resolve(${textBody}) });`;
  const injected = `<script>${mockCode}</script><script>${code}</script>`;
  const html = block.html || "<!doctype html><html><body></body></html>";
  return html.replace(/<\/body>/i, `${injected}</body>`);
}
function loadFrame(frame, html) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      frame.removeEventListener("load", finish);
      resolve();
    };
    frame.addEventListener("load", finish);
    frame.srcdoc = html || "<!doctype html><html><body></body></html>";
    setTimeout(finish, 2000);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/* Course picker and errors */

function renderPicker() {
  els.content.innerHTML = `
    <div class="placeholder">
      <div class="picker-hero">
        ${window.LorekeeperArt ? window.LorekeeperArt.picker() : ""}
        <div class="picker-intro">
          <p class="eyebrow">Lorekeeper · field notes</p>
          <h1>Choose your path</h1>
          <p>Story-driven courses for information systems. The source repos stay read-only.</p>
        </div>
      </div>
      <div id="wayfinder-host"></div>
      <div class="course-list">
        ${state.index.courses
          .map(
            (course) => `
          <div class="course-row">
            <a class="course-card" href="?course=${encodeURIComponent(course.slug)}">
              <span class="course-card-emblem">${
                window.LorekeeperArt ? window.LorekeeperArt.courseEmblem(course.slug) : ""
              }</span>
              <span class="course-card-body">
                <span class="title">${escapeHtml(course.title)}</span>
                <span class="meta">${course.modules} modules · ${course.lessons} lessons
                  <span class="skin-tag">${escapeHtml(window.LorekeeperArt ? window.LorekeeperArt.skinName(course.theme) : (course.theme || "ink"))}</span>
                  ${course.source === "local" ? '<span class="skin-tag local-tag">Local pack</span>' : ""}
                </span>
              </span>
            </a>
            ${
              course.source === "local"
                ? `<button class="ghost small pack-remove" type="button" data-pack-remove="${escapeHtml(course.packId || "")}">Remove</button>`
                : ""
            }
          </div>`
          )
          .join("")}
      </div>
      <div class="picker-tools">
        <button id="pack-import" class="btn" type="button">Import a pack</button>
        <input id="pack-file" type="file" accept=".json,application/json" hidden>
      </div>
    </div>`;
  bindPickerTools();
  window.LorekeeperWayfinder?.renderPicker();
}

function bindPickerTools() {
  const importButton = document.getElementById("pack-import");
  const fileInput = document.getElementById("pack-file");
  if (importButton && fileInput) {
    importButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!confirm("Packs can contain exercise test code. Only import packs you trust. Continue?")) {
        event.target.value = "";
        return;
      }
      try {
        const pack = await window.LorekeeperLibrary.parseFile(file);
        const existing = window.LorekeeperLibrary.getPack(pack.id);
        if (existing && !confirm(`Replace local pack "${existing.title}"?`)) {
          event.target.value = "";
          return;
        }
        const reserved = state.index.courses
          .filter((course) => course.source !== "local")
          .map((course) => course.slug);
        window.LorekeeperLibrary.store(pack, reserved);
        toast(`Imported ${pack.title}.`);
        setTimeout(() => location.reload(), 500);
      } catch (error) {
        toast(error.message || "Import failed.");
        event.target.value = "";
      }
    });
  }
  document.querySelectorAll("[data-pack-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.packRemove;
      const pack = window.LorekeeperLibrary.getPack(id);
      if (!pack) return;
      if (!confirm(`Remove "${pack.title}" and its local progress from this device?`)) return;
      window.LorekeeperLibrary.removePack(id);
      location.reload();
    });
  });
}

function fatal(message) {
  els.content.innerHTML = `
    <div class="placeholder">
      <h1>Not quite yet</h1>
      <p>${escapeHtml(message)}</p>
      <p>From the engine root run <code class="cmd">lorekeeper serve</code>.</p>
    </div>`;
}

/* Helpers */

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function getJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function serviceWorkerReady() {
  if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return null;
  try {
    await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2500);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timer);
        resolve(navigator.serviceWorker.controller);
      },
      { once: true }
    );
  });
}

async function warmOffline() {
  if (!state.index || !navigator.onLine) return;
  const controller = await serviceWorkerReady();
  if (!controller) return;
  fetch(new URL("../build/index.json", location.href)).catch(() => {});
  for (const course of state.index.courses) {
    if (course.source === "local") continue;
    const courseUrl = new URL(`../build/${course.slug}/course.json`, location.href);
    fetch(courseUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        const base = new URL(".", courseUrl);
        for (const module of data.modules || []) {
          for (const lesson of module.lessons || []) {
            for (const block of lesson.blocks || []) {
              if (block.type === "story" && block.src) {
                fetch(new URL(block.src, base)).catch(() => {});
              }
            }
          }
        }
      })
      .catch(() => {});
  }
}
