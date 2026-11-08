/* Local pack library. Packs are inert course JSON stored on this device. */
(function () {
  const MAX_CHARS = 4_500_000;
  const SLUG = /^[a-z0-9][a-z0-9-]*$/;
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  const LESSON_KINDS = new Set([
    "reading", "checkpoint", "exercise", "order", "fill", "hotspot", "review",
    "scenario", "calibration", "viva", "api", "sql", "terminal", "story",
  ]);
  const BLOCK_TYPES = new Set([
    "html", "checkpoint", "exercise", "order", "fill", "hotspot", "review",
    "scenario", "calibration", "viva", "api", "sql", "terminal", "story",
  ]);
  const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);

  function fail(message) {
    throw new Error(message);
  }

  function validCourse(course, slug) {
    if (!course || typeof course !== "object") fail("A course is missing.");
    if (!course.unit || course.unit.slug !== slug) fail(`Course "${slug}" has the wrong unit slug.`);
    if (!Array.isArray(course.modules)) fail(`Course "${slug}" has no modules.`);
    for (const module of course.modules) {
      if (!module || typeof module !== "object") fail(`Course "${slug}" has an invalid module.`);
      module.number = Number(module.number);
      if (!Number.isFinite(module.number)) fail(`Course "${slug}" has a module without a number.`);
      module.title = String(module.title || "");
      module.slug = String(module.slug || "");
      if (!Array.isArray(module.lessons)) fail(`Course "${slug}" has a module without lessons.`);
      for (const lesson of module.lessons) {
        if (!lesson || typeof lesson !== "object") fail(`Course "${slug}" has an invalid lesson.`);
        lesson.id = String(lesson.id || "");
        if (!ID.test(lesson.id)) fail(`Course "${slug}" has an invalid lesson id.`);
        lesson.title = String(lesson.title || "");
        lesson.kind = String(lesson.kind || "reading");
        if (!LESSON_KINDS.has(lesson.kind)) fail(`Course "${slug}" has an unknown lesson kind.`);
        if (lesson.narration !== undefined) lesson.narration = String(lesson.narration).slice(0, 400);
        lesson.xp = Number(lesson.xp);
        if (!Number.isFinite(lesson.xp) || lesson.xp < 0) lesson.xp = 0;
        if (!Array.isArray(lesson.blocks)) fail(`Course "${slug}" has a lesson without blocks.`);
        for (const block of lesson.blocks) {
          if (!block || typeof block !== "object") fail(`Course "${slug}" has an invalid block.`);
          block.type = String(block.type || "");
          if (!BLOCK_TYPES.has(block.type)) fail(`Course "${slug}" has an unknown block type.`);
          if (block.id !== undefined) block.id = String(block.id);
          if (block.viewport && typeof block.viewport === "object") {
            block.viewport.width = Number(block.viewport.width) || 1024;
            block.viewport.height = Number(block.viewport.height) || 768;
          }
          if (block.tests !== undefined && !Array.isArray(block.tests)) {
            fail(`Course "${slug}" has malformed exercise tests.`);
          }
        }
      }
    }
  }

  function validatePack(data) {
    if (!data || data.format !== "lorekeeper.pack" || Number(data.version) !== 1) {
      fail("This is not a Lorekeeper pack.");
    }
    if (!SLUG.test(String(data.id || ""))) fail("The pack id is invalid.");
    if (!Array.isArray(data.courses) || !data.courses.length) fail("The pack has no courses.");

    const clean = {
      format: "lorekeeper.pack",
      version: 1,
      id: String(data.id),
      title: String(data.title || data.id),
      author: String(data.author || ""),
      licence: String(data.licence || ""),
      createdAt: String(data.createdAt || ""),
      courses: [],
    };

    for (const raw of data.courses) {
      if (!raw || typeof raw !== "object") fail("A course entry is invalid.");
      const slug = String(raw.slug || "");
      if (!SLUG.test(slug) || DANGEROUS.has(slug)) fail(`Invalid course slug "${slug}".`);
      if (!raw.course || typeof raw.course !== "object") fail(`Course "${slug}" is missing.`);
      validCourse(raw.course, slug);
      if (!raw.stories || typeof raw.stories !== "object") fail(`Course "${slug}" has no story map.`);

      const stories = {};
      for (const [src, story] of Object.entries(raw.stories)) {
        if (!story || typeof story !== "object" || !story.inkVersion || !story.root) {
          fail(`Story "${src}" is not compiled Ink JSON.`);
        }
        stories[src] = story;
      }

      const previousAssetResolve = window.LorekeeperAssetResolve;
      window.LorekeeperAssetResolve = false;
      try {
        for (const module of raw.course.modules) {
          for (const lesson of module.lessons) {
            for (const block of lesson.blocks || []) {
              if (block.type === "html" && typeof block.html === "string") {
                block.html = window.LorekeeperSanitize?.html(block.html) || "";
              }
              if (typeof block.prompt === "string") {
                block.prompt = window.LorekeeperSanitize?.html(block.prompt) || "";
              }
              if (block.type === "story" && !stories[block.src]) {
                fail(`Course "${slug}" is missing the story "${block.src}".`);
              }
            }
          }
        }
      } finally {
        window.LorekeeperAssetResolve = previousAssetResolve;
      }

      const assets = {};
      if (raw.assets && typeof raw.assets === "object") {
        for (const [name, value] of Object.entries(raw.assets)) {
          if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) continue;
          if (typeof value !== "string" || !/^data:image\//i.test(value)) continue;
          assets[name] = value;
        }
      }

      clean.courses.push({
        slug,
        title: String(raw.title || raw.course.unit.title || slug),
        theme: String(raw.theme || raw.course.unit.theme || "ink"),
        level: String(raw.level || raw.course.unit.level || "beginner"),
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        artSet: String(raw.artSet || ""),
        artScene: String(raw.artScene || ""),
        narrator: /^[a-z]{2,20}$/.test(String(raw.narrator || raw.course.unit.narrator || ""))
          ? String(raw.narrator || raw.course.unit.narrator)
          : "",
        pitch: String(raw.pitch || raw.course.unit.pitch || ""),
        start: String(raw.start || raw.course.unit.start || ""),
        course: raw.course,
        stories,
        assets,
      });
    }
    return clean;
  }

  function sizeOf(pack) {
    return JSON.stringify(pack).length;
  }

  async function ready() {
    await window.LorekeeperPackStorage?.ready();
  }

  function getPack(id) {
    const raw = window.LorekeeperPackStorage?.getPack(id);
    if (!raw) return null;
    try {
      return validatePack(raw);
    } catch {
      return null;
    }
  }

  function packs() {
    return (window.LorekeeperPackStorage?.allPacks() || [])
      .map((raw) => {
        try {
          return validatePack(raw);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  function courses() {
    return packs().flatMap((pack) =>
      pack.courses.map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        theme: entry.theme,
        tags: entry.tags,
        level: entry.level,
        artSet: entry.artSet,
        artScene: entry.artScene,
        narrator: entry.narrator,
        pitch: entry.pitch,
        start: entry.start,
        modules: entry.course.modules.length,
        lessons: entry.course.modules.reduce((sum, module) => sum + module.lessons.length, 0),
        assets: entry.assets || {},
        source: "local",
        packId: pack.id,
      }))
    );
  }

  function course(slug) {
    for (const pack of packs()) {
      const entry = pack.courses.find((item) => item.slug === slug);
      if (entry) {
        return {
          packId: pack.id,
          course: entry.course,
          stories: entry.stories,
          assets: entry.assets || {},
        };
      }
    }
    return null;
  }

  function story(slug, src) {
    return course(slug)?.stories?.[src] || null;
  }

  async function store(data, reservedSlugs = []) {
    const pack = validatePack(data);
    if (sizeOf(pack) > MAX_CHARS) fail("This pack is too large for browser storage.");
    const existing = getPack(pack.id);
    const ownSlugs = new Set((existing?.courses || []).map((entry) => entry.slug));
    const reserved = new Set(reservedSlugs);
    const conflict = pack.courses.find(
      (entry) => reserved.has(entry.slug) && !ownSlugs.has(entry.slug)
    );
    if (conflict) {
      fail(`"${conflict.slug}" is already a built-in course. Pack course slugs must be unique.`);
    }
    try {
      await window.LorekeeperPackStorage.putPack(pack);
    } catch (error) {
      fail(error?.message || "The pack could not be saved.");
    }
    return pack;
  }

  async function parseFile(file) {
    if (!file) fail("Choose a pack file.");
    if (file.size > MAX_CHARS) fail("This pack is too large for browser storage.");
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      fail("The pack is not valid JSON.");
    }
    return validatePack(data);
  }

  async function removePack(id) {
    const pack = getPack(id);
    if (!pack) return null;
    await window.LorekeeperPackStorage.deletePack(id);
    for (const entry of pack.courses) {
      await window.LorekeeperPackStorage.deleteProgress(entry.slug);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`lorekeeper:sql:${entry.slug}:`) || key.startsWith(`lorekeeper:code:${entry.slug}:`)) {
          localStorage.removeItem(key);
        }
      }
    }
    try {
      const path = JSON.parse(localStorage.getItem("lorekeeper:path") || "null");
      const slugs = new Set(pack.courses.map((entry) => entry.slug));
      if (path && slugs.has(path.course)) localStorage.removeItem("lorekeeper:path");
    } catch {
      /* ignore */
    }
    return pack;
  }

  window.LorekeeperLibrary = {
    ready,
    validatePack,
    parseFile,
    store,
    packs,
    courses,
    course,
    story,
    removePack,
    getPack,
  };
})();
