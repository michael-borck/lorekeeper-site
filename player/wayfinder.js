/* Local, deterministic wayfinder for the course picker. */
(function () {
  const PATH_KEY = "lorekeeper:path";
  const QUESTIONS = [
    {
      id: "goal",
      title: "What do you want to be able to do?",
      options: [
        { label: "Build and ship a client website", tags: ["web", "design", "client", "accessibility", "ai"] },
        { label: "Troubleshoot systems and networks", tags: ["systems", "networking", "operations", "incident"] },
        { label: "Work with business data", tags: ["data", "sql", "api"] },
        { label: "Review security, risk and controls", tags: ["security", "incident", "systems"] },
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
        { label: "A spreadsheet is the real source of truth", tags: ["data", "sql", "api"] },
        { label: "A vendor proposal needs a risk review", tags: ["security", "incident", "systems"] },
      ],
    },
    {
      id: "style",
      title: "How do you want to start?",
      options: [
        { label: "Build something first", tags: ["exercise", "web", "practice"] },
        { label: "Follow a story and a client", tags: ["story", "client", "incident"] },
        { label: "Try a quick workbench", tags: ["quick", "tools", "practice"] },
      ],
    },
  ];

  let bound = false;

  const $ = (id) => document.getElementById(id);

  function currentPath() {
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

  function completedFor(slug) {
    try {
      const raw = localStorage.getItem(`lorekeeper:progress:${slug}`);
      const data = raw ? JSON.parse(raw) : null;
      return new Set(Object.keys(data?.completed || {}));
    } catch {
      return new Set();
    }
  }

  function nextStep(path) {
    if (!path || !Array.isArray(path.steps)) return null;
    const completed = completedFor(path.course);
    return path.steps.find((step) => !completed.has(step.id)) || null;
  }

  function go(path, step) {
    const url = new URL(location.href);
    url.search = `?course=${encodeURIComponent(path.course)}`;
    url.hash = step?.id || path.start || "";
    location.href = url.href;
  }

  function scoreCourses(answers) {
    const courses = state.index?.courses || [];
    const scores = new Map(courses.map((course) => [course.slug, 0]));
    const add = (tags, weight) => {
      courses.forEach((course) => {
        const courseTags = new Set(course.tags || []);
        if (tags.some((tag) => courseTags.has(tag))) {
          scores.set(course.slug, (scores.get(course.slug) || 0) + weight);
        }
      });
    };

    QUESTIONS.forEach((question) => {
      const option = question.options[answers[question.id]];
      if (!option || !option.tags) return;
      add(option.tags, question.id === "goal" ? 3 : question.id === "situation" ? 2 : 1);
    });

    const experience = QUESTIONS[1].options[answers.experience]?.value;
    for (const course of courses) {
      const level = String(course.level || "beginner");
      if (experience === "new" && level === "beginner") scores.set(course.slug, scores.get(course.slug) + 2);
      if (experience === "some" && level === "intermediate") scores.set(course.slug, scores.get(course.slug) + 2);
      if (experience === "confident" && level === "intermediate") scores.set(course.slug, scores.get(course.slug) + 1);
      const done = completedFor(course.slug).size;
      if (course.lessons && done > 0 && done < course.lessons) scores.set(course.slug, scores.get(course.slug) + 2);
      if (course.lessons && done >= course.lessons) scores.set(course.slug, scores.get(course.slug) - 4);
    }

    return courses
      .map((course, index) => ({ course, index, score: scores.get(course.slug) || 0 }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }

  async function fetchCourse(slug) {
    const local = window.LorekeeperLibrary?.course(slug);
    if (local) return local.course;
    const response = await fetch(new URL(`../build/${slug}/course.json`, location.href));
    if (!response.ok) throw new Error(`Could not load ${slug}`);
    return response.json();
  }

  async function buildSteps(course) {
    try {
      const data = await fetchCourse(course.slug);
      const flat = [];
      for (const module of data.modules || []) {
        for (const lesson of module.lessons || []) {
          flat.push({ ...lesson, moduleNumber: module.number, moduleTitle: module.title });
        }
      }
      let start = flat.findIndex((lesson) => lesson.id === (course.start || ""));
      if (start < 0) start = 0;
      const candidates = flat.slice(start);
      if (!candidates.length) return [];
      const selected = candidates.slice(0, 3);
      const story = candidates.slice(0, 5).find((lesson) => lesson.kind === "story");
      if (story && !selected.includes(story)) selected[2] = story;
      return selected.filter(Boolean).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        kind: lesson.kind,
        module: `${lesson.moduleNumber}. ${lesson.moduleTitle}`,
      }));
    } catch {
      return [];
    }
  }

  async function recommend(answers) {
    const ranked = scoreCourses(answers);
    if (!ranked.length) return null;
    const primary = ranked[0].course;
    const secondary = ranked.slice(1).find((item) => item.score > 0)?.course || ranked[1]?.course || null;
    const steps = await buildSteps(primary);
    const path = {
      version: 1,
      course: primary.slug,
      title: primary.title,
      pitch: primary.pitch || "",
      start: primary.start || "",
      answers,
      steps,
      secondary: secondary
        ? { slug: secondary.slug, title: secondary.title }
        : null,
      createdAt: new Date().toISOString(),
    };
    savePath(path);
    renderSidebarTrail();
    renderPicker();
    return path;
  }

  function renderQuestions() {
    const body = $("wayfinder-body");
    if (!body) return;
    $("wayfinder-intro").textContent = "Four quick questions. Nothing leaves this device.";
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
      submit.disabled = !QUESTIONS.every((question) =>
        form.querySelector(`input[name="${question.id}"]:checked`)
      );
    };
    form.addEventListener("change", update);
    $("wayfinder-skip").addEventListener("click", () => $("wayfinder-dialog").close());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const answers = {};
      QUESTIONS.forEach((question) => {
        answers[question.id] = Number(
          form.querySelector(`input[name="${question.id}"]:checked`)?.value || 0
        );
      });
      submit.disabled = true;
      submit.textContent = "Finding your trail...";
      const path = await recommend(answers);
      if (path) renderResult(path);
      else {
        $("wayfinder-intro").textContent = "No courses are available yet.";
        submit.disabled = false;
        submit.textContent = "Show my trail";
      }
    });
  }

  function renderResult(path) {
    const body = $("wayfinder-body");
    const next = nextStep(path);
    $("wayfinder-intro").textContent = "Your trail is saved on this device.";
    body.innerHTML = `
      <p class="eyebrow">Your trail</p>
      <h3 class="wayfinder-course">${escapeHtml(path.title)}</h3>
      ${path.pitch ? `<p class="widget-note">${escapeHtml(path.pitch)}</p>` : ""}
      <ol class="trail-steps">
        ${path.steps
          .map(
            (step, index) => `
          <li class="trail-step ${next && next.id === step.id ? "next" : ""}">
            <span class="trail-index">${index + 1}</span>
            <span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.module || "")}</small></span>
          </li>`
          )
          .join("")}
      </ol>
      ${
        path.secondary
          ? `<p class="widget-note">Then explore <strong>${escapeHtml(path.secondary.title)}</strong>.</p>`
          : ""
      }
      <div class="toolbar">
        <button class="btn primary" type="button" data-wayfinder-start>Start this trail</button>
        <button class="btn" type="button" data-wayfinder-retake>Change answers</button>
      </div>`;
    body.querySelector("[data-wayfinder-start]").addEventListener("click", () => {
      $("wayfinder-dialog").close();
      go(path, next || path.steps[0]);
    });
    body.querySelector("[data-wayfinder-retake]").addEventListener("click", renderQuestions);
  }

  function pathAvailable(path) {
    if (!path) return false;
    return (state.index?.courses || []).some((course) => course.slug === path.course);
  }

  function renderPicker() {
    const host = $("wayfinder-host");
    if (!host) return;
    const courses = state.index?.courses || [];
    if (!courses.length) {
      host.innerHTML = `
        <div class="wayfinder-cta">
          <div>
            <p class="eyebrow">Your library</p>
            <h2>Add a pack to start</h2>
            <p>Browse the store or restore the starter kit. Your progress stays on this device.</p>
          </div>
          <button class="btn primary" type="button" data-store-open>Browse packs</button>
        </div>`;
      return;
    }
    const path = currentPath();
    if (path && !pathAvailable(path)) {
      host.innerHTML = `
        <div class="wayfinder-cta">
          <div>
            <p class="eyebrow">Your trail</p>
            <h2>Your trail course is no longer installed</h2>
            <p>Choose a new trail from the courses in your library.</p>
          </div>
          <button class="btn primary" type="button" data-wayfinder-open>Find a new trail</button>
        </div>`;
      return;
    }
    if (!path) {
      host.innerHTML = `
        <div class="wayfinder-cta">
          <div>
            <p class="eyebrow">New here?</p>
            <h2>Find your trail</h2>
            <p>Four quick questions point you at a starting course and three lessons. Nothing leaves this device.</p>
          </div>
          <button class="btn primary" type="button" data-wayfinder-open>Find my trail</button>
        </div>`;
      return;
    }
    const next = nextStep(path);
    const completed = completedFor(path.course);
    host.innerHTML = `
      <div class="trail-card picker-trail">
        <div class="trail-head">
          <span>Your trail</span>
          <button class="ghost small" type="button" data-wayfinder-open>Change</button>
        </div>
        <strong class="trail-course">${escapeHtml(path.title)}</strong>
        <ol class="trail-steps">
          ${path.steps
            .map(
              (step, index) => `
            <li class="trail-step ${completed.has(step.id) ? "done" : ""} ${next && next.id === step.id ? "next" : ""}">
              <span class="trail-index">${completed.has(step.id) ? "✓" : index + 1}</span>
              <span>${escapeHtml(step.title)}</span>
            </li>`
            )
            .join("")}
        </ol>
        ${
          next
            ? `<button class="btn primary" type="button" data-wayfinder-start>Continue</button>`
            : `<p class="widget-note ok">Trail complete.</p>${
                path.secondary
                  ? `<button class="btn" type="button" data-wayfinder-secondary="${escapeHtml(path.secondary.slug)}">Explore ${escapeHtml(path.secondary.title)}</button>`
                  : ""
              }`
        }
      </div>`;
  }

  function renderSidebarTrail() {
    const card = $("trail-card");
    if (!card) return;
    const path = currentPath();
    if (!path || !pathAvailable(path)) {
      card.hidden = true;
      return;
    }
    const next = nextStep(path);
    card.hidden = false;
    card.innerHTML = `
      <div class="trail-head">
        <span>Your trail</span>
        <button class="ghost small" type="button" data-wayfinder-open>Change</button>
      </div>
      <div class="trail-course">${escapeHtml(path.title)}</div>
      ${
        next
          ? `<div class="trail-next">Next: ${escapeHtml(next.title)}</div>`
          : `<div class="trail-next">Trail complete.${path.secondary ? ` Try ${escapeHtml(path.secondary.title)}.` : ""}</div>`
      }
      ${
        next
          ? `<button class="btn primary small" type="button" data-wayfinder-start>Continue</button>`
          : path.secondary
            ? `<button class="btn small" type="button" data-wayfinder-secondary="${escapeHtml(path.secondary.slug)}">Explore next course</button>`
            : ""
      }`;
  }

  function openWizard() {
    renderQuestions();
    const dialog = $("wayfinder-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
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
    document.addEventListener("click", (event) => {
      const open = event.target.closest("[data-wayfinder-open]");
      if (open) {
        event.preventDefault();
        openWizard();
        return;
      }
      const start = event.target.closest("[data-wayfinder-start]");
      if (start) {
        event.preventDefault();
        const path = currentPath();
        if (path) go(path, nextStep(path) || path.steps[0]);
        return;
      }
      const secondary = event.target.closest("[data-wayfinder-secondary]");
      if (secondary) {
        event.preventDefault();
        location.href = `?course=${encodeURIComponent(secondary.dataset.wayfinderSecondary)}`;
      }
    });
  }

  function init() {
    bind();
    renderPicker();
    renderSidebarTrail();
  }

  window.LorekeeperWayfinder = {
    init,
    recommend,
    open: openWizard,
    renderPicker,
    renderSidebarTrail,
    currentPath,
    nextStep,
  };
})();
