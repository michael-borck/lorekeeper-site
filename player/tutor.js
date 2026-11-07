/* Optional local-first AI tutor. Off by default; the key is session-only. */
(function () {
  const SETTINGS_KEY = "lorekeeper:tutor";
  const KEY_KEY = "lorekeeper:tutor:key";
  const STYLES = {
    socratic: "Socratic tutor. Ask one useful question at a time; do not give the full answer immediately.",
    coach: "Practical coach. Give a small next step, a hint, and a check the learner can perform.",
    examiner: "Examiner. Ask a short question, wait for an answer, then give precise feedback.",
    concise: "Concise tutor. Answer briefly, in plain language, with one concrete example.",
    colleague: "Patient colleague. Explain plainly, use an analogy, and check understanding.",
  };
  let bound = false;
  let chat = [];

  const $ = (id) => document.getElementById(id);

  function defaults() {
    return {
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
      style: "socratic",
      scope: "lesson",
    };
  }

  function settings() {
    try {
      return { ...defaults(), ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {}) };
    } catch {
      return defaults();
    }
  }

  function saveSettings(next) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function apiKey() {
    try {
      return sessionStorage.getItem(KEY_KEY) || "";
    } catch {
      return "";
    }
  }

  function setApiKey(value) {
    try {
      if (value) sessionStorage.setItem(KEY_KEY, value);
      else sessionStorage.removeItem(KEY_KEY);
    } catch {
      /* ignore */
    }
  }

  function currentLesson() {
    if (!state.course) return null;
    return state.course.modules
      .flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })))
      .find((entry) => entry.lesson.id === state.currentId) || null;
  }

  function lessonText(entry) {
    if (!entry) return "";
    const parts = [`Course: ${state.course.unit.title}`, `Lesson: ${entry.lesson.title}`];
    for (const block of entry.lesson.blocks || []) {
      if (block.type === "html") parts.push(String(block.html || "").replace(/<[^>]+>/g, " "));
      if (block.type === "checkpoint") {
        for (const question of block.questions || []) {
          parts.push(question.prompt);
          parts.push((question.options || []).join(" / "));
        }
      }
      if (block.type === "scenario") parts.push(block.prompt || "");
    }
    return parts.join("\n").slice(0, 8000);
  }

  function courseText() {
    if (!state.course) return "";
    const lessons = state.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.title));
    return `Course: ${state.course.unit.title}\nLessons: ${lessons.join("; ")}`.slice(0, 8000);
  }

  function systemPrompt(config) {
    return `You are a ${STYLES[config.style] || STYLES.socratic}
Use the lesson context supplied. Help the learner understand it.
Do not complete assessed work for them. Ask before giving a full answer.
If the answer is not in the context, say so and suggest what to check.
Keep replies short enough to read on screen.`;
  }

  function messagesFor(config, question) {
    const entry = currentLesson();
    const context = config.scope === "course" ? courseText() : lessonText(entry);
    const last = chat[chat.length - 1];
    const history = last?.role === "user" && last.content === question ? chat.slice(-8, -1) : chat.slice(-8);
    return [
      { role: "system", content: systemPrompt(config) },
      { role: "user", content: `Lesson context:\n${context}` },
      ...history,
      { role: "user", content: question },
    ];
  }

  async function ask(question) {
    const config = settings();
    const key = apiKey();
    if (!config.baseUrl || !config.model) throw new Error("Set the tutor provider and model first.");
    const base = config.baseUrl.replace(/\/$/, "");
    let url;
    let body;
    const headers = { "Content-Type": "application/json" };
    if (config.provider === "ollama") {
      url = base.endsWith("/api/chat") ? base : `${base}/api/chat`;
      body = { model: config.model, messages: messagesFor(config, question), stream: false };
    } else {
      url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
      if (!key) throw new Error("This provider needs an API key. Add it for this tab.");
      headers.Authorization = `Bearer ${key}`;
      body = { model: config.model, messages: messagesFor(config, question), temperature: 0.4 };
    }
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Tutor request failed (${response.status}).`);
    const data = await response.json();
    return config.provider === "ollama"
      ? String(data.message?.content || data.response || "").trim()
      : String(data.choices?.[0]?.message?.content || "").trim();
  }

  function render() {
    const body = $("tutor-body");
    if (!body) return;
    const config = settings();
    body.innerHTML = `
      <details class="tutor-settings" ${config.baseUrl ? "" : "open"}>
        <summary>Provider settings</summary>
        <div class="tutor-grid">
          <label>Provider
            <select id="tutor-provider">
              <option value="ollama" ${config.provider === "ollama" ? "selected" : ""}>Local Ollama</option>
              <option value="openai" ${config.provider === "openai" ? "selected" : ""}>OpenAI-compatible</option>
            </select>
          </label>
          <label>Base URL
            <input id="tutor-url" value="${escapeHtml(config.baseUrl)}" placeholder="http://localhost:11434">
          </label>
          <label>Model
            <input id="tutor-model" value="${escapeHtml(config.model)}" placeholder="llama3.2">
          </label>
          <label>API key (this tab only)
            <input id="tutor-key" type="password" value="${escapeHtml(apiKey())}" autocomplete="off">
          </label>
          <label>Style
            <select id="tutor-style">
              ${Object.keys(STYLES).map((key) => `<option value="${key}" ${config.style === key ? "selected" : ""}>${key[0].toUpperCase() + key.slice(1)}</option>`).join("")}
            </select>
          </label>
          <label>Context
            <select id="tutor-scope">
              <option value="lesson" ${config.scope === "lesson" ? "selected" : ""}>This lesson</option>
              <option value="course" ${config.scope === "course" ? "selected" : ""}>This course outline</option>
            </select>
          </label>
        </div>
        <div class="toolbar">
          <button class="btn primary" type="button" data-tutor-save>Save settings</button>
          <button class="btn" type="button" data-tutor-test>Test connection</button>
        </div>
        <p class="widget-note" id="tutor-status">Nothing is sent until you press Send. The key is kept for this tab only.</p>
      </details>
      <div class="tutor-chat" id="tutor-chat">
        ${chat.length ? chat.map((message) => `<div class="tutor-message ${message.role}">${escapeHtml(message.content)}</div>`).join("") : '<p class="widget-note">Ask about the current lesson. The tutor can explain, quiz or review your answer.</p>'}
      </div>
      <div class="tutor-compose">
        <textarea id="tutor-input" rows="2" placeholder="Ask about this lesson..."></textarea>
        <button class="btn primary" type="button" data-tutor-send>Send</button>
        <button class="btn" type="button" data-tutor-clear>Clear</button>
      </div>`;
    bindBody();
  }

  function status(message, bad = false) {
    const el = $("tutor-status");
    if (!el) return;
    el.textContent = message;
    el.className = `widget-note ${bad ? "bad" : "ok"}`;
  }

  function bindBody() {
    $("tutor-save")?.addEventListener("click", () => {
      saveSettings({
        provider: $("tutor-provider").value,
        baseUrl: $("tutor-url").value.trim(),
        model: $("tutor-model").value.trim(),
        style: $("tutor-style").value,
        scope: $("tutor-scope").value,
      });
      setApiKey($("tutor-key").value);
      status("Settings saved on this device.");
    });
    $("tutor-test")?.addEventListener("click", async () => {
      status("Testing...");
      try {
        const answer = await ask("Reply with the single word: ready.");
        status(answer ? `Connected. ${answer.slice(0, 80)}` : "Connected, but no reply.");
      } catch (error) {
        status(error.message || "Connection failed.", true);
      }
    });
    $("tutor-send")?.addEventListener("click", send);
    $("tutor-input")?.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") send();
    });
    $("tutor-clear")?.addEventListener("click", () => {
      chat = [];
      render();
    });
  }

  async function send() {
    const input = $("tutor-input");
    const question = input?.value.trim();
    if (!question) return;
    chat.push({ role: "user", content: question });
    input.value = "";
    render();
    status("Thinking...");
    try {
      const answer = await ask(question);
      chat.push({ role: "assistant", content: answer || "No answer returned." });
      render();
      status("Answer received. Check it against the lesson.");
    } catch (error) {
      chat.push({ role: "assistant", content: `Tutor error: ${error.message || error}` });
      render();
      status(error.message || "Tutor request failed.", true);
    }
  }

  function open() {
    render();
    const dialog = $("tutor-dialog");
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function attach() {
    const footer = document.querySelector(".lesson-footer");
    if (!footer || footer.querySelector("[data-tutor-open]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.dataset.tutorOpen = "";
    button.textContent = "Ask tutor";
    footer.insertBefore(button, footer.querySelector("[data-next]"));
  }

  function bind() {
    if (bound) return;
    const dialog = $("tutor-dialog");
    const close = $("tutor-close");
    if (!dialog || !close) return;
    bound = true;
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-tutor-open]")) {
        event.preventDefault();
        open();
      }
    });
  }

  window.LorekeeperTutor = { open, attach };
  bind();
})();
