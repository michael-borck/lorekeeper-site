/* Lorekeeper interactive widgets. Loaded before app.js. */
(function () {
  const W = {};

  function shell(host, block) {
    const wrap = document.createElement("div");
    wrap.className = "widget";
    if (block.prompt) {
      const prompt = document.createElement("div");
      prompt.className = "lesson-prose";
      prompt.innerHTML = block.prompt;
      wrap.appendChild(prompt);
    }
    host.appendChild(wrap);
    return wrap;
  }

  function prose(html, className = "lesson-prose") {
    const div = document.createElement("div");
    div.className = className;
    div.innerHTML = html || "";
    return div;
  }

  function button(label, className = "btn") {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = label;
    return el;
  }

  function note(className = "widget-note") {
    const el = document.createElement("div");
    el.className = className;
    return el;
  }

  function finish(lesson) {
    if (lesson) completeLesson(lesson, { quiet: true });
  }

  function hashSeed(text) {
    let hash = 2166136261;
    for (const char of String(text)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function shuffle(items, seed) {
    const result = items.slice();
    let value = seed || 1;
    for (let index = result.length - 1; index > 0; index -= 1) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const target = value % (index + 1);
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function cleanAnswer(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  /* Order ------------------------------------------------------------- */

  W.order = function (host, block, lesson) {
    const wrap = shell(host, block);
    const correct = block.items.slice();
    let items = shuffle(correct, hashSeed(lesson.id));
    if (items.join("|") === correct.join("|") && items.length > 1) {
      items = items.slice(1).concat(items[0]);
    }

    const list = document.createElement("ol");
    list.className = "order-list";
    const feedback = note();
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const check = button("Check order", "btn primary");
    toolbar.appendChild(check);

    let done = false;
    function paint() {
      list.replaceChildren();
      items.forEach((item, index) => {
        const row = document.createElement("li");
        row.className = "order-item";
        const label = document.createElement("span");
        label.className = "order-label";
        label.textContent = item;
        const controls = document.createElement("span");
        controls.className = "order-controls";
        const up = button("↑", "ghost-btn");
        up.setAttribute("aria-label", "Move up");
        up.disabled = done || index === 0;
        up.addEventListener("click", () => move(index, -1));
        const down = button("↓", "ghost-btn");
        down.setAttribute("aria-label", "Move down");
        down.disabled = done || index === items.length - 1;
        down.addEventListener("click", () => move(index, 1));
        controls.append(up, down);
        row.append(label, controls);
        list.appendChild(row);
      });
    }
    function move(index, delta) {
      if (done) return;
      const target = index + delta;
      if (target < 0 || target >= items.length) return;
      [items[index], items[target]] = [items[target], items[index]];
      paint();
    }

    check.addEventListener("click", () => {
      const ok = items.every((item, index) => item === correct[index]);
      if (ok) {
        done = true;
        feedback.className = "widget-note ok";
        feedback.textContent = "Correct. The order is safe.";
        if (block.explanation) {
          const explanation = prose(block.explanation, "lesson-prose widget-explanation");
          wrap.appendChild(explanation);
        }
        check.disabled = true;
        paint();
        finish(lesson);
      } else {
        const firstWrong = items.findIndex((item, index) => item !== correct[index]);
        feedback.className = "widget-note bad";
        feedback.textContent =
          firstWrong >= 0
            ? `Not yet. Check the item in position ${firstWrong + 1}.`
            : "Not yet.";
      }
    });

    wrap.append(list, toolbar, feedback);
    paint();
  };

  /* Fill -------------------------------------------------------------- */

  W.fill = function (host, block, lesson) {
    const wrap = shell(host, block);
    const passage = document.createElement("div");
    passage.className = "fill-passage";
    const escaped = escapeHtml(block.passage);
    passage.innerHTML = escaped.replace(/\[\[(\d+)\]\]/g, (_, number) => {
      const blank = block.blanks[Number(number) - 1] || { answers: [] };
      const hint = blank.hint ? ` title="${escapeHtml(blank.hint)}"` : "";
      return `<input class="fill-input" data-blank="${number}" aria-label="Blank ${number}" autocomplete="off"${hint}>`;
    });
    wrap.appendChild(passage);

    const inputs = [...passage.querySelectorAll(".fill-input")];
    inputs.forEach((input) => {
      const blank = block.blanks[Number(input.dataset.blank) - 1];
      const width = Math.max(8, Math.min(46, (blank?.answers?.[0] || "").length + 2));
      input.style.width = `${width}ch`;
    });

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const check = button("Check blanks", "btn primary");
    toolbar.appendChild(check);
    const feedback = note();
    let done = false;

    check.addEventListener("click", () => {
      let all = true;
      inputs.forEach((input) => {
        const blank = block.blanks[Number(input.dataset.blank) - 1];
        const value = cleanAnswer(input.value);
        const ok = (blank?.answers || []).some((answer) => cleanAnswer(answer) === value);
        input.classList.toggle("ok", ok);
        input.classList.toggle("bad", !ok);
        if (!ok) all = false;
      });
      if (all) {
        done = true;
        feedback.className = "widget-note ok";
        feedback.textContent = "All blanks are correct.";
        inputs.forEach((input) => (input.disabled = true));
        finish(lesson);
      } else {
        feedback.className = "widget-note bad";
        feedback.textContent = "Not yet. Check the highlighted blanks. Hover a blank for a hint.";
      }
    });

    wrap.append(toolbar, feedback);
  };

  /* Hotspot ----------------------------------------------------------- */

  W.hotspot = function (host, block, lesson) {
    const wrap = shell(host, block);
    const board = document.createElement("div");
    board.className = "hotspot-board";
    board.innerHTML = block.markup;
    wrap.appendChild(board);

    const feedback = note();
    const found = new Set();
    const targets = block.targets
      .map((target) => ({ ...target, element: board.querySelector(target.selector) }))
      .filter((target) => target.element);

    function addFeedback(label, html, ok) {
      const item = document.createElement("div");
      item.className = `hotspot-feedback ${ok ? "ok" : "bad"}`;
      item.innerHTML = `<strong>${escapeHtml(label)}</strong> ${html || ""}`;
      feedback.appendChild(item);
    }

    targets.forEach((target) => {
      target.element.classList.add("hotspot-target");
      target.element.addEventListener("click", (event) => {
        event.stopPropagation();
        if (found.has(target.selector)) return;
        found.add(target.selector);
        target.element.classList.add("found");
        addFeedback(target.label, target.feedback, true);
        if (found.size === targets.length) {
          feedback.className = "widget-note ok";
          finish(lesson);
        }
      });
    });

    board.addEventListener("click", (event) => {
      if (!targets.some((target) => target.element.contains(event.target))) {
        addFeedback("Not this one", "This is not one of the exposed things.", false);
      }
    });

    wrap.appendChild(feedback);
    if (!targets.length) {
      feedback.className = "widget-note bad";
      feedback.textContent = "No hotspot targets could be found in the markup.";
    }
  };

  /* Review ------------------------------------------------------------ */

  W.review = function (host, block, lesson) {
    const wrap = shell(host, block);
    const list = document.createElement("div");
    list.className = "review-lines";
    const selected = new Set();
    let done = false;

    block.lines.forEach((line, index) => {
      const row = button("", `review-line ${line.kind}`);
      row.innerHTML = `<span class="ln">${index + 1}</span><code>${escapeHtml(line.code)}</code>`;
      row.addEventListener("click", () => {
        if (done) return;
        if (selected.has(index)) {
          selected.delete(index);
          row.classList.remove("selected");
        } else {
          selected.add(index);
          row.classList.add("selected");
        }
      });
      list.appendChild(row);
    });

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const check = button("Check lines", "btn primary");
    toolbar.appendChild(check);
    const feedback = note();
    wrap.append(list, toolbar, feedback);

    check.addEventListener("click", () => {
      const bad = block.lines
        .map((line, index) => (line.bad ? index : -1))
        .filter((index) => index >= 0);
      const ok = bad.length === selected.size && bad.every((index) => selected.has(index));
      if (!ok) {
        feedback.className = "widget-note bad";
        feedback.textContent = `Not yet. You selected ${selected.size} line${selected.size === 1 ? "" : "s"}.`;
        return;
      }
      done = true;
      feedback.className = "widget-note ok";
      feedback.textContent = "Correct. These lines hid the problem.";
      list.querySelectorAll(".review-line").forEach((row, index) => {
        row.disabled = true;
        if (block.lines[index].bad) {
          row.classList.add("bad-line");
          if (block.lines[index].feedback) {
            const why = document.createElement("div");
            why.className = "review-why";
            why.innerHTML = block.lines[index].feedback;
            row.after(why);
          }
        }
      });
      if (block.explanation) wrap.appendChild(prose(block.explanation, "lesson-prose widget-explanation"));
      finish(lesson);
    });
  };

  /* Scenario ---------------------------------------------------------- */

  W.scenario = function (host, block, lesson) {
    const wrap = shell(host, block);
    const grid = document.createElement("div");
    grid.className = "scenario-grid";
    const result = document.createElement("div");
    result.className = "scenario-result";
    const debrief = block.debrief ? prose(block.debrief, "lesson-prose widget-explanation") : null;
    let chosen = false;

    block.options.forEach((option) => {
      const card = button("", "scenario-option");
      card.dataset.recommended = option.recommended ? "true" : "false";
      card.innerHTML = `<span class="scenario-label">${escapeHtml(option.label)}</span><span class="scenario-hint">Choose this path</span>`;
      card.addEventListener("click", () => {
        if (chosen) return;
        chosen = true;
        grid.querySelectorAll(".scenario-option").forEach((el) => (el.disabled = true));
        card.classList.add(option.recommended ? "recommended" : "chosen");
        const effects = Object.entries(option.effects || {})
          .map(
            ([key, value]) =>
              `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`
          )
          .join("");
        result.innerHTML = `
          <div class="scenario-outcome lesson-prose">${option.outcome || ""}</div>
          ${effects ? `<table class="effects-table"><tbody>${effects}</tbody></table>` : ""}
          ${option.feedback ? `<div class="widget-note ${option.recommended ? "ok" : "bad"}">${option.feedback}</div>` : ""}
          ${!option.recommended ? `<div class="widget-note">The recommended path is marked after you choose.</div>` : ""}`;
        grid.querySelectorAll(".scenario-option").forEach((el) => {
          if (el.dataset.recommended === "true") el.classList.add("recommended");
        });
        if (debrief) result.appendChild(debrief);
        finish(lesson);
      });
      grid.appendChild(card);
    });

    wrap.append(grid, result);
  };

  /* Calibration ------------------------------------------------------- */

  W.calibration = function (host, block, lesson) {
    const wrap = shell(host, block);
    const grid = document.createElement("div");
    grid.className = "calibration-grid";
    const name = `calibration-${lesson.id}`;

    ["a", "b"].forEach((key) => {
      const option = block.options[key];
      const card = document.createElement("label");
      card.className = "calibration-option";
      card.innerHTML = `
        <input type="radio" name="${escapeHtml(name)}" value="${key}">
        <span class="calibration-title">${escapeHtml(option.title)}</span>
        <div class="lesson-prose">${option.body}</div>`;
      grid.appendChild(card);
    });

    const whyLabel = document.createElement("label");
    whyLabel.className = "field-label";
    whyLabel.textContent = "Why is it stronger?";
    const why = document.createElement("textarea");
    why.className = "code short";
    why.placeholder = "One or two sentences.";

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const reveal = button("Reveal the expert view", "btn primary");
    reveal.disabled = true;
    toolbar.appendChild(reveal);

    const result = document.createElement("div");
    result.className = "calibration-result";
    let done = false;

    grid.addEventListener("change", () => {
      reveal.disabled = done || !grid.querySelector("input:checked");
    });

    reveal.addEventListener("click", () => {
      if (done) return;
      done = true;
      const choice = grid.querySelector("input:checked")?.value;
      const correct = choice === block.better;
      result.innerHTML = `
        <div class="widget-note ${correct ? "ok" : "bad"}">
          ${correct ? "You chose the stronger critique." : `The stronger critique is ${escapeHtml(block.options[block.better].title)}.`}
        </div>
        <div class="lesson-prose">${block.rationale || ""}</div>`;
      reveal.disabled = true;
      why.disabled = true;
      finish(lesson);
    });

    wrap.append(grid, whyLabel, why, toolbar, result);
  };

  /* Viva -------------------------------------------------------------- */

  W.viva = function (host, block, lesson) {
    const wrap = shell(host, block);
    if (block.context) wrap.appendChild(prose(block.context));
    const stage = document.createElement("div");
    stage.className = "viva-stage";
    wrap.appendChild(stage);
    let index = 0;
    const answers = [];

    function renderSummary() {
      stage.innerHTML = "";
      const heading = document.createElement("h3");
      heading.textContent = "Viva complete";
      const intro = document.createElement("p");
      intro.className = "widget-note";
      intro.textContent = "This is self-assessment. Use the rubric to decide what to practise next.";
      const rubric = document.createElement("div");
      rubric.className = "viva-rubric";
      (block.rubric || []).forEach((item, itemIndex) => {
        const label = document.createElement("label");
        label.className = "viva-rubric-item";
        label.innerHTML = `<input type="checkbox" data-rubric="${itemIndex}"> <span>${escapeHtml(item)}</span>`;
        rubric.appendChild(label);
      });
      const finishButton = button("Finish viva", "btn primary");
      finishButton.addEventListener("click", () => {
        finishButton.disabled = true;
        finish(lesson);
      });
      stage.append(heading, intro, rubric, finishButton);
    }

    function renderQuestion() {
      stage.innerHTML = "";
      const question = block.questions[index];
      const heading = document.createElement("h3");
      heading.textContent = `Question ${index + 1} of ${block.questions.length}`;
      const prompt = document.createElement("p");
      prompt.className = "viva-question";
      prompt.textContent = question.prompt;
      const answer = document.createElement("textarea");
      answer.className = "code short";
      answer.placeholder = "Answer out loud first, then type the short version.";
      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      const compare = button("Compare with a strong answer", "btn primary");
      const next = button("Next question");
      next.disabled = true;
      toolbar.append(compare, next);
      const result = document.createElement("div");
      result.className = "viva-result";
      let compared = false;

      compare.addEventListener("click", () => {
        const text = answer.value.trim();
        const matched = [];
        const missing = [];
        (question.signals || []).forEach((signal) => {
          let hit = false;
          try {
            hit = new RegExp(signal.pattern, "i").test(text);
          } catch {
            hit = false;
          }
          (hit ? matched : missing).push(signal.label);
        });
        compared = true;
        next.disabled = false;
        result.innerHTML = `
          <div class="viva-signals">
            <div class="widget-note ${missing.length ? "bad" : "ok"}">
              ${missing.length ? `Try adding: ${missing.map(escapeHtml).join(", ")}.` : "Your answer covers the signals."}
            </div>
            ${matched.length ? `<div class="signal-list ok">${matched.map((label) => `<span>✓ ${escapeHtml(label)}</span>`).join("")}</div>` : ""}
            ${missing.length ? `<div class="signal-list bad">${missing.map((label) => `<span>○ ${escapeHtml(label)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="lesson-prose viva-strong"><h4>A strong answer includes</h4>${question.strong_answer || ""}</div>
          ${question.follow_up ? `<div class="lesson-prose viva-follow"><h4>Follow-up</h4>${question.follow_up}</div>` : ""}`;
        if (text.split(/\s+/).filter(Boolean).length < 12) {
          result.insertAdjacentHTML(
            "afterbegin",
            '<div class="widget-note bad">Your answer is short. A viva answer usually names the choice, the reason and the trade-off.</div>'
          );
        }
      });

      next.addEventListener("click", () => {
        if (!compared) return;
        answers.push(answer.value.trim());
        index += 1;
        if (index >= block.questions.length) renderSummary();
        else renderQuestion();
      });

      stage.append(heading, prompt, answer, toolbar, result);
      answer.focus();
    }

    renderQuestion();
  };

  /* API --------------------------------------------------------------- */

  W.api = function (host, block, lesson) {
    const wrap = shell(host, block);
    const controls = document.createElement("div");
    controls.className = "api-controls";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Endpoint");
    block.endpoints.forEach((endpoint, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${endpoint.method} ${endpoint.path}`;
      select.appendChild(option);
    });
    const send = button("Send request", "btn primary");
    controls.append(select, send);
    const response = document.createElement("div");
    response.className = "api-response";
    response.innerHTML = '<div class="widget-note">Choose an endpoint and send the request.</div>';
    const questions = document.createElement("div");
    questions.className = "api-questions";
    questions.hidden = true;
    let renderedQuestions = false;

    send.addEventListener("click", () => {
      const endpoint = block.endpoints[Number(select.value)] || block.endpoints[0];
      const ok = endpoint.status >= 200 && endpoint.status < 300;
      response.innerHTML = `
        <div class="api-status">
          <span class="method">${escapeHtml(endpoint.method)}</span>
          <code>${escapeHtml(endpoint.path)}</code>
          <span class="${ok ? "ok" : "bad"}">${endpoint.status}</span>
        </div>
        <pre class="api-json">${escapeHtml(JSON.stringify(endpoint.body, null, 2))}</pre>`;
      questions.hidden = false;
      if (!renderedQuestions) {
        renderedQuestions = true;
        renderCheckpoint(questions, { questions: block.questions }, lesson);
      }
    });

    wrap.append(controls, response, questions);
  };

  /* SQL --------------------------------------------------------------- */

  let sqlLoader = null;
  function loadSqlJs() {
    if (window.initSqlJs) return Promise.resolve(window.initSqlJs);
    if (!sqlLoader) {
      sqlLoader = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "vendor/sql-wasm.js";
        script.onload = () => resolve(window.initSqlJs);
        script.onerror = () => reject(new Error("Could not load the SQL engine."));
        document.head.appendChild(script);
      });
    }
    return sqlLoader;
  }

  function firstResult(results) {
    if (!results.length) return { columns: [], values: [] };
    return { columns: results[0].columns, values: results[0].values };
  }

  function resultTable(result) {
    const table = document.createElement("table");
    table.className = "result-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    result.columns.forEach((column) => {
      const th = document.createElement("th");
      th.textContent = column;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    const tbody = document.createElement("tbody");
    result.values.slice(0, 100).forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value === null ? "NULL" : String(value);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    return table;
  }

  W.sql = function (host, block, lesson) {
    const wrap = shell(host, block);
    if (block.task) wrap.appendChild(prose(block.task));
    const editor = document.createElement("textarea");
    editor.className = "code short sql-editor";
    editor.placeholder = "SELECT ...";
    const storageKey = `lorekeeper:sql:${state.course.unit.slug}:${lesson.id}`;
    try {
      editor.value = localStorage.getItem(storageKey) || "SELECT * FROM menu_items;\n";
    } catch {
      editor.value = "SELECT * FROM menu_items;\n";
    }
    editor.addEventListener("input", () => {
      try {
        localStorage.setItem(storageKey, editor.value);
      } catch {
        /* ignore */
      }
    });

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const run = button("Run query", "btn primary");
    run.disabled = true;
    const reset = button("Reset database");
    toolbar.append(run, reset);
    const status = note("widget-note");
    status.textContent = "Loading the SQL engine...";
    const output = document.createElement("div");
    output.className = "sql-output";

    let db = null;
    let SQLCtor = null;
    let expected = null;

    (async () => {
      try {
        const initSqlJs = await loadSqlJs();
        SQLCtor = await initSqlJs({
          locateFile: (file) => new URL(`vendor/${file}`, location.href).href,
        });
        db = new SQLCtor.Database();
        db.run(block.schema);
        if (block.seed) db.run(block.seed);
        expected = firstResult(db.exec(block.solution));
        status.className = "widget-note";
        status.textContent = "Ready. Run a query and compare the result.";
        run.disabled = false;
      } catch (error) {
        status.className = "widget-note bad";
        status.textContent = error.message || "The SQL engine could not start.";
      }
    })();

    run.addEventListener("click", () => {
      if (!db) return;
      output.replaceChildren();
      try {
        const actual = firstResult(db.exec(editor.value));
        output.appendChild(resultTable(actual));
        const same = JSON.stringify(actual) === JSON.stringify(expected);
        if (same) {
          status.className = "widget-note ok";
          status.textContent = "The result matches the task.";
          finish(lesson);
        } else {
          status.className = "widget-note bad";
          status.textContent = `Not the expected result yet. ${actual.values.length} row${actual.values.length === 1 ? "" : "s"} returned.`;
        }
      } catch (error) {
        status.className = "widget-note bad";
        status.textContent = `SQL error: ${error.message}`;
      }
    });

    reset.addEventListener("click", () => {
      if (!SQLCtor) return;
      try {
        if (db) db.close();
        db = new SQLCtor.Database();
        db.run(block.schema);
        if (block.seed) db.run(block.seed);
        expected = firstResult(db.exec(block.solution));
        output.replaceChildren();
        status.className = "widget-note";
        status.textContent = "Database reset. Run a query.";
        run.disabled = false;
      } catch (error) {
        status.className = "widget-note bad";
        status.textContent = `Reset failed: ${error.message}`;
      }
    });

    wrap.append(editor, toolbar, status, output);
  };

  /* Story ------------------------------------------------------------- */

  let inkLoader = null;
  function loadInk() {
    if (window.inkjs) return Promise.resolve(window.inkjs);
    if (!inkLoader) {
      inkLoader = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "vendor/ink.min.js";
        script.onload = () => resolve(window.inkjs);
        script.onerror = () => reject(new Error("Could not load the Ink runtime."));
        document.head.appendChild(script);
      });
    }
    return inkLoader;
  }

  W.story = function (host, block, lesson) {
    const wrap = shell(host, block);
    if (block.intro) wrap.appendChild(prose(block.intro));

    const panel = document.createElement("div");
    panel.className = "story-panel";
    const text = document.createElement("div");
    text.className = "story-text";
    text.setAttribute("aria-live", "polite");
    const choices = document.createElement("div");
    choices.className = "story-choices";
    const toolbar = document.createElement("div");
    toolbar.className = "story-toolbar";
    const cont = button("Continue", "btn primary story-continue");
    const restart = button("Restart story", "ghost-btn");
    toolbar.append(cont, restart);
    const status = note("widget-note");
    status.textContent = "Loading story...";
    panel.append(text, choices, toolbar);
    wrap.append(panel, status);

    let story = null;
    let ended = false;
    let ending = "";

    function collectTags(tags) {
      (tags || []).forEach((tag) => {
        const match = String(tag).match(/^ENDING:\s*(.+)$/i);
        if (match) ending = match[1].trim();
      });
    }

    function addText(value) {
      if (!value || !value.trim()) return;
      const paragraph = document.createElement("p");
      paragraph.textContent = value.trim();
      text.appendChild(paragraph);
      text.scrollTop = text.scrollHeight;
    }

    function paintChoices() {
      choices.replaceChildren();
      if (!story) return;
      story.currentChoices.forEach((choice, index) => {
        const option = button(choice.text, "story-choice");
        option.addEventListener("click", () => {
          if (!story) return;
          story.ChooseChoiceIndex(index);
          advance();
        });
        choices.appendChild(option);
      });
    }

    function finishStory() {
      if (ended) return;
      ended = true;
      cont.hidden = true;
      const end = document.createElement("div");
      end.className = "story-end";
      end.textContent = ending ? `Ending: ${ending}` : "The end.";
      panel.appendChild(end);
      if (block.debrief) panel.appendChild(prose(block.debrief, "lesson-prose widget-explanation"));
      finish(lesson);
    }

    function advance() {
      if (!story) return;
      status.className = "widget-note";
      status.textContent = "";
      let guard = 0;
      let added = false;
      while (story.canContinue && guard < 30) {
        const value = story.Continue();
        collectTags(story.currentTags);
        if (value && value.trim()) {
          addText(value);
          added = true;
          break;
        }
        guard += 1;
      }
      paintChoices();
      const hasChoices = story.currentChoices.length > 0;
      cont.hidden = !story.canContinue;
      cont.disabled = !story.canContinue;
      if (!story.canContinue && !hasChoices) {
        finishStory();
      } else if (!added && hasChoices) {
        status.textContent = "Choose what happens next.";
      }
    }

    async function start() {
      text.replaceChildren();
      choices.replaceChildren();
      panel.querySelectorAll(".story-end, .widget-explanation").forEach((el) => el.remove());
      cont.hidden = false;
      cont.disabled = true;
      restart.disabled = true;
      ended = false;
      ending = "";
      status.className = "widget-note";
      status.textContent = "Loading story...";
      try {
        const ink = await loadInk();
        const response = await fetch(new URL(block.src, state.courseBaseUrl));
        if (!response.ok) throw new Error(`Story not found (${response.status})`);
        const data = await response.json();
        story = new ink.Story(data);
        if (block.start) story.ChoosePathString(block.start);
        status.textContent = "";
        restart.disabled = false;
        advance();
      } catch (error) {
        status.className = "widget-note bad";
        status.textContent = error.message || "The story could not start.";
      }
    }

    cont.addEventListener("click", advance);
    restart.addEventListener("click", start);
    start();
  };

  /* Terminal ---------------------------------------------------------- */

  W.terminal = function (host, block, lesson) {
    const wrap = shell(host, block);
    const goals = document.createElement("div");
    goals.className = "terminal-goals";
    const output = document.createElement("div");
    output.className = "terminal-output";
    output.setAttribute("aria-live", "polite");
    const form = document.createElement("form");
    form.className = "terminal-form";
    const promptLabel = document.createElement("span");
    promptLabel.className = "terminal-prompt";
    promptLabel.textContent = `${block.host}:${block.cwd}$`;
    const input = document.createElement("input");
    input.className = "terminal-input";
    input.setAttribute("aria-label", "Terminal command");
    input.autocomplete = "off";
    form.append(promptLabel, input);

    const completed = new Set();
    let done = false;

    function paintGoals() {
      goals.innerHTML = "";
      block.goals.forEach((goal) => {
        const item = document.createElement("div");
        item.className = `terminal-goal ${completed.has(goal.id) ? "done" : ""}`;
        item.textContent = `${completed.has(goal.id) ? "✓" : "○"} ${goal.label}`;
        goals.appendChild(item);
      });
    }

    function print(html, className = "") {
      const line = document.createElement("div");
      if (className) line.className = className;
      line.innerHTML = html;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const command = input.value.trim().replace(/\s+/g, " ");
      if (!command || done) return;
      print(`<span class="terminal-echo">${escapeHtml(block.host)}:${escapeHtml(block.cwd)}$</span> ${escapeHtml(command)}`);
      input.value = "";
      if (command === "help") {
        print(block.help || "Try the commands described in the brief.", "terminal-help");
        return;
      }
      const match = block.commands.find((entry) => {
        try {
          return new RegExp(entry.pattern).test(command);
        } catch {
          return false;
        }
      });
      if (!match) {
        print("command not found. Type <code>help</code>.", "terminal-bad");
        return;
      }
      print(match.output || "");
      (match.completes || []).forEach((id) => completed.add(id));
      paintGoals();
      if (block.goals.every((goal) => completed.has(goal.id))) {
        done = true;
        print("All objectives complete.", "terminal-ok");
        input.disabled = true;
        finish(lesson);
      }
    });

    const reset = button("Reset terminal", "ghost-btn");
    reset.addEventListener("click", () => {
      completed.clear();
      done = false;
      input.disabled = false;
      output.replaceChildren();
      paintGoals();
      input.focus();
    });

    wrap.append(goals, output, form, reset);
    paintGoals();
    input.focus();
  };

  window.WIDGET_RENDERERS = W;
})();
