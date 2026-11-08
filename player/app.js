const state = {
  index: null,
  course: null,
  courseMeta: null,
  courseBaseUrl: null,
  coursePack: null,
  progress: { completed: {} },
  currentId: null,
};

const els = {
  outline: document.getElementById("outline"),
  courseMeta: document.getElementById("course-meta"),
  courseProgress: document.getElementById("course-progress"),
  content: document.getElementById("content"),
  xp: document.getElementById("xp"),
  progressBar: document.getElementById("progress-bar"),
  toast: document.getElementById("toast"),
};

const THEME_KEY = "lorekeeper:theme";
const MODES = ["quest", "study"];
const LEGACY_MODES = { ink: "study", pixel: "quest", storybook: "quest" };

function normaliseMode(name) {
  const value = LEGACY_MODES[name] || name;
  return MODES.includes(value) ? value : "quest";
}

function savedTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw ? normaliseMode(raw) : "";
  } catch {
    return "";
  }
}

function isQuest() {
  return document.documentElement.dataset.theme !== "study";
}

function applyTheme(name, persist = false) {
  const theme = normaliseMode(name);
  document.documentElement.dataset.theme = theme;
  const select = document.getElementById("theme-select");
  if (select) select.value = theme;
  window.LorekeeperSound?.refresh();
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage disabled */
    }
    rerenderView();
  }
}

function rerenderView() {
  if (!state.index) return;
  if (!state.course) {
    renderPicker();
    return;
  }
  renderCourseMeta();
  route();
}

function kindBadge(kind) {
  return window.LorekeeperQuest ? window.LorekeeperQuest.kindBadge(kind) : escapeHtml(kind);
}

init().catch((error) => fatal(error.message || String(error)));

async function init() {
  document.getElementById("reset-progress").addEventListener("click", resetProgress);
  applyTheme(savedTheme() || "quest", false);
  document.getElementById("theme-select").addEventListener("change", (event) => {
    applyTheme(event.target.value, true);
  });
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = window.LorekeeperQuest ? window.LorekeeperQuest.icon(el.dataset.icon) : "";
  });
  const menu = document.getElementById("sidebar-menu");
  menu?.addEventListener("click", (event) => {
    if (event.target.closest(".menu-item")) menu.open = false;
  });
  window.LorekeeperProgress?.init();
  await window.LorekeeperLibrary?.ready();
  window.LorekeeperQuest?.renderPlayerCard();

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
  const allCourses = [
    ...index.courses,
    ...localCourses.filter((course) => !remoteSlugs.has(course.slug)),
  ];
  const storedHidden = window.LorekeeperPackStorage?.getSetting("hidden-courses", null);
  let hidden;
  if (Array.isArray(storedHidden)) {
    hidden = new Set(storedHidden);
  } else {
    hidden = new Set(allCourses.filter((course) => course.source !== "local").map((course) => course.slug));
    await window.LorekeeperPackStorage?.setSetting("hidden-courses", [...hidden]);
  }
  index.allCourses = allCourses;
  index.courses = allCourses.filter((course) => !hidden.has(course.slug));
  state.index = index;
  window.LorekeeperWayfinder?.init();
  warmOffline();

  const params = new URLSearchParams(location.search);
  const requested = params.get("course");
  if (requested) return loadCourse(requested);
  renderPicker();
}

async function loadCourse(slug) {
  const local = window.LorekeeperLibrary?.course(slug);
  let course;
  if (local) {
    course = local.course;
    state.courseBaseUrl = null;
    state.coursePack = local.packId;
    window.LorekeeperPackAssets = local.assets || {};
    window.LorekeeperAssetBase = null;
  } else {
    const meta = (state.index.allCourses || state.index.courses).find((item) => item.slug === slug);
    if (!meta) {
      fatal(
        `Course "${slug}" is not in this library. Open Manage library to add it, or browse the pack store.`
      );
      return;
    }
    const courseUrl = new URL(`../build/${meta.slug}/course.json`, location.href);
    try {
      course = await getJSON(courseUrl.href);
    } catch {
      fatal(`Could not load course "${slug}". Run lorekeeper build, then reload.`);
      return;
    }
    state.courseBaseUrl = new URL(".", courseUrl).href;
    state.coursePack = null;
    window.LorekeeperPackAssets = {};
    window.LorekeeperAssetBase = state.courseBaseUrl;
  }

  state.course = course;
  state.courseMeta =
    (state.index.allCourses || state.index.courses).find((item) => item.slug === course.unit.slug) ||
    course.unit;
  loadProgress();
  window.LorekeeperBadges?.init();
  window.LorekeeperWayfinder?.renderSidebarTrail();
  document.title = `${course.unit.title} · Lorekeeper`;
  renderCourseMeta();
  if (els.courseProgress) els.courseProgress.hidden = false;

  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  route();
}

function renderCourseMeta() {
  const emblem = window.LorekeeperArt
    ? window.LorekeeperArt.courseEmblem(state.course.unit.slug, state.courseMeta || state.course.unit)
    : "";
  els.courseMeta.innerHTML = `
    <div class="course-emblem">${emblem}</div>
    <div class="course-meta-text">
      <div class="code">${isQuest() ? "Current quest" : "Course"}</div>
      <div class="title">${escapeHtml(state.course.unit.title)}</div>
    </div>`;
}

function nextEntry() {
  const entries = allLessons();
  return entries.find((entry) => !isDone(entry.lesson.id)) || entries[0] || null;
}

function route() {
  if (!state.course) return;
  const wanted = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (wanted === "map") {
    renderMap();
    return;
  }
  const entries = allLessons();
  if (!entries.length) return;
  const match = entries.find((entry) => entry.lesson.id === wanted);
  const target = (match || nextEntry()).lesson.id;
  if (!wanted) {
    history.replaceState({ id: target }, "", `#${encodeURIComponent(target)}`);
  }
  showLesson(target, false);
}

function showLesson(id, push = true) {
  const entry = allLessons().find((item) => item.lesson.id === id);
  if (!entry) return;
  if (state.currentId && state.currentId !== id) {
    window.LorekeeperSound?.play(push ? "step" : "back");
  }
  state.currentId = id;
  if (push && location.hash !== `#${id}`) {
    history.pushState({ id }, "", `#${encodeURIComponent(id)}`);
  }
  document.getElementById("map-link")?.classList.remove("active");
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

function moduleDone(module) {
  return module.lessons.length > 0 && module.lessons.every((lesson) => isDone(lesson.id));
}

/* Progress */

function loadProgress() {
  const parsed = window.LorekeeperPackStorage?.getProgress(state.course.unit.slug);
  state.progress = parsed && parsed.completed ? parsed : { completed: {} };
  if (!Array.isArray(state.progress.history)) state.progress.history = [];
}

function saveProgress() {
  if (state.course) state.progress.xp = stats().xp;
  window.LorekeeperPackStorage?.putProgress(state.course.unit.slug, state.progress).catch(() => {
    /* progress remains in memory if IndexedDB is unavailable */
  });
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
  window.LorekeeperQuest?.renderPlayerCard();
}

function completeLesson(lesson, { quiet = false } = {}) {
  if (isDone(lesson.id)) return;
  const quest = window.LorekeeperQuest;
  const before = quest ? quest.player().level : 1;
  const module = state.course.modules.find((item) => item.lessons.some((entry) => entry.id === lesson.id));

  state.progress.completed[lesson.id] = true;
  if (!Array.isArray(state.progress.history)) state.progress.history = [];
  state.progress.history.push({
    id: lesson.id,
    title: lesson.title,
    kind: lesson.kind,
    course: state.course.unit.slug,
    courseTitle: state.course.unit.title,
    at: new Date().toISOString(),
  });
  state.progress.history = state.progress.history.slice(-120);
  window.LorekeeperBadges?.record();
  saveProgress();
  renderSidebar();
  updateStats();
  syncCompleteControls(lesson);

  const after = quest ? quest.player() : null;
  const chapterDone = module && moduleDone(module);
  const nextModule = module
    ? state.course.modules[state.course.modules.indexOf(module) + 1] || null
    : null;
  window.LorekeeperSound?.play("complete");

  if (quest && isQuest()) {
    quest.moment({
      type: "complete",
      kicker: quiet ? "Challenge passed" : "Scene complete",
      title: lesson.title,
      detail: `+${lesson.xp} XP`,
      icon: quest.kind(lesson.kind).icon,
    });
    if (chapterDone) {
      window.LorekeeperSound?.play("chapter");
      quest.moment({
        type: "chapter",
        kicker: "Chapter complete",
        title: `Chapter ${module.number}: ${module.title}`,
        detail: nextModule ? `Next: Chapter ${nextModule.number}, ${nextModule.title}` : "Every chapter of this quest is done.",
        icon: "map",
      });
    }
    if (after && after.level > before) {
      window.LorekeeperSound?.play("level");
      const narrator = quest.narratorFor(state.courseMeta || state.course.unit);
      quest.moment({
        type: "level",
        kicker: "Level up",
        title: `Level ${after.level}: ${after.title}`,
        detail: `${after.remaining} XP to level ${after.level + 1}.`,
        portrait: narrator.src,
      });
    }
  } else {
    toast(quiet ? `Passed. +${lesson.xp} XP` : `Lesson complete +${lesson.xp} XP`);
    if (chapterDone) setTimeout(() => toast(`Chapter ${module.number} complete`), 2300);
    if (after && after.level > before) setTimeout(() => toast(`Level ${after.level} reached`), 4600);
  }
  window.LorekeeperBadges?.sync(true);
  window.LorekeeperWayfinder?.renderSidebarTrail();
}

function resetProgress() {
  if (!state.course) return;
  if (!confirm("Reset all progress and achievements for this course?")) return;
  state.progress = { completed: {}, history: [] };
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
    if (module.lessons.some((lesson) => lesson.id === state.currentId)) openSlugs.add(module.slug);
  }
  if (!openSlugs.size && state.course.modules[0]) openSlugs.add(state.course.modules[0].slug);

  els.outline.innerHTML = state.course.modules
    .map((module) => {
      const open = openSlugs.has(module.slug) ? " open" : "";
      const done = module.lessons.filter((lesson) => isDone(lesson.id)).length;
      const status = moduleDone(module) ? " complete" : openSlugs.has(module.slug) ? " current" : "";
      const lessons = module.lessons
        .map((lesson) => {
          const classes = ["lesson-link"];
          if (lesson.id === state.currentId) classes.push("current");
          if (isDone(lesson.id)) classes.push("done");
          const info = window.LorekeeperQuest ? window.LorekeeperQuest.kind(lesson.kind) : { verb: lesson.kind, icon: "book" };
          return `
            <a class="${classes.join(" ")}" href="#${encodeURIComponent(lesson.id)}" data-lesson="${escapeHtml(lesson.id)}" title="${escapeHtml(info.verb)}">
              <span class="dot">${window.LorekeeperQuest ? window.LorekeeperQuest.icon(info.icon) : ""}</span>
              <span class="label">${escapeHtml(lesson.title)}</span>
              <span class="sr-only">${escapeHtml(info.verb)}${isDone(lesson.id) ? ", done" : ""}</span>
            </a>`;
        })
        .join("");
      return `
        <details class="outline-module${status}"${open}>
          <summary>
            <span class="num">${module.number}</span>
            <span class="chapter-text">
              <span class="chapter-label">Chapter ${module.number}</span>
              <span class="chapter-title">${escapeHtml(module.title)}</span>
            </span>
            <span class="chapter-count">${done}/${module.lessons.length}</span>
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

/* Course map */

function renderMap() {
  const quest = isQuest();
  const unit = quest ? "scenes" : "lessons";
  const summary = stats();
  const modules = state.course.modules;
  const currentIndex = modules.findIndex((module) => !moduleDone(module));
  document.getElementById("map-link")?.classList.add("active");
  renderSidebar();
  updateStats();
  els.content.className = "content map-content";
  els.content.innerHTML = `
    <div class="map-head">
      <p class="eyebrow">Course map</p>
      <h1>${escapeHtml(state.course.unit.title)}</h1>
      <p>${summary.done} of ${summary.total} ${unit} complete</p>
    </div>
    <ol class="map-path">
      ${modules
        .map((module, index) => {
          const done = module.lessons.filter((lesson) => isDone(lesson.id)).length;
          const total = module.lessons.length;
          const percent = total ? Math.round((done / total) * 100) : 0;
          const status = moduleDone(module) ? "complete" : index === currentIndex ? "current" : "upcoming";
          const label = status === "complete" ? "Complete" : status === "current" ? "You are here" : "Ahead";
          return `
            <li class="map-stop ${status}">
              <button class="map-stop-button" type="button" data-map-module="${index}">
                <span class="map-node" aria-hidden="true">${module.number}</span>
                <span class="map-body">
                  <span class="map-label">Chapter ${module.number} · ${label}</span>
                  <strong>${escapeHtml(module.title)}</strong>
                  <span class="map-count">${done} of ${total} ${unit}</span>
                  <span class="map-bar" aria-hidden="true"><span style="width:${percent}%"></span></span>
                </span>
              </button>
            </li>`;
        })
        .join("")}
    </ol>`;
  els.content.querySelectorAll("[data-map-module]").forEach((button) => {
    button.addEventListener("click", () => {
      const module = modules[Number(button.dataset.mapModule)];
      const target = module.lessons.find((lesson) => !isDone(lesson.id)) || module.lessons[0];
      if (target) showLesson(target.id);
    });
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* Lesson rendering */

function renderLesson(entry) {
  const { module, lesson } = entry;
  const entries = allLessons();
  const index = entries.findIndex((item) => item.lesson.id === lesson.id);
  const previous = index > 0 ? entries[index - 1] : null;
  const next = index < entries.length - 1 ? entries[index + 1] : null;
  const quest = isQuest();
  const sceneWord = quest ? "Scene" : "Lesson";
  const position = module.lessons.findIndex((item) => item.id === lesson.id) + 1;
  const meta = state.courseMeta || state.course.unit;
  const cover = window.LorekeeperArt ? window.LorekeeperArt.courseCoverUrl(meta) : "";
  const narrator = window.LorekeeperQuest ? window.LorekeeperQuest.narratorFor(meta) : null;
  const line = window.LorekeeperQuest ? window.LorekeeperQuest.narratorLine(lesson) : "";

  const wide = lesson.blocks.some((block) =>
    ["exercise", "sql", "terminal", "api", "calibration"].includes(block.type)
  );
  els.content.className = `content lesson-content${wide ? " wide" : ""}`;
  els.content.innerHTML = `
    <header class="scene-head">
      ${
        quest && cover
          ? `<div class="scene-banner">
              <img class="scene-art" src="${cover}" alt="" width="1216" height="832">
              <div class="scene-banner-text">
                <span>Chapter ${module.number}: ${escapeHtml(module.title)}</span>
                <span>${sceneWord} ${position} of ${module.lessons.length}</span>
              </div>
            </div>`
          : ""
      }
      <div class="lesson-heading">
        <div class="crumbs">
          <span>Chapter ${module.number}</span>
          <span class="sep">/</span>
          <span>${escapeHtml(module.title)}</span>
          <span class="pill kind-pill ${lesson.kind}">${kindBadge(lesson.kind)}</span>
          <span class="xp-pill">${lesson.xp} XP</span>
        </div>
        <p class="scene-count">${sceneWord} ${position} of ${module.lessons.length}</p>
        <h1 class="lesson-title">${escapeHtml(lesson.title)}</h1>
      </div>
      ${
        quest && narrator
          ? `<div class="narrator">
              <img class="narrator-portrait" src="${narrator.src}" alt="" width="96" height="96">
              <div class="narrator-box">
                <strong>${escapeHtml(narrator.name)}</strong>
                <p>${escapeHtml(line)}</p>
              </div>
            </div>`
          : ""
      }
    </header>
    <div data-blocks></div>
    <div class="lesson-footer" data-footer>
      <button class="btn" type="button" data-prev ${previous ? "" : "disabled"}>Previous</button>
      <span data-footer-status></span>
      <span class="spacer"></span>
      ${
        lesson.kind === "reading"
          ? `<button class="btn primary" type="button" data-complete>${isDone(lesson.id) ? "Completed" : "Done reading"}</button>`
          : ""
      }
      <button class="btn primary" type="button" data-next ${next ? "" : "disabled"}>Next</button>
    </div>`;

  els.content.classList.remove("motion-quest");
  if (quest) {
    void els.content.offsetWidth;
    els.content.classList.add("motion-quest");
  }

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
  const sanitizeProse = (html) => window.LorekeeperSanitize?.html(html) || "";
  for (const block of lesson.blocks) {
    if (block.type === "html") {
      const prose = document.createElement("div");
      prose.className = "lesson-prose";
      prose.innerHTML = sanitizeProse(block.html);
      blocksHost.appendChild(prose);
    } else if (block.type === "checkpoint") {
      renderCheckpoint(blocksHost, block, lesson);
    } else if (block.type === "exercise") {
      renderExercise(blocksHost, block, lesson);
    } else if (window.WIDGET_RENDERERS && window.WIDGET_RENDERERS[block.type]) {
      window.WIDGET_RENDERERS[block.type](blocksHost, block, lesson);
    }
  }
  window.LorekeeperTutor?.attach();
}

function syncCompleteControls(lesson) {
  const status = els.content.querySelector("[data-footer-status]");
  const button = els.content.querySelector("[data-complete]");
  if (button) {
    const done = isDone(lesson.id);
    button.textContent = done ? "Completed" : "Done reading";
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
    <div class="lesson-prose">${window.LorekeeperSanitize?.html(block.prompt) || ""}</div>
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
    frame.setAttribute("sandbox", isScripted ? "allow-scripts" : "");
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

    if (!isText) {
      const frame = frameFor();
      frame.srcdoc = isScripted
        ? scriptedDocument(block, editor.value)
        : editor.value;
    }

    let results;
    try {
      results = await runTestsInSandbox({
        mode: isText ? "text" : isScripted ? "js" : "html",
        html: isScripted ? block.html || "" : editor.value,
        code: editor.value,
        mock: block.mock,
        tests: block.tests,
        text: editor.value,
        viewport: block.viewport,
      });
    } catch (error) {
      results = [
        {
          name: "Test runner",
          ok: false,
          message: error && error.message ? error.message : String(error),
        },
      ];
    }

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

function mockScript(mock = {}) {
  const status = Number(mock.status ?? 200);
  const ok = status >= 200 && status < 300;
  const json = JSON.stringify(mock.body ?? {}).replaceAll("</script", "<\\/script");
  const textBody = JSON.stringify(json);
  if (mock.error) {
    return "window.fetch = () => Promise.reject(new Error('network'));";
  }
  return `window.fetch = () => Promise.resolve({ ok: ${ok}, status: ${status}, json: () => Promise.resolve((${json})), text: () => Promise.resolve(${textBody}) });`;
}

function escapeScript(code) {
  return String(code || "").replaceAll("</script", "<\\/script");
}

function injectCSP(html, meta) {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => match + meta);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => match + `<head>${meta}</head>`);
  }
  return `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`;
}

function injectBeforeBody(html, content) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${content}</body>`);
  }
  return html + content;
}

function scriptedDocument(block, code) {
  const csp =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none';";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const html = block.html || "<!doctype html><html><body></body></html>";
  const injected = `<script>${mockScript(block.mock)}</script><script>${escapeScript(code)}</script>`;
  return injectBeforeBody(injectCSP(html, meta), injected);
}

let testFrame = null;

function testSandbox() {
  if (testFrame && testFrame.isConnected) return testFrame;
  const frame = document.createElement("iframe");
  frame.className = "test-frame";
  frame.setAttribute("title", "Exercise test sandbox");
  frame.setAttribute("sandbox", "allow-scripts");
  document.body.appendChild(frame);
  testFrame = frame;
  return frame;
}

function testDocument({ mode, html, code, mock, nonce }) {
  const csp =
    `default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src 'none'; frame-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none';`;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const delay = mode === "js" ? 180 : 0;
  const runner = `<script nonce="${nonce}">(() => {
    const assert = (condition, message) => { if (!condition) throw new Error(message || "Assertion failed"); };
    const assertEqual = (actual, expected, message) => { if (actual !== expected) throw new Error(message || ("Expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual))); };
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.type !== "lorekeeper-run-tests") return;
      const results = (data.tests || []).map((test) => {
        try {
          const fn = new Function("doc", "text", "assert", "assertEqual", test.script);
          fn(document, data.text || "", assert, assertEqual);
          return { name: test.name, ok: true };
        } catch (error) {
          return { name: test.name, ok: false, message: error && error.message ? error.message : String(error) };
        }
      });
      parent.postMessage({ type: "lorekeeper-test-results", id: data.id, results }, "*");
    });
    setTimeout(() => parent.postMessage({ type: "lorekeeper-test-ready" }, "*"), ${delay});
  })();<\/script>`;
  let doc = html || "<!doctype html><html><body></body></html>";
  if (mode === "js") {
    const extra = `<script nonce="${nonce}">${escapeScript(mockScript(mock))}</script><script nonce="${nonce}">${escapeScript(code)}</script>`;
    doc = injectBeforeBody(injectCSP(doc, meta), extra + runner);
  } else {
    doc = injectBeforeBody(injectCSP(doc, meta), runner);
  }
  return doc;
}

function runTestsInSandbox({ mode, html, code, mock, tests, text, viewport }) {
  return new Promise((resolve, reject) => {
    const frame = testSandbox();
    const nonce = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 24);
    const id = `${nonce}-${Date.now()}`;
    const width = viewport?.width || 1024;
    const height = viewport?.height || 768;
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;

    let sent = false;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    const timer = setTimeout(() => {
      cleanup();
      frame.remove();
      if (testFrame === frame) testFrame = null;
      reject(new Error("Tests timed out."));
    }, 8000);

    function onMessage(event) {
      if (event.source !== frame.contentWindow || !event.data) return;
      const data = event.data;
      if (data.type === "lorekeeper-test-ready" && !sent) {
        sent = true;
        frame.contentWindow.postMessage(
          { type: "lorekeeper-run-tests", id, tests, text: text || "" },
          "*"
        );
      } else if (data.type === "lorekeeper-test-results" && data.id === id) {
        cleanup();
        resolve(Array.isArray(data.results) ? data.results : []);
      }
    }

    window.addEventListener("message", onMessage);
    frame.srcdoc = testDocument({ mode, html, code, mock, nonce });
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

function courseStatus(course) {
  const progress = window.LorekeeperPackStorage?.getProgress(course.slug) || {};
  const done = Object.keys(progress.completed || {}).length;
  const total = Number(course.lessons) || 0;
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const history = Array.isArray(progress.history) ? progress.history : [];
  const last = history.reduce((latest, item) => (String(item.at) > latest ? String(item.at) : latest), "");
  return { done, total, percent, last };
}

function continueCandidate() {
  return (state.index?.courses || [])
    .map((course) => ({ course, ...courseStatus(course) }))
    .filter((item) => item.done > 0 && item.done < item.total)
    .sort((a, b) => b.last.localeCompare(a.last) || b.percent - a.percent)[0] || null;
}

async function fetchCourseData(slug) {
  const local = window.LorekeeperLibrary?.course(slug);
  if (local) return local.course;
  return getJSON(new URL(`../build/${slug}/course.json`, location.href).href);
}

async function fillContinue(candidate) {
  const hero = document.getElementById("quest-hero");
  if (!hero) return;
  try {
    const data = await fetchCourseData(candidate.course.slug);
    const completed = window.LorekeeperPackStorage?.getProgress(candidate.course.slug)?.completed || {};
    for (const module of data.modules || []) {
      const position = module.lessons.findIndex((lesson) => !completed[lesson.id]);
      if (position < 0) continue;
      const lesson = module.lessons[position];
      const word = isQuest() ? "Scene" : "Lesson";
      const next = hero.querySelector("[data-hero-next]");
      if (next) {
        next.textContent = `Next: Chapter ${module.number}, ${word} ${position + 1}. ${lesson.title}`;
      }
      const link = hero.querySelector("[data-hero-continue]");
      if (link) link.href = `?course=${encodeURIComponent(candidate.course.slug)}#${encodeURIComponent(lesson.id)}`;
      return;
    }
  } catch {
    /* keep the generic continue link */
  }
}

function renderPicker() {
  const quest = isQuest();
  els.content.className = "content picker-content";
  if (els.courseProgress) els.courseProgress.hidden = true;
  const idleEmblem = window.LorekeeperArt ? window.LorekeeperArt.courseEmblem("library") : "";
  els.courseMeta.innerHTML = `
    <div class="course-emblem">${idleEmblem}</div>
    <div class="course-meta-text">
      <div class="code">${quest ? "No quest open" : "Library"}</div>
      <div class="title">Choose a course to begin</div>
    </div>`;

  const candidate = continueCandidate();
  const unit = quest ? "scenes" : "lessons";
  const heroArt = candidate
    ? window.LorekeeperArt?.courseCoverUrl(candidate.course) || "art/quest/hero.webp"
    : "art/quest/hero.webp";
  const hero = candidate
    ? `
      <section class="quest-hero continuing" id="quest-hero">
        <img class="quest-hero-art" src="${heroArt}" alt="" width="1216" height="832">
        <div class="quest-hero-body">
          <p class="eyebrow">${quest ? "Continue your quest" : "Continue where you left off"}</p>
          <h1>${escapeHtml(candidate.course.title)}</h1>
          <p class="picker-lede" data-hero-next>${candidate.done} of ${candidate.total} ${unit} complete</p>
          <div class="hero-progress" aria-hidden="true"><span style="width:${candidate.percent}%"></span></div>
          <a class="btn primary hero-cta" data-hero-continue href="?course=${encodeURIComponent(candidate.course.slug)}">Continue</a>
        </div>
      </section>`
    : `
      <section class="quest-hero" id="quest-hero">
        <img class="quest-hero-art" src="${heroArt}" alt="" width="1216" height="832">
        <div class="quest-hero-body">
          <p class="eyebrow">Lorekeeper</p>
          <h1>${quest ? "Choose your quest" : "Choose a course"}</h1>
          <p class="picker-lede">Story-driven courses for your personal learning path. Your progress stays on this device.</p>
        </div>
      </section>`;

  const cards = state.index.courses.length
    ? state.index.courses
        .map((course) => {
          const status = courseStatus(course);
          const label =
            status.done === 0
              ? quest ? "New quest" : "Not started"
              : status.done >= status.total
                ? quest ? "Quest complete" : "Completed"
                : `In progress · ${status.percent}%`;
          return `
          <div class="course-row">
            <a class="course-card" href="?course=${encodeURIComponent(course.slug)}">
              <span class="course-cover-frame">
                <img class="course-cover" src="${window.LorekeeperArt ? window.LorekeeperArt.courseCoverUrl(course) : ""}" alt="" loading="lazy" width="640" height="360">
                <span class="course-emblem-badge">${window.LorekeeperArt ? window.LorekeeperArt.courseEmblem(course.slug, course) : ""}</span>
              </span>
              <span class="course-card-body">
                <span class="course-card-kicker">${label}</span>
                <span class="title">${escapeHtml(course.title)}</span>
                <span class="meta">${course.modules} chapters · ${course.lessons} ${unit}${course.source === "local" ? " · Local pack" : ""}</span>
                <span class="course-card-bar" aria-hidden="true"><span style="width:${status.percent}%"></span></span>
              </span>
              <span class="course-open" aria-hidden="true">Open <span>→</span></span>
            </a>
          </div>`;
        })
        .join("")
    : `
      <div class="empty-library">
        <h2>Your library is empty</h2>
        <p>Add a pack from the store, import one, or start with the built-in starter kit.</p>
        <button class="btn primary" type="button" data-starter>Add the starter kit</button>
      </div>`;

  els.content.innerHTML = `
    <div class="placeholder picker">
      ${hero}
      <div id="wayfinder-host"></div>
      <h2 class="library-heading">${quest ? "Your quests" : "Your library"}</h2>
      <div class="course-list${state.index.courses.length ? "" : " empty"}">${cards}</div>
      <div class="picker-tools">
        <button id="store-open" class="btn" type="button" data-store-open>Browse packs</button>
        <button id="manage-open" class="btn" type="button" data-manage-open>Manage library</button>
        <button id="pack-import" class="btn" type="button">Import a pack</button>
        <input id="pack-file" type="file" accept=".json,application/json" hidden>
      </div>
    </div>`;
  bindPickerTools();
  window.LorekeeperWayfinder?.renderPicker();
  if (candidate) fillContinue(candidate);
}

window.LorekeeperApp = window.LorekeeperApp || {};
window.LorekeeperApp.renderPicker = renderPicker;

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
        const reserved = (state.index.allCourses || state.index.courses)
          .filter((course) => course.source !== "local")
          .map((course) => course.slug);
        await window.LorekeeperLibrary.store(pack, reserved);
        toast(`Imported ${pack.title}.`);
        setTimeout(() => location.reload(), 500);
      } catch (error) {
        toast(error.message || "Import failed.");
        event.target.value = "";
      }
    });
  }
  document.querySelectorAll("[data-starter]").forEach((button) => {
    button.addEventListener("click", () => window.LorekeeperManage?.restoreStarter());
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
  fetch(new URL("../store/catalog.json", location.href)).catch(() => {});
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
