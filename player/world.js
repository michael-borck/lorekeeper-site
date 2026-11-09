/* World map: every course is a place in a narrator's region; your trail is a route. */
(function () {
  const CATALOG_URL = new URL("../store/catalog.json", location.href);
  const UNEXPLORED_KEY = "lorekeeper:world-unexplored";

  // Positions are percentages of player/art/quest/world.webp, placed on land
  // near the matching landmark. Each region is one narrator's home.
  const REGIONS = {
    sentinel: {
      name: "The Northern Ramparts",
      label: [66, 9],
      slots: [[60, 25], [68, 22], [75, 27], [57, 33], [64, 34], [71, 35], [78, 35], [83, 24], [53, 24], [86, 31]],
    },
    oracle: {
      name: "The Clockwork Heights",
      label: [84, 44],
      slots: [[78, 49], [86, 52], [90, 58], [75, 57], [82, 63], [88, 65], [71, 49], [93, 47], [77, 69]],
    },
    artificer: {
      name: "Tinker's Vale",
      label: [24, 40],
      slots: [[22, 49], [30, 47], [17, 56], [26, 58], [34, 56], [14, 46], [21, 66], [30, 66], [38, 48]],
    },
    courier: {
      name: "The Harbour Reach",
      label: [17, 89],
      slots: [[16, 78], [25, 80], [10, 70], [33, 82]],
    },
    architect: {
      name: "Hale's Keep",
      label: [41, 21],
      slots: [[44, 31], [38, 38], [50, 36], [36, 28]],
    },
    mentor: {
      name: "Ashwood",
      label: [57, 82],
      slots: [[52, 69], [60, 74], [46, 75], [66, 67]],
    },
    cartographer: {
      name: "The Far Shore",
      label: [84, 84],
      slots: [[79, 75], [86, 71], [72, 80]],
    },
    keeper: {
      name: "The Archive",
      label: [57, 46],
      slots: [[57, 55], [50, 61], [64, 59]],
    },
  };
  const REGION_ORDER = ["keeper", "sentinel", "oracle", "artificer", "architect", "courier", "mentor", "cartographer"];

  let catalogCache = null;
  let bound = false;
  const $ = (id) => document.getElementById(id);

  async function catalog() {
    if (catalogCache) return catalogCache;
    try {
      const response = await fetch(CATALOG_URL, { cache: "no-store" });
      const data = response.ok ? await response.json() : null;
      catalogCache = Array.isArray(data?.packs) ? data.packs : [];
    } catch {
      catalogCache = [];
    }
    return catalogCache;
  }

  function regionId(course) {
    const quest = window.LorekeeperQuest;
    const id = quest ? quest.topicNarrator(course) : "keeper";
    return REGIONS[id] ? id : "keeper";
  }

  function region(course) {
    const id = regionId(course);
    return { id, ...REGIONS[id] };
  }

  function shortTitle(title) {
    const text = String(title || "");
    const colon = text.indexOf(":");
    return colon > 0 ? text.slice(0, colon) : text;
  }

  /* Installed courses, hidden built-ins and store packs not yet installed. */
  async function places() {
    const visible = state.index?.courses || [];
    const all = state.index?.allCourses || visible;
    const visibleSlugs = new Set(visible.map((course) => course.slug));
    const allSlugs = new Set(all.map((course) => course.slug));
    const packs = await catalog();
    return [
      ...visible.map((course) => ({ ...course, status: "installed" })),
      ...all.filter((course) => !visibleSlugs.has(course.slug)).map((course) => ({ ...course, status: "hidden" })),
      ...packs
        .filter((pack) => !allSlugs.has(pack.id))
        .map((pack) => ({
          slug: pack.id,
          title: pack.title,
          tags: pack.tags || [],
          level: pack.level || "beginner",
          pitch: pack.description || "",
          lessons: pack.lessons || 0,
          modules: 0,
          narrator: pack.narrator || "",
          artSet: pack.artSet,
          artScene: pack.artScene,
          status: "store",
          packId: pack.id,
        })),
    ];
  }

  function layout(list) {
    const byRegion = new Map();
    for (const course of list) {
      const id = regionId(course);
      if (!byRegion.has(id)) byRegion.set(id, []);
      byRegion.get(id).push(course);
    }
    const placed = [];
    for (const [id, courses] of byRegion) {
      const info = REGIONS[id];
      courses.sort(
        (a, b) =>
          (a.status === "installed" ? 0 : 1) - (b.status === "installed" ? 0 : 1) ||
          String(a.title).localeCompare(String(b.title))
      );
      courses.forEach((course, index) => {
        let [x, y] = info.slots[index] || [];
        if (x === undefined) {
          const [cx, cy] = info.slots[0];
          const angle = index * 2.4;
          const radius = 5 + (index - info.slots.length) * 1.5;
          x = Math.min(96, Math.max(4, cx + Math.cos(angle) * radius));
          y = Math.min(94, Math.max(6, cy + Math.sin(angle) * radius * 1.4));
        }
        placed.push({ course, region: id, x, y, slot: index });
      });
    }
    return placed;
  }

  function progressFor(course) {
    const progress = window.LorekeeperPackStorage?.getProgress(course.slug) || {};
    const done = Object.keys(progress.completed || {}).length;
    const total = Number(course.lessons) || 0;
    return { done, total };
  }

  function statusText(course) {
    if (course.status === "store") return "Unexplored · in the pack store";
    if (course.status === "hidden") return "Unexplored · built in, not in your library";
    const { done, total } = progressFor(course);
    if (!done) return `Not started · ${total} lessons`;
    if (total && done >= total) return "Completed";
    return `${done} of ${total} lessons`;
  }

  function actionAttrs(course) {
    if (course.status === "installed") return `href="?course=${encodeURIComponent(course.slug)}"`;
    if (course.status === "hidden") return `href="#" data-world-add="${escapeHtml(course.slug)}"`;
    return `href="#" data-world-store="${escapeHtml(course.title)}"`;
  }

  function actionText(course) {
    if (course.status === "installed") return "Open course";
    if (course.status === "hidden") return "Add to library";
    return "Find in the pack store";
  }

  function emblem(course) {
    return window.LorekeeperArt ? window.LorekeeperArt.courseEmblem(course.slug, course) : "";
  }

  function trailInfo() {
    const trail = window.LorekeeperWayfinder?.trailState?.();
    const order = new Map();
    (trail?.stops || []).forEach((stop, index) => order.set(stop.slug, { index, stop }));
    return { trail, order };
  }

  function markerHtml(item, order) {
    const { course, x, y } = item;
    const onTrail = order.get(course.slug);
    const classes = ["world-marker", course.status === "installed" ? "known" : "unexplored"];
    if (onTrail) classes.push("on-trail");
    if (onTrail?.stop.current) classes.push("trail-current");
    if (onTrail?.stop.done) classes.push("trail-done");
    if (x < 22) classes.push("edge-left");
    if (x > 78) classes.push("edge-right");
    if (y < 30) classes.push("edge-top");
    if (item.slot % 2 === 1) classes.push("label-above");
    const regionName = REGIONS[item.region].name;
    const label = `${course.title}. ${regionName}. ${statusText(course)}${onTrail ? `. Trail stop ${onTrail.index + 1}` : ""}`;
    return `
      <a class="${classes.join(" ")}" ${actionAttrs(course)} style="left:${x}%;top:${y}%" aria-label="${escapeHtml(label)}">
        <span class="world-pin" aria-hidden="true">${emblem(course)}${onTrail ? `<span class="world-step">${onTrail.index + 1}</span>` : ""}</span>
        ${course.status === "installed" ? `<span class="world-label" aria-hidden="true">${escapeHtml(shortTitle(course.title))}</span>` : ""}
        <span class="world-tip" aria-hidden="true">
          <small>${escapeHtml(regionName)}</small>
          <strong>${escapeHtml(course.title)}</strong>
          <span>${escapeHtml(statusText(course))}</span>
          <em>${escapeHtml(actionText(course))}</em>
        </span>
      </a>`;
  }

  function routeHtml(placed, trail) {
    if (!trail?.stops?.length) return "";
    const points = trail.stops
      .map((stop) => placed.find((item) => item.course.slug === stop.slug))
      .filter(Boolean)
      .map((item) => `${item.x},${item.y}`);
    if (points.length < 2) return "";
    return `
      <svg class="world-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <polyline class="world-route-shadow" points="${points.join(" ")}"></polyline>
        <polyline class="world-route-line" points="${points.join(" ")}"></polyline>
      </svg>`;
  }

  function listHtml(placed, order, showUnexplored) {
    return REGION_ORDER.filter((id) => placed.some((item) => item.region === id))
      .map((id) => {
        const guide = window.LorekeeperQuest?.narrators().find((item) => item.id === id);
        const items = placed.filter(
          (item) => item.region === id && (showUnexplored || item.course.status === "installed" || order.has(item.course.slug))
        );
        if (!items.length) return "";
        return `
          <section class="world-region">
            <h3>${escapeHtml(REGIONS[id].name)}${guide ? ` <small>${escapeHtml(guide.name)}</small>` : ""}</h3>
            <ul>
              ${items
                .map((item) => {
                  const stop = order.get(item.course.slug);
                  return `
                <li class="${item.course.status === "installed" ? "known" : "unexplored"}">
                  <a ${actionAttrs(item.course)}>
                    <span class="world-list-pin" aria-hidden="true">${emblem(item.course)}</span>
                    <span><strong>${escapeHtml(item.course.title)}</strong><small>${escapeHtml(statusText(item.course))}${stop ? ` · Trail stop ${stop.index + 1}` : ""}</small></span>
                  </a>
                </li>`;
                })
                .join("")}
            </ul>
          </section>`;
      })
      .join("");
  }

  function showUnexploredSetting() {
    try {
      return localStorage.getItem(UNEXPLORED_KEY) !== "off";
    } catch {
      return true;
    }
  }

  async function render(host) {
    if (!host) return;
    const list = await places();
    const placed = layout(list);
    const { trail, order } = trailInfo();
    const showUnexplored = showUnexploredSetting();
    const installed = list.filter((course) => course.status === "installed").length;
    const unexplored = list.length - installed;
    const visible = placed.filter(
      (item) => showUnexplored || item.course.status === "installed" || order.has(item.course.slug)
    );
    host.innerHTML = `
      <div class="world-head">
        <div>
          <p class="eyebrow">World map</p>
          <h1>The realm of Lorekeeper</h1>
          <p>${installed} course${installed === 1 ? "" : "s"} in your library · ${unexplored} unexplored${
            trail ? ` · Your trail: ${trail.doneCount} of ${trail.stops.length} stops` : ""
          }</p>
        </div>
        <div class="world-tools">
          <label class="world-toggle"><input type="checkbox" data-world-unexplored ${showUnexplored ? "checked" : ""}> Show unexplored</label>
          <button class="btn" type="button" data-wayfinder-open>${trail ? "Change trail" : "Find my trail"}</button>
        </div>
      </div>
      <div class="world-stage">
        <img class="world-art" src="art/quest/world.webp" alt="A parchment map of a fantasy realm with mountains, forests, a river and a coast" width="1216" height="832">
        ${routeHtml(placed, trail)}
        ${REGION_ORDER.map((id) => {
          const [x, y] = REGIONS[id].label;
          return `<span class="world-region-label" style="left:${x}%;top:${y}%" aria-hidden="true">${escapeHtml(REGIONS[id].name)}</span>`;
        }).join("")}
        ${visible.map((item) => markerHtml(item, order)).join("")}
      </div>
      <div class="world-legend" aria-hidden="true">
        <span><i class="legend-known"></i> In your library</span>
        <span><i class="legend-unexplored"></i> Unexplored</span>
        <span><i class="legend-trail"></i> Your trail</span>
      </div>
      <div class="world-list">${listHtml(placed, order, showUnexplored)}</div>`;
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", async (event) => {
      const add = event.target.closest("[data-world-add]");
      if (add) {
        event.preventDefault();
        const slug = add.dataset.worldAdd;
        const hidden = new Set(window.LorekeeperPackStorage?.getSetting("hidden-courses", []) || []);
        hidden.delete(slug);
        await window.LorekeeperPackStorage?.setSetting("hidden-courses", [...hidden]);
        location.href = `?course=${encodeURIComponent(slug)}`;
        return;
      }
      const store = event.target.closest("[data-world-store]");
      if (store) {
        event.preventDefault();
        window.LorekeeperStore?.open({ query: store.dataset.worldStore });
      }
    });
    document.addEventListener("change", (event) => {
      const toggle = event.target.closest("[data-world-unexplored]");
      if (!toggle) return;
      try {
        localStorage.setItem(UNEXPLORED_KEY, toggle.checked ? "on" : "off");
      } catch {
        /* session only */
      }
      render(toggle.closest(".content"));
    });
  }

  bind();
  window.LorekeeperWorld = { render, region, regionId, shortTitle, catalog, places, REGIONS };
})();
