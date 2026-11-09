/* Wayfinder: four questions plan a trail across courses, drawn on the world map. */
(function () {
  const PATH_KEY = "lorekeeper:path";
  const PANEL_KEY = "lorekeeper:trail-open";
  const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 };
  const QUESTIONS = [
    {
      id: "goal",
      title: "What do you want to be able to do?",
      options: [
        { label: "Build and ship a website or app", tags: ["web", "design", "client", "accessibility", "html", "javascript"] },
        { label: "Program, and direct AI while I do it", tags: ["python", "programming", "computational-thinking", "prompting"] },
        { label: "Use AI with good judgement", tags: ["ai", "judgement", "verification", "evaluation", "llm"] },
        { label: "Troubleshoot systems and networks", tags: ["systems", "networking", "operations", "routing", "troubleshooting"] },
        { label: "Review security, risk and controls", tags: ["security", "audit", "risk", "incident", "forensics"] },
        { label: "Teach with these tools", tags: ["teaching", "education", "projects", "assessment"] },
      ],
    },
    {
      id: "experience",
      title: "How much have you done before?",
      options: [
        { label: "I am new to this", value: "new" },
        { label: "I have built or studied some of it", value: "some" },
        { label: "I am confident and want a challenge", value: "confident" },
      ],
    },
    {
      id: "situation",
      title: "Which week sounds most familiar?",
      options: [
        { label: "A client wants a launch date", tags: ["client", "web", "design"] },
        { label: "A service is down and nobody knows why", tags: ["systems", "networking", "incident", "operations"] },
        { label: "Someone trusts the AI's answer without checking", tags: ["ai", "judgement", "verification", "evidence"] },
        { label: "A vendor proposal needs a risk review", tags: ["security", "risk", "audit", "evidence"] },
        { label: "A spreadsheet is the real source of truth", tags: ["data", "sql", "api", "python"] },
      ],
    },
    {
      id: "style",
      title: "How do you want to start?",
      options: [
        { label: "Build something first", tags: ["exercise", "web", "practice", "projects", "python"] },
        { label: "Follow a story and a client", tags: ["story", "client", "incident"] },
        { label: "Try something quick and playful", tags: ["quick", "tools", "practice", "interactive", "misconceptions"] },
      ],
    },
  ];

  let bound = false;
  let refreshing = null;
  const $ = (id) => document.getElementById(id);

  /* Storage --------------------------------------------------------- */

  function readPath() {
    try {
      const raw = localStorage.getItem(PATH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function savePath(path) {
    try {
      localStorage.setItem(PATH_KEY, JSON.stringify(path));
    } catch {
      /* storage disabled */
    }
  }

  /* Version 1 trails were one course plus a secondary course. */
  function migrate(path) {
    if (!path || typeof path !== "object") return null;
    if (path.version === 2 && Array.isArray(path.stops)) return path;
    if (!path.course) return null;
    const stops = [
      {
        slug: path.course,
        title: path.title || path.course,
        goal: Array.isArray(path.steps) ? path.steps.map(({ id, title, kind }) => ({ id, title, kind })) : [],
        chapter: "",
      },
    ];
    if (path.secondary?.slug) stops.push({ slug: path.secondary.slug, title: path.secondary.title || "", goal: [], chapter: "" });
    return { version: 2, answers: path.answers || {}, stops, createdAt: path.createdAt || new Date().toISOString() };
  }

  function currentPath() {
    const raw = readPath();
    const path = migrate(raw);
    if (path && raw?.version !== 2) savePath(path);
    return path;
  }

  function completedFor(slug) {
    const data = window.LorekeeperPackStorage?.getProgress(slug);
    return new Set(Object.keys(data?.completed || {}));
  }

  /* Course lookup -------------------------------------------------- */

  function lookup(slug) {
    const visible = state.index?.courses || [];
    const all = state.index?.allCourses || visible;
    const course = all.find((item) => item.slug === slug);
    if (!course) return { status: "store", course: null };
    return { status: visible.some((item) => item.slug === slug) ? "installed" : "hidden", course };
  }

  async function fetchCourse(slug) {
    const local = window.LorekeeperLibrary?.course(slug);
    if (local) return local.course;
    const response = await fetch(new URL(`../build/${slug}/course.json`, location.href));
    if (!response.ok) throw new Error(`Could not load ${slug}`);
    return response.json();
  }

  /* A stop's goal is the chapter that holds the course's starting scene. */
  async function goalFor(slug, start) {
    try {
      const data = await fetchCourse(slug);
      const modules = data.modules || [];
      const module =
        modules.find((item) => (item.lessons || []).some((lesson) => lesson.id === (start || data.unit?.start))) ||
        modules[0];
      if (!module) return { goal: [], chapter: "" };
      return {
        goal: (module.lessons || []).map(({ id, title, kind }) => ({ id, title, kind })),
        chapter: `Chapter ${module.number}: ${module.title}`,
      };
    } catch {
      return { goal: [], chapter: "" };
    }
  }

  /* Fill goals for stops that have become available since the trail was made. */
  async function refreshPath() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const path = currentPath();
      if (!path) return null;
      let changed = false;
      for (const stop of path.stops) {
        const { status, course } = lookup(stop.slug);
        if (status !== "store" && !stop.goal?.length) {
          Object.assign(stop, await goalFor(stop.slug, course?.start));
          changed = true;
        }
      }
      if (changed) savePath(path);
      return path;
    })();
    try {
      return await refreshing;
    } finally {
      refreshing = null;
    }
  }

  /* Trail state ----------------------------------------------------- */

  function trailState(path = currentPath()) {
    if (!path?.stops?.length) return null;
    let currentFound = false;
    const stops = path.stops.map((stop) => {
      const { status, course } = lookup(stop.slug);
      const completed = completedFor(stop.slug);
      const goal = stop.goal || [];
      const done = goal.length > 0 && status !== "store" && goal.every((lesson) => completed.has(lesson.id));
      const next = goal.find((lesson) => !completed.has(lesson.id)) || null;
      const current = !done && !currentFound;
      if (current) currentFound = true;
      return {
        ...stop,
        title: course?.title || stop.title,
        course: course || { slug: stop.slug, title: stop.title, tags: stop.tags || [], narrator: stop.narrator || "" },
        status,
        done,
        current,
        next,
        goalDone: goal.filter((lesson) => completed.has(lesson.id)).length,
      };
    });
    const doneCount = stops.filter((stop) => stop.done).length;
    return { path, stops, doneCount, complete: doneCount === stops.length, current: stops.find((stop) => stop.current) || null };
  }

  function nextStep(path = currentPath()) {
    return trailState(path)?.current?.next || null;
  }

  async function act(stop) {
    if (!stop) return;
    if (stop.status === "installed") {
      const url = new URL(location.href);
      url.search = `?course=${encodeURIComponent(stop.slug)}`;
      url.hash = stop.next?.id || "";
      location.href = url.href;
      return;
    }
    if (stop.status === "hidden") {
      const hidden = new Set(window.LorekeeperPackStorage?.getSetting("hidden-courses", []) || []);
      hidden.delete(stop.slug);
      await window.LorekeeperPackStorage?.setSetting("hidden-courses", [...hidden]);
      location.href = `?course=${encodeURIComponent(stop.slug)}${stop.next ? `#${encodeURIComponent(stop.next.id)}` : ""}`;
      return;
    }
    $("wayfinder-dialog")?.close();
    window.LorekeeperStore?.open({ query: stop.title });
  }

  function actionLabel(stop) {
    if (!stop) return "";
    if (stop.status === "installed") return stop.goalDone ? "Continue" : "Start";
    if (stop.status === "hidden") return "Add to library";
    return "Find in store";
  }

  /* Recommendation -------------------------------------------------- */

  async function candidates() {
    const list = window.LorekeeperWorld ? await window.LorekeeperWorld.places() : (state.index?.courses || []).map((course) => ({ ...course, status: "installed" }));
    return list;
  }

  function scoreCourses(answers, list) {
    const experience = QUESTIONS[1].options[answers.experience]?.value;
    return list
      .map((course, index) => {
        const tags = new Set((course.tags || []).map((tag) => String(tag).toLowerCase()));
        let score = 0;
        QUESTIONS.forEach((question) => {
          const option = question.options[answers[question.id]];
          if (!option?.tags) return;
          const weight = question.id === "goal" ? 3 : question.id === "situation" ? 2 : 1;
          if (option.tags.some((tag) => tags.has(tag))) score += weight;
        });
        const level = String(course.level || "beginner");
        if (experience === "new" && level === "beginner") score += 2;
        if (experience === "some" && level === "intermediate") score += 2;
        if (experience === "confident" && level !== "beginner") score += 1;
        if (course.status === "installed") score += 1;
        const done = completedFor(course.slug).size;
        if (course.lessons && done > 0 && done < course.lessons) score += 2;
        if (course.lessons && done >= course.lessons) score -= 6;
        return { course, index, score };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }

  async function recommend(answers) {
    const ranked = scoreCourses(answers, await candidates());
    if (!ranked.length) return null;
    const firstIndex = ranked.findIndex((item) => item.course.status === "installed");
    const first = ranked[firstIndex >= 0 ? firstIndex : 0];
    const rest = ranked
      .filter((item) => item !== first && item.score > 0)
      .slice(0, 3)
      .sort(
        (a, b) =>
          (LEVEL_RANK[a.course.level] ?? 1) - (LEVEL_RANK[b.course.level] ?? 1) || b.score - a.score
      );
    if (!rest.length && ranked.length > 1) rest.push(ranked.find((item) => item !== first));
    const stops = [];
    for (const { course } of [first, ...rest]) {
      const goal = course.status === "store" ? { goal: [], chapter: "" } : await goalFor(course.slug, course.start);
      stops.push({ slug: course.slug, title: course.title, tags: course.tags || [], narrator: course.narrator || "", ...goal });
    }
    const path = { version: 2, answers, stops, createdAt: new Date().toISOString() };
    savePath(path);
    renderSidebarTrail();
    renderPicker();
    return path;
  }

  /* Rendering ------------------------------------------------------- */

  function regionName(course) {
    return window.LorekeeperWorld ? window.LorekeeperWorld.region(course).name : "";
  }

  function stopStatus(stop) {
    if (stop.done) return "Done";
    if (stop.status === "store") return "Unexplored · in the pack store";
    if (stop.status === "hidden") return "Unexplored · built in";
    if (stop.goal?.length) return `${stop.goalDone} of ${stop.goal.length} · ${stop.chapter || "first chapter"}`;
    return "Ready";
  }

  function stripHtml(trail, { compact = false } = {}) {
    const emblem = (stop) => (window.LorekeeperArt ? window.LorekeeperArt.courseEmblem(stop.slug, stop.course) : "");
    const shortTitle = (title) => (window.LorekeeperWorld ? window.LorekeeperWorld.shortTitle(title) : title);
    return `
      <ol class="trail-strip${compact ? " compact" : ""}">
        ${trail.stops
          .map(
            (stop, index) => `
          <li class="trail-stop${stop.done ? " done" : ""}${stop.current ? " current" : ""}${stop.status !== "installed" ? " unexplored" : ""}">
            <span class="trail-node" aria-hidden="true">${emblem(stop)}<span>${stop.done ? "✓" : index + 1}</span></span>
            <span class="trail-stop-text">
              <strong>${escapeHtml(compact ? shortTitle(stop.title) : stop.title)}</strong>
              <small>${escapeHtml(compact ? stopStatus(stop) : `${regionName(stop.course)} · ${stopStatus(stop)}`)}</small>
            </span>
          </li>`
          )
          .join("")}
      </ol>`;
  }

  function celebrate(trail) {
    if (!trail?.complete || trail.path.completedAt) return;
    trail.path.completedAt = new Date().toISOString();
    savePath(trail.path);
    const quest = window.LorekeeperQuest;
    if (quest && document.documentElement.dataset.theme !== "study") {
      window.LorekeeperSound?.play("level");
      quest.moment({
        type: "level",
        kicker: "Trail complete",
        title: "Pathfinder",
        detail: `You walked all ${trail.stops.length} stops of your trail.`,
        icon: "map",
      });
    } else if (typeof toast === "function") {
      toast("Trail complete. You earned Pathfinder.");
    }
  }

  function renderQuestions() {
    const body = $("wayfinder-body");
    if (!body) return;
    $("wayfinder-intro").textContent = "Four quick questions plot a trail across the realm. Nothing leaves this device.";
    body.innerHTML = `
      <form id="wayfinder-form">
        ${QUESTIONS.map(
          (question, index) => `
          <fieldset class="wayfinder-question">
            <legend>${index + 1}. ${escapeHtml(question.title)}</legend>
            <div class="wayfinder-options">
              ${question.options
                .map(
                  (option, optionIndex) => `
                <label class="wayfinder-option">
                  <input type="radio" name="${question.id}" value="${optionIndex}">
                  <span>${escapeHtml(option.label)}</span>
                </label>`
                )
                .join("")}
            </div>
          </fieldset>`
        ).join("")}
        <div class="toolbar">
          <button id="wayfinder-submit" class="btn primary" type="submit" disabled>Show my trail</button>
          <button id="wayfinder-skip" class="ghost" type="button">Skip for now</button>
        </div>
      </form>`;
    const form = $("wayfinder-form");
    const submit = $("wayfinder-submit");
    const update = () => {
      submit.disabled = !QUESTIONS.every((question) => form.querySelector(`input[name="${question.id}"]:checked`));
    };
    form.addEventListener("change", update);
    $("wayfinder-skip").addEventListener("click", () => $("wayfinder-dialog").close());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const answers = {};
      QUESTIONS.forEach((question) => {
        answers[question.id] = Number(form.querySelector(`input[name="${question.id}"]:checked`)?.value || 0);
      });
      submit.disabled = true;
      submit.textContent = "Plotting your trail...";
      const path = await recommend(answers);
      if (path) renderResult();
      else {
        $("wayfinder-intro").textContent = "No courses are available yet.";
        submit.disabled = false;
        submit.textContent = "Show my trail";
      }
    });
  }

  function renderResult() {
    const body = $("wayfinder-body");
    const trail = trailState();
    if (!body || !trail) return;
    $("wayfinder-intro").textContent = `Your trail has ${trail.stops.length} stops. It is saved on this device.`;
    body.innerHTML = `
      <p class="eyebrow">Your trail</p>
      ${stripHtml(trail)}
      <p class="widget-note">Each stop asks you to clear its first chapter. Unexplored stops can be added from the store.</p>
      <div class="toolbar">
        <button class="btn primary" type="button" data-trail-act>${escapeHtml(actionLabel(trail.current))}: ${escapeHtml(window.LorekeeperWorld?.shortTitle(trail.current?.title || "") || "")}</button>
        <a class="btn" href="?view=world">See it on the world map</a>
        <button class="btn" type="button" data-wayfinder-retake>Change answers</button>
      </div>`;
    body.querySelector("[data-wayfinder-retake]").addEventListener("click", renderQuestions);
  }

  function renderPicker() {
    const host = $("wayfinder-host");
    if (!host) return;
    const trail = trailState();
    if (!trail) {
      host.innerHTML = `
        <div class="wayfinder-cta">
          <div>
            <p class="eyebrow">New here?</p>
            <h2>Find your trail</h2>
            <p>Four quick questions plot a route across the realm, from your first course to the next few worth exploring.</p>
          </div>
          <div class="wayfinder-cta-actions">
            <button class="btn primary" type="button" data-wayfinder-open>Find my trail</button>
            <a class="btn" href="?view=world">World map</a>
          </div>
        </div>`;
      return;
    }
    celebrate(trail);
    host.innerHTML = `
      <div class="trail-card picker-trail">
        <div class="trail-head">
          <span>Your trail · ${trail.doneCount} of ${trail.stops.length} stops</span>
          <button class="ghost small" type="button" data-wayfinder-open>Change</button>
        </div>
        ${stripHtml(trail)}
        <div class="toolbar">
          ${
            trail.complete
              ? '<p class="widget-note ok">Trail complete. You earned Pathfinder.</p>'
              : `<button class="btn primary" type="button" data-trail-act>${escapeHtml(actionLabel(trail.current))}</button>`
          }
          <a class="btn" href="?view=world">World map</a>
        </div>
      </div>`;
  }

  function panelOpen() {
    try {
      return localStorage.getItem(PANEL_KEY) !== "closed";
    } catch {
      return true;
    }
  }

  function renderSidebarTrail() {
    const panel = $("trail-card");
    if (!panel) return;
    const trail = trailState();
    if (!trail) {
      panel.hidden = true;
      return;
    }
    celebrate(trail);
    panel.hidden = false;
    panel.open = panelOpen();
    const current = trail.current;
    panel.innerHTML = `
      <summary>
        <span class="trail-summary-title">Your trail</span>
        <span class="trail-summary-count">${trail.doneCount}/${trail.stops.length}</span>
      </summary>
      <div class="trail-panel-body">
        ${stripHtml(trail, { compact: true })}
        ${
          current
            ? `<button class="btn primary small" type="button" data-trail-act>${escapeHtml(actionLabel(current))}: ${escapeHtml(window.LorekeeperWorld?.shortTitle(current.title) || current.title)}</button>`
            : '<p class="trail-next">Trail complete. Pathfinder earned.</p>'
        }
        <div class="trail-links">
          <a href="./?view=world">World map</a>
          <button class="link-button" type="button" data-wayfinder-open>Change trail</button>
        </div>
      </div>`;
  }

  function openWizard() {
    const trail = trailState();
    if (trail) renderResult();
    else renderQuestions();
    const dialog = $("wayfinder-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (trail) {
      const retake = $("wayfinder-body").querySelector("[data-wayfinder-retake]");
      retake?.focus();
    }
  }

  function bind() {
    if (bound) return;
    const dialog = $("wayfinder-dialog");
    const close = $("wayfinder-close");
    if (!dialog || !close) return;
    bound = true;
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    const remember = (open) => {
      try {
        localStorage.setItem(PANEL_KEY, open ? "open" : "closed");
      } catch {
        /* session only */
      }
    };
    const panel = $("trail-card");
    // Click fires before the details element toggles, so store the state it is about to take.
    panel?.addEventListener("click", (event) => {
      if (event.target.closest("summary")) remember(!panel.open);
    });
    panel?.addEventListener("toggle", () => remember(panel.open));
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-wayfinder-open]")) {
        event.preventDefault();
        openWizard();
        return;
      }
      if (event.target.closest("[data-trail-act]")) {
        event.preventDefault();
        act(trailState()?.current);
      }
    });
  }

  async function init() {
    bind();
    renderPicker();
    renderSidebarTrail();
    if (currentPath()) {
      await refreshPath();
      renderPicker();
      renderSidebarTrail();
    }
  }

  window.LorekeeperWayfinder = {
    init,
    recommend,
    open: openWizard,
    renderPicker,
    renderSidebarTrail,
    currentPath,
    trailState,
    nextStep,
  };
})();
