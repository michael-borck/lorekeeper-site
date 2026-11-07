/* Theme-aware inline illustration for the course picker. */
(function () {
  const PIXEL = `
    <svg class="art art-pixel" viewBox="0 0 320 180" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
      <g class="twinkle" fill="var(--amber)">
        <rect x="38" y="30" width="4" height="4"/>
        <rect x="270" y="24" width="4" height="4"/>
        <rect x="240" y="60" width="3" height="3"/>
        <rect x="60" y="70" width="3" height="3"/>
      </g>
      <rect x="48" y="148" width="224" height="4" fill="var(--border-strong)"/>
      <rect x="70" y="118" width="180" height="6" fill="var(--panel-2)" stroke="var(--border-strong)" stroke-width="2"/>
      <rect x="78" y="124" width="6" height="24" fill="var(--panel-2)"/>
      <rect x="236" y="124" width="6" height="24" fill="var(--panel-2)"/>
      <rect x="106" y="46" width="108" height="68" fill="var(--panel-inset)" stroke="var(--accent)" stroke-width="3"/>
      <rect x="114" y="54" width="92" height="52" fill="var(--code-bg)"/>
      <rect x="122" y="64" width="52" height="4" fill="var(--accent)"/>
      <rect x="122" y="74" width="70" height="4" fill="var(--accent-strong)"/>
      <rect x="122" y="84" width="40" height="4" fill="var(--accent)"/>
      <rect x="122" y="94" width="60" height="4" fill="var(--accent-strong)"/>
      <rect x="150" y="114" width="20" height="5" fill="var(--border-strong)"/>
      <rect x="132" y="119" width="56" height="4" fill="var(--border-strong)"/>
      <rect x="66" y="102" width="30" height="18" fill="var(--amber)" stroke="var(--border-strong)" stroke-width="2"/>
      <rect x="70" y="106" width="22" height="2" fill="var(--bg)"/>
      <rect x="70" y="111" width="22" height="2" fill="var(--bg)"/>
      <rect x="232" y="106" width="18" height="16" fill="var(--panel-2)" stroke="var(--border-strong)" stroke-width="2"/>
      <path d="M250 110 h5 v8 h-5" fill="none" stroke="var(--border-strong)" stroke-width="2"/>
      <rect x="198" y="94" width="18" height="16" fill="var(--panel-2)" stroke="var(--accent)" stroke-width="2"/>
      <rect x="203" y="99" width="3" height="3" fill="var(--accent)"/>
      <rect x="209" y="99" width="3" height="3" fill="var(--accent)"/>
      <rect x="205" y="88" width="4" height="6" fill="var(--border-strong)"/>
      <rect x="203" y="84" width="8" height="4" fill="var(--amber)"/>
    </svg>`;

  const STORYBOOK = `
    <svg class="art art-storybook" viewBox="0 0 320 180" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="art-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0" stop-color="var(--amber)" stop-opacity=".30"/>
          <stop offset="1" stop-color="var(--amber)" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="160" cy="82" r="82" fill="url(#art-glow)"/>
      <g class="float">
        <rect x="52" y="132" width="216" height="12" rx="6" fill="var(--panel-2)" stroke="var(--border-strong)" stroke-width="2"/>
        <path d="M105 96 q28 -12 55 0 q27 -12 55 0 v30 q-28 -10 -55 2 q-27 -12 -55 -2 z" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
        <path d="M160 96 v32" stroke="var(--border-strong)" stroke-width="2"/>
        <path d="M120 105 q18 -6 32 0 M120 113 q18 -6 32 0 M168 105 q18 -6 32 0 M168 113 q18 -6 32 0" fill="none" stroke="var(--dim)" stroke-width="2" stroke-linecap="round"/>
        <rect x="232" y="106" width="22" height="20" rx="5" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
        <path d="M254 111 q10 2 0 10" fill="none" stroke="var(--border-strong)" stroke-width="2"/>
        <path class="steam" d="M238 100 q-4 -8 2 -14 M246 100 q-4 -8 2 -14" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"/>
        <rect x="66" y="92" width="4" height="40" fill="var(--border-strong)"/>
        <path d="M46 92 h44 l-8 -20 h-28 z" fill="var(--amber)" opacity=".9"/>
        <circle cx="68" cy="70" r="8" fill="var(--amber)" opacity=".35"/>
        <path d="M278 132 q-14 -18 -2 -30 q10 10 2 30 M278 132 q14 -16 4 -28 q-12 8 -4 28" fill="var(--accent)" opacity=".8"/>
        <rect x="272" y="126" width="16" height="10" rx="3" fill="var(--panel-2)" stroke="var(--border-strong)" stroke-width="2"/>
      </g>
      <g fill="var(--amber)" class="twinkle">
        <circle cx="42" cy="42" r="2.5"/>
        <circle cx="284" cy="52" r="2"/>
        <circle cx="250" cy="28" r="1.6"/>
      </g>
    </svg>`;

  const INK = `
    <svg class="art art-ink" viewBox="0 0 320 180" aria-hidden="true" focusable="false">
      <circle cx="160" cy="86" r="58" fill="none" stroke="var(--border-strong)" stroke-width="2"/>
      <path d="M112 106 q48 -16 96 0 v28 q-48 -12 -96 0 z" fill="var(--panel)" stroke="var(--border-strong)" stroke-width="2"/>
      <path d="M160 106 v28" stroke="var(--border-strong)" stroke-width="2"/>
      <path d="M126 114 q18 -4 28 0 M126 120 q18 -4 28 0 M166 114 q18 -4 28 0 M166 120 q18 -4 28 0" fill="none" stroke="var(--dim)" stroke-width="2" stroke-linecap="round"/>
      <g fill="var(--accent)" class="twinkle">
        <path d="M92 52 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z"/>
        <path d="M238 70 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z"/>
      </g>
    </svg>`;


  const EMBLEMS = {
    "ship-it": `
      <svg class="emblem" data-course="ship-it" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect x="7" y="8" width="50" height="34" rx="3" fill="var(--panel)" stroke="var(--accent)" stroke-width="2"/>
        <rect x="7" y="8" width="50" height="8" rx="3" fill="var(--panel-2)"/>
        <circle cx="12" cy="12" r="1.5" fill="var(--red)"/>
        <circle cx="17" cy="12" r="1.5" fill="var(--amber)"/>
        <circle cx="22" cy="12" r="1.5" fill="var(--accent)"/>
        <rect x="13" y="22" width="22" height="3" fill="var(--text-soft)"/>
        <rect x="13" y="28" width="16" height="3" fill="var(--muted)"/>
        <rect x="13" y="34" width="20" height="3" fill="var(--muted)"/>
        <rect x="40" y="42" width="12" height="10" rx="2" fill="var(--amber)" opacity=".9"/>
        <path d="M52 45 h3 v5 h-3" fill="none" stroke="var(--amber)" stroke-width="2"/>
        <path d="M50 16 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="var(--amber)"/>
        <rect x="13" y="47" width="36" height="3" rx="1.5" fill="var(--border-strong)"/>
      </svg>`,
    "signal-and-noise": `
      <svg class="emblem" data-course="signal-and-noise" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d="M32 32 L14 17 M32 32 L50 17 M32 32 L46 50 M32 32 L18 50" stroke="var(--accent-border)" stroke-width="2"/>
        <circle cx="32" cy="32" r="7" fill="var(--accent-strong)" stroke="var(--accent)" stroke-width="2"/>
        <circle cx="14" cy="17" r="4" fill="var(--panel)" stroke="var(--blue)" stroke-width="2"/>
        <circle cx="50" cy="17" r="4" fill="var(--panel)" stroke="var(--blue)" stroke-width="2"/>
        <circle cx="46" cy="50" r="4" fill="var(--panel)" stroke="var(--amber)" stroke-width="2"/>
        <circle cx="18" cy="50" r="4" fill="var(--panel)" stroke="var(--amber)" stroke-width="2"/>
        <path d="M22 32 h-7 M16 29 h-3 v6 h3" fill="none" stroke="var(--accent)" stroke-width="2"/>
        <path d="M42 32 h7 M48 29 h3 v6 h-3" fill="none" stroke="var(--accent)" stroke-width="2"/>
        <path d="M32 22 v4 M32 38 v4" stroke="var(--accent)" stroke-width="2"/>
      </svg>`,
    "field-kit": `
      <svg class="emblem" data-course="field-kit" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect x="10" y="24" width="44" height="28" rx="3" fill="var(--panel)" stroke="var(--accent)" stroke-width="2"/>
        <path d="M24 24 v-4 a4 4 0 0 1 4 -4 h8 a4 4 0 0 1 4 4 v4" fill="none" stroke="var(--accent)" stroke-width="2"/>
        <rect x="10" y="34" width="44" height="3" fill="var(--panel-2)"/>
        <circle cx="32" cy="44" r="6" fill="none" stroke="var(--amber)" stroke-width="2"/>
        <path d="M32 40 l2 7 -2 -2 -2 2 z" fill="var(--amber)"/>
        <path d="M50 13 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="var(--accent)"/>
      </svg>`,
    default: `
      <svg class="emblem" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d="M12 20 q20 -8 40 0 v24 q-20 -8 -40 0 z" fill="var(--panel)" stroke="var(--accent)" stroke-width="2"/>
        <path d="M32 20 v24" stroke="var(--accent)" stroke-width="2"/>
        <path d="M18 28 q10 -3 12 0 M18 34 q10 -3 12 0 M34 28 q10 -3 12 0 M34 34 q10 -3 12 0" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
  };

  const PACK_ART = {
    "pocket-incidents": ["cybersecurity", "crisis"],
    "information-security": ["cybersecurity", "advisor"],
    "audit-and-control": ["business", "judgement"],
    "assume-breach": ["cybersecurity", "crisis"],
    "speak-software": ["cyberpunk", "advisor"],
    "build-web-guide-ai": ["cyberpunk", "chain"],
    "systems-analysis-and-design": ["business", "judgement"],
    "follow-the-trace": ["noir", "chain"],
    "the-human-edge": ["business", "advisor"],
    "test-the-claim": ["business", "judgement"],
    "substantiate-dont-assume": ["business", "advisor"],
    "conversation-not-delegation": ["university", "advisor"],
    "prove-dont-persuade": ["business", "gamble"],
    "build-ai-understand-ai": ["cyberpunk", "chain"],
    "break-with-permission": ["cybersecurity", "crisis"],
    "follow-the-packet": ["cyberpunk", "chain"],
    "simplebot": ["cyberpunk", "opportunity"],
    "build-it-teach-it": ["university", "advisor"],
    "think-python-direct-ai": ["science", "advisor"],
    "code-python-consult-ai": ["science", "petitioner"],
    "ship-python-orchestrate-ai": ["cyberpunk", "chain"],
    "converse-python-partner-ai": ["cyberpunk", "advisor"],
    "partner-dont-police": ["university", "advisor"],
    "the-absolute-minimum-you-must-know": ["base", "advisor"],
    "the-great-silence": ["space", "crisis"],
    "programming-paradigms": ["cyberpunk", "judgement"],
    "simulate-it": ["science", "gamble"],
    "ai-toys": ["cyberpunk", "opportunity"],
    "security-toys": ["cybersecurity", "advisor"],
    "netsim-field-guide": ["cyberpunk", "chain"],
  };

  function courseArt(course) {
    if (!course) return null;
    if (course.artSet && course.artScene) {
      return { set: course.artSet, scene: course.artScene };
    }
    const mapped = PACK_ART[course.slug];
    if (mapped) return { set: mapped[0], scene: mapped[1] };
    const tags = new Set((course.tags || []).map((tag) => String(tag).toLowerCase()));
    if (tags.has("security") || tags.has("audit")) return { set: "cybersecurity", scene: "crisis" };
    if (tags.has("ai") || tags.has("llm")) return { set: "cyberpunk", scene: "advisor" };
    if (tags.has("networking") || tags.has("networks")) return { set: "cyberpunk", scene: "chain" };
    if (tags.has("python") || tags.has("programming")) return { set: "science", scene: "petitioner" };
    if (tags.has("education") || tags.has("teaching")) return { set: "university", scene: "advisor" };
    if (tags.has("systems") || tags.has("analysis")) return { set: "business", scene: "judgement" };
    return { set: "base", scene: "advisor" };
  }

  function courseCoverUrl(course) {
    const art = courseArt(course);
    if (!art) return "";
    return `../store/art/${encodeURIComponent(art.set)}/${encodeURIComponent(art.scene)}.webp`;
  }

  window.LorekeeperArt = {
    picker() {
      return `<div class="picker-art" aria-hidden="true">${PIXEL}${STORYBOOK}${INK}</div>`;
    },
    skinName(theme) {
      return { pixel: "Pixel", storybook: "Storybook", ink: "Ink" }[theme] || "Ink";
    },
    courseEmblem(slug) {
      return EMBLEMS[slug] || EMBLEMS.default;
    },
    courseCoverUrl,
  };
})();
