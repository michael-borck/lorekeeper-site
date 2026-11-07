/* Local learning journey: course status, recent lessons and next suggestions. */
(function () {
  let bound = false;
  const $ = (id) => document.getElementById(id);

  function progressFor(slug) {
    try {
      const raw = localStorage.getItem(`lorekeeper:progress:${slug}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function courses() {
    return state.index?.courses || [];
  }

  function statusFor(course) {
    const progress = progressFor(course.slug) || {};
    const done = Object.keys(progress.completed || {}).length;
    const total = course.lessons || 0;
    const badges = Array.isArray(progress.badges) ? progress.badges.length : 0;
    const history = Array.isArray(progress.history) ? progress.history : [];
    let status = "Not started";
    if (total && done >= total) status = "Completed";
    else if (done > 0) status = "In progress";
    return { course, done, total, badges, history, status, percent: total ? (done / total) * 100 : 0 };
  }

  function allStatuses() {
    return courses().map(statusFor);
  }

  function recommend(statuses) {
    const active = statuses
      .filter((item) => item.done > 0 && item.done < item.total)
      .sort((a, b) => b.percent - a.percent);
    if (active.length) return active[0];
    const completed = statuses.filter((item) => item.status === "Completed");
    const tags = new Set(completed.flatMap((item) => item.course.tags || []));
    const unstarted = statuses
      .filter((item) => item.done === 0)
      .map((item) => ({
        item,
        score: (item.course.tags || []).filter((tag) => tags.has(tag)).length,
      }))
      .sort((a, b) => b.score - a.score || a.item.course.title.localeCompare(b.item.course.title));
    return unstarted[0]?.item || statuses.find((item) => item.status !== "Completed") || null;
  }

  function recent(statuses) {
    return statuses
      .flatMap((item) => item.history.map((entry) => ({ ...entry, course: item.course })))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 8);
  }

  function render() {
    const body = $("journey-body");
    if (!body) return;
    const statuses = allStatuses();
    if (!statuses.length) {
      body.innerHTML = '<p class="widget-note">No courses are installed. Add a pack to start a journey.</p>';
      return;
    }
    const doneLessons = statuses.reduce((sum, item) => sum + item.done, 0);
    const completedCourses = statuses.filter((item) => item.status === "Completed").length;
    const badges = statuses.reduce((sum, item) => sum + item.badges, 0);
    const next = recommend(statuses);
    const activity = recent(statuses);
    body.innerHTML = `
      <div class="journey-stats">
        <div><strong>${doneLessons}</strong><span>lessons complete</span></div>
        <div><strong>${completedCourses}</strong><span>courses complete</span></div>
        <div><strong>${badges}</strong><span>achievements</span></div>
        <div><strong>${statuses.length}</strong><span>courses in library</span></div>
      </div>
      ${
        next
          ? `<div class="journey-next">
              <p class="eyebrow">${next.status === "In progress" ? "Continue" : "Suggested next"}</p>
              <strong>${escapeHtml(next.course.title)}</strong>
              <p class="widget-note">${next.done}/${next.total} lessons · ${escapeHtml(next.course.pitch || "")}</p>
              <button class="btn primary" type="button" data-journey-course="${escapeHtml(next.course.slug)}">Open course</button>
            </div>`
          : ""
      }
      <h3 class="journey-heading">Your courses</h3>
      <div class="journey-list">
        ${statuses
          .map(
            (item) => `
          <button class="journey-course" type="button" data-journey-course="${escapeHtml(item.course.slug)}">
            <span class="journey-course-main">
              <strong>${escapeHtml(item.course.title)}</strong>
              <span>${item.status} · ${item.done}/${item.total} lessons</span>
            </span>
            <span class="journey-ring" style="--pct:${item.percent}%"><span>${Math.round(item.percent)}%</span></span>
          </button>`
          )
          .join("")}
      </div>
      <h3 class="journey-heading">Recent activity</h3>
      ${
        activity.length
          ? `<ol class="journey-activity">${activity
              .map(
                (entry) => `<li><span>${escapeHtml(entry.title || "Lesson")}</span><small>${escapeHtml(entry.courseTitle || entry.title || "")} · ${new Date(entry.at).toLocaleDateString()}</small></li>`
              )
              .join("")}</ol>`
          : '<p class="widget-note">Complete a lesson and it will appear here.</p>'
      }`;
  }

  function open() {
    render();
    const dialog = $("journey-dialog");
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function bind() {
    if (bound) return;
    const dialog = $("journey-dialog");
    const close = $("journey-close");
    if (!dialog || !close) return;
    bound = true;
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-journey-open]")) {
        event.preventDefault();
        open();
        return;
      }
      const course = event.target.closest("[data-journey-course]");
      if (course) {
        event.preventDefault();
        location.href = `?course=${encodeURIComponent(course.dataset.journeyCourse)}`;
      }
    });
  }

  window.LorekeeperJourney = { open, render };
  bind();
})();
