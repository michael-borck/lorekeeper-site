/* Lorekeeper achievements. Loaded before app.js. */
(function () {
  const BADGES = [
    {
      id: "first-step",
      title: "First Step",
      icon: "1",
      description: "Complete your first lesson.",
      test: (ctx) => ctx.done >= 1,
      progress: (ctx) => `${Math.min(ctx.done, 1)}/1`,
    },
    {
      id: "quick-study",
      title: "Quick Study",
      icon: "?",
      description: "Pass a checkpoint.",
      test: (ctx) => ctx.kindCount.checkpoint >= 1,
      progress: (ctx) => `${Math.min(ctx.kindCount.checkpoint || 0, 1)}/1`,
    },
    {
      id: "hands-on",
      title: "Hands On",
      icon: "</>",
      description: "Pass a practical exercise.",
      test: (ctx) => ctx.kindCount.exercise >= 1,
      progress: (ctx) => `${Math.min(ctx.kindCount.exercise || 0, 1)}/1`,
    },
    {
      id: "choose-path",
      title: "Choose Your Path",
      icon: "¶",
      description: "Finish an interactive story.",
      test: (ctx) => ctx.kindCount.story >= 1,
      progress: (ctx) => `${Math.min(ctx.kindCount.story || 0, 1)}/1`,
    },
    {
      id: "explorer",
      title: "Explorer",
      icon: "5",
      description: "Complete lessons in five different formats.",
      test: (ctx) => ctx.kinds.size >= 5,
      progress: (ctx) => `${Math.min(ctx.kinds.size, 5)}/5`,
    },
    {
      id: "toolsmith",
      title: "Toolsmith",
      icon: "10",
      description: "Complete lessons in ten different formats.",
      test: (ctx) => ctx.kinds.size >= 10,
      progress: (ctx) => `${Math.min(ctx.kinds.size, 10)}/10`,
    },
    {
      id: "chapter-clear",
      title: "Chapter Clear",
      icon: "C",
      description: "Complete every lesson in a chapter.",
      test: (ctx) => ctx.modulesComplete >= 1,
      progress: (ctx) => `${Math.min(ctx.modulesComplete, 1)}/1`,
    },
    {
      id: "course-complete",
      title: "Course Complete",
      icon: "★",
      description: "Complete every lesson in the course.",
      test: (ctx) => ctx.total > 0 && ctx.done === ctx.total,
      progress: (ctx) => `${ctx.done}/${ctx.total}`,
    },
    {
      id: "xp-100",
      title: "Apprentice",
      icon: "100",
      description: "Earn 100 XP.",
      test: (ctx) => ctx.xp >= 100,
      progress: (ctx) => `${Math.min(ctx.xp, 100)}/100`,
    },
    {
      id: "xp-500",
      title: "Journeyman",
      icon: "500",
      description: "Earn 500 XP.",
      test: (ctx) => ctx.xp >= 500,
      progress: (ctx) => `${Math.min(ctx.xp, 500)}/500`,
    },
    {
      id: "streak-3",
      title: "Three Days Running",
      icon: "3d",
      description: "Complete something on three days in a row.",
      test: (ctx) => ctx.streak >= 3,
      progress: (ctx) => `${Math.min(ctx.streak, 3)}/3`,
    },
    {
      id: "streak-7",
      title: "Seven Days Running",
      icon: "7d",
      description: "Complete something on seven days in a row.",
      test: (ctx) => ctx.streak >= 7,
      progress: (ctx) => `${Math.min(ctx.streak, 7)}/7`,
    },
  ];

  let bound = false;

  function dayKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function currentStreak(days) {
    const set = new Set((days || []).filter(Boolean));
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

  function context() {
    const modules = state.course ? state.course.modules : [];
    const lessons = modules.flatMap((module) => module.lessons);
    const completed = state.progress.completed || {};
    const doneLessons = lessons.filter((lesson) => completed[lesson.id]);
    const kindCount = {};
    doneLessons.forEach((lesson) => {
      kindCount[lesson.kind] = (kindCount[lesson.kind] || 0) + 1;
    });
    const kinds = new Set(doneLessons.map((lesson) => lesson.kind));
    const modulesComplete = modules.filter(
      (module) => module.lessons.length && module.lessons.every((lesson) => completed[lesson.id])
    ).length;
    return {
      lessons,
      done: doneLessons.length,
      total: lessons.length,
      doneLessons,
      kindCount,
      kinds,
      modulesComplete,
      xp: doneLessons.reduce((sum, lesson) => sum + (lesson.xp || 0), 0),
      streak: currentStreak(state.progress.activity),
    };
  }

  function evaluate() {
    const ctx = context();
    return BADGES.map((badge) => ({
      ...badge,
      earned: Boolean(badge.test(ctx)),
      progress: badge.progress(ctx),
    }));
  }

  function updateCount() {
    const count = document.getElementById("badge-count");
    if (!count) return;
    const earned = evaluate().filter((badge) => badge.earned).length;
    count.textContent = `${earned}/${BADGES.length}`;
  }

  function render() {
    const list = document.getElementById("badge-list");
    const summary = document.getElementById("badge-summary");
    if (!list || !summary) return;
    const badges = evaluate();
    const ctx = context();
    const earned = badges.filter((badge) => badge.earned).length;
    summary.textContent = `${earned} of ${badges.length} earned · ${ctx.done}/${ctx.total} lessons · ${ctx.xp} XP · ${ctx.streak} day streak`;
    list.replaceChildren();
    badges.forEach((badge) => {
      const card = document.createElement("div");
      card.className = `badge-card ${badge.earned ? "earned" : "locked"}`;
      card.dataset.badge = badge.id;
      const icon = document.createElement("div");
      icon.className = "badge-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = badge.icon;
      const body = document.createElement("div");
      body.className = "badge-body";
      const title = document.createElement("strong");
      title.textContent = badge.title;
      const description = document.createElement("p");
      description.textContent = badge.description;
      const progress = document.createElement("span");
      progress.className = "badge-progress";
      progress.textContent = badge.earned ? "Earned" : badge.progress;
      body.append(title, description, progress);
      card.append(icon, body);
      list.appendChild(card);
    });
    updateCount();
  }

  function sync(announce = false) {
    if (!state.course) return [];
    if (!Array.isArray(state.progress.activity)) state.progress.activity = [];
    if (!Array.isArray(state.progress.badges)) state.progress.badges = [];

    const earned = evaluate().filter((badge) => badge.earned);
    const known = new Set(state.progress.badges);
    const fresh = earned.filter((badge) => !known.has(badge.id));

    if (fresh.length || !state.progress.badges.length) {
      state.progress.badges = [...new Set([...state.progress.badges, ...fresh.map((badge) => badge.id)])];
      saveProgress();
    }

    if (announce && fresh.length) {
      window.LorekeeperSound?.play("badge");
      fresh.forEach((badge) => {
        if (typeof toast === "function") toast(`Achievement: ${badge.title}`);
      });
    }

    updateCount();
    render();
    return fresh;
  }

  function record() {
    if (!Array.isArray(state.progress.activity)) state.progress.activity = [];
    const today = dayKey(new Date());
    if (!state.progress.activity.includes(today)) state.progress.activity.push(today);
  }

  function reset() {
    state.progress.activity = [];
    state.progress.badges = [];
    saveProgress();
    sync(false);
  }

  function bind() {
    if (bound) return;
    const button = document.getElementById("badges-button");
    const dialog = document.getElementById("badge-dialog");
    const close = document.getElementById("badges-close");
    if (!button || !dialog || !close) return;
    bound = true;
    button.addEventListener("click", () => {
      render();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  function init() {
    bind();
    sync(false);
  }

  window.LorekeeperBadges = { init, record, sync, reset, render, evaluate };
})();
