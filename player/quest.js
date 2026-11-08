/* Quest layer: lesson verbs, icons, narrators, levels and completion moments. */
(function () {
  const ICONS = {
    book: '<path d="M3 4.5C5.5 3.5 8 3.5 10 5v11c-2-1.5-4.5-1.5-7-.5z"/><path d="M17 4.5C14.5 3.5 12 3.5 10 5v11c2-1.5 4.5-1.5 7-.5z"/>',
    quiz: '<circle cx="10" cy="10" r="7"/><path d="M8 8a2 2 0 1 1 3 1.7c-.7.4-1 .9-1 1.6"/><path d="M10 14h.01"/>',
    hammer: '<path d="M11 4l5 5-2 2-5-5z"/><path d="M9 6L3 12l3 3 6-6"/>',
    sort: '<path d="M6 4v12M3 13l3 3 3-3"/><path d="M14 16V4M11 7l3-3 3 3"/>',
    pencil: '<path d="M4 16l1-4 8-8 3 3-8 8z"/><path d="M11 6l3 3"/>',
    target: '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/>',
    lens: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17"/>',
    fork: '<path d="M10 17v-6M10 11L5 5M10 11l5-6"/><path d="M3 5h4M13 5h4"/>',
    scales: '<path d="M10 3v14M5 17h10M4 6h12"/><path d="M4 6l-2 5h4zM16 6l-2 5h4z"/>',
    shield: '<path d="M10 2l6 2.5v5c0 4-2.8 6.5-6 8-3.2-1.5-6-4-6-8v-5z"/>',
    plug: '<path d="M7 2v4M13 2v4M5 6h10v3a5 5 0 0 1-10 0z"/><path d="M10 14v4"/>',
    database: '<ellipse cx="10" cy="5" rx="6" ry="2.5"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5"/><path d="M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>',
    prompt: '<rect x="2" y="3" width="16" height="14"/><path d="M5 8l3 2-3 2M10 13h4"/>',
    mask: '<path d="M3 5c4 1 10 1 14 0v5c0 4-3 6-7 6s-7-2-7-6z"/><path d="M6.5 9h2M11.5 9h2M8 12.5c1.2.8 2.8.8 4 0"/>',
    map: '<path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z"/><path d="M7 3v12M13 5v12"/>',
    star: '<path d="M10 2l2.4 5 5.6.6-4.2 3.8 1.2 5.6L10 14.2 5 17l1.2-5.6L2 7.6 7.6 7z"/>',
  };

  const KINDS = {
    reading: { verb: "Read", icon: "book" },
    checkpoint: { verb: "Quiz", icon: "quiz" },
    exercise: { verb: "Build", icon: "hammer" },
    order: { verb: "Sort", icon: "sort" },
    fill: { verb: "Fill", icon: "pencil" },
    hotspot: { verb: "Spot", icon: "target" },
    review: { verb: "Review", icon: "lens" },
    scenario: { verb: "Decide", icon: "fork" },
    calibration: { verb: "Judge", icon: "scales" },
    viva: { verb: "Defend", icon: "shield" },
    api: { verb: "Probe", icon: "plug" },
    sql: { verb: "Query", icon: "database" },
    terminal: { verb: "Command", icon: "prompt" },
    story: { verb: "Play", icon: "mask" },
  };

  const NARRATORS = {
    keeper: { name: "Orin the Archivist", src: "art/quest/keeper.webp" },
    sentinel: { name: "Captain Vey", src: "art/quest/sentinel.webp" },
    oracle: { name: "Cog", src: "art/quest/oracle.webp" },
    courier: { name: "Wren the Courier", src: "art/quest/courier.webp" },
    artificer: { name: "Tink", src: "art/quest/artificer.webp" },
    architect: { name: "Master Hale", src: "art/quest/architect.webp" },
    mentor: { name: "Mentor Ash", src: "art/quest/mentor.webp" },
    cartographer: { name: "Pip the Cartographer", src: "art/quest/cartographer.webp" },
  };

  const LINES = {
    reading: ["Settle in and read this one closely. The details come back later.", "A page from the archive. Read it, then mark it done."],
    checkpoint: ["A quick test of what you have learned. Choose carefully.", "Answer these to prove you were paying attention."],
    exercise: ["Time to build. Run the tests until every one passes.", "Roll up your sleeves. The tests will tell you when it works."],
    order: ["These steps are out of order. Put them right.", "Sequence matters here. Arrange the steps."],
    fill: ["Some words are missing. Fill the gaps.", "Complete the passage before you move on."],
    hotspot: ["Something here should not be public. Find it.", "Look closely and spot the targets."],
    review: ["One of these changes hides a problem. Find the lines.", "Review this change like a careful auditor."],
    scenario: ["A decision awaits. Every path has a cost.", "Choose your path and see where it leads."],
    calibration: ["Two answers, one stronger. Judge them.", "Weigh both answers and pick the better one."],
    viva: ["The examiners are waiting. Defend your choices.", "Answer out loud first, then write the short version."],
    api: ["Probe the endpoints and read what comes back.", "Send the requests. The responses tell the story."],
    sql: ["The answer is in the database. Write the query.", "Query the records to find what you need."],
    terminal: ["The terminal is yours. Diagnose the problem.", "Type your commands and find what broke."],
    story: ["A story unfolds. Your choices shape the ending.", "Step into the scene and choose what to say."],
  };

  const TITLES = ["Novice", "Apprentice", "Journeyman", "Adept", "Expert", "Master", "Sage", "Lorekeeper"];

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function mode() {
    return document.documentElement.dataset.theme === "study" ? "study" : "quest";
  }

  function kind(name) {
    return KINDS[name] || { verb: "Lesson", icon: "book" };
  }

  function icon(name, label = "") {
    const path = ICONS[name] || ICONS.book;
    const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="quest-icon" viewBox="0 0 20 20" ${aria} focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  function kindBadge(name) {
    const info = kind(name);
    return `${icon(info.icon)}<span>${info.verb}</span>`;
  }

  function hash(text) {
    let value = 2166136261;
    for (const char of String(text)) {
      value ^= char.charCodeAt(0);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function narratorFor(course) {
    const tags = new Set((course?.tags || []).map((tag) => String(tag).toLowerCase()));
    let id = "keeper";
    if (tags.has("security") || tags.has("audit") || tags.has("forensics") || tags.has("incident")) id = "sentinel";
    else if (tags.has("ai") || tags.has("llm")) id = "oracle";
    else if (tags.has("networking") || tags.has("networks")) id = "courier";
    else if (tags.has("programming") || tags.has("python") || tags.has("web")) id = "artificer";
    else if (tags.has("systems") || tags.has("analysis")) id = "architect";
    else if (tags.has("education") || tags.has("teaching")) id = "mentor";
    else if (tags.has("reference")) id = "cartographer";
    return { id, ...NARRATORS[id] };
  }

  function narratorLine(lesson) {
    const options = LINES[lesson?.kind] || LINES.reading;
    return options[hash(lesson?.id || "") % options.length];
  }

  function levelFor(xp) {
    let level = 1;
    while (50 * (level + 1) * level <= xp) level += 1;
    const floor = 50 * level * (level - 1);
    const next = 50 * (level + 1) * level;
    const into = xp - floor;
    const needed = next - floor;
    return {
      level,
      title: TITLES[Math.min(level - 1, TITLES.length - 1)],
      floor,
      next,
      into,
      needed,
      remaining: next - xp,
      percent: needed ? Math.max(0, Math.min(100, (into / needed) * 100)) : 0,
    };
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function streak(days) {
    const set = new Set(days || []);
    if (!set.size) return 0;
    const cursor = new Date();
    if (!set.has(dayKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!set.has(dayKey(cursor))) return 0;
    }
    let count = 0;
    while (set.has(dayKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function progressXp(value) {
    if (!value || typeof value !== "object") return 0;
    if (Number.isFinite(Number(value.xp))) return Number(value.xp);
    return Object.keys(value.completed || {}).length * 20;
  }

  function player() {
    const rows = window.LorekeeperPackStorage?.allProgress() || [];
    let xp = 0;
    const days = [];
    for (const row of rows) {
      xp += progressXp(row.value);
      days.push(...(Array.isArray(row.value?.activity) ? row.value.activity : []));
    }
    return { xp, streak: streak(days), ...levelFor(xp) };
  }

  function renderPlayerCard() {
    const host = document.getElementById("player-card");
    if (!host) return;
    const me = player();
    host.innerHTML = `
      <div class="player-crest" aria-hidden="true"><span>${me.level}</span></div>
      <div class="player-main">
        <div class="player-title"><strong>Level ${me.level}</strong> <span>${me.title}</span></div>
        <div class="player-bar" role="progressbar" aria-label="Progress to level ${me.level + 1}" aria-valuemin="0" aria-valuemax="${me.needed}" aria-valuenow="${me.into}">
          <span style="width:${me.percent.toFixed(1)}%"></span>
        </div>
        <div class="player-meta">
          <span>${me.remaining} XP to level ${me.level + 1}</span>
          <span class="player-streak">${me.streak ? `${me.streak}-day streak` : "Start a streak today"}</span>
        </div>
      </div>`;
  }

  /* Completion moments ---------------------------------------------- */

  const queue = [];
  let showing = false;

  function host() {
    let el = document.getElementById("moment");
    if (!el) {
      el = document.createElement("div");
      el.id = "moment";
      el.className = "moment";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }

  function next() {
    if (showing || !queue.length) return;
    showing = true;
    const item = queue.shift();
    const el = host();
    const portrait = item.portrait
      ? `<img class="moment-portrait" src="${esc(item.portrait)}" alt="" width="72" height="72">`
      : `<span class="moment-seal" aria-hidden="true">${icon(item.icon || "star")}</span>`;
    el.className = `moment moment-${item.type}`;
    el.innerHTML = `
      <div class="moment-card">
        ${portrait}
        <div class="moment-text">
          <p class="moment-kicker">${esc(item.kicker)}</p>
          <strong>${esc(item.title)}</strong>
          ${item.detail ? `<span>${esc(item.detail)}</span>` : ""}
        </div>
      </div>`;
    void el.offsetWidth;
    el.classList.add("show");
    const duration = item.type === "complete" ? 1500 : 2800;
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => {
        showing = false;
        next();
      }, 260);
    }, duration);
  }

  function moment(item) {
    queue.push(item);
    next();
  }

  window.LorekeeperQuest = {
    mode,
    kind,
    icon,
    kindBadge,
    narratorFor,
    narratorLine,
    levelFor,
    player,
    streak,
    renderPlayerCard,
    moment,
  };
})();
