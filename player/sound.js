/* Optional Quest sound. Off by default and disabled in Study mode. */
(function () {
  const KEY = "lorekeeper:sound";
  let context = null;

  function selected() {
    try {
      return localStorage.getItem(KEY) === "on";
    } catch {
      return false;
    }
  }

  function active() {
    return document.documentElement.dataset.theme === "quest" && selected();
  }

  function audio() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function tone(frequency, duration, type = "square", volume = 0.035, delay = 0) {
    const ctx = audio();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function play(name) {
    if (!active()) return;
    if (name === "complete") {
      tone(523.25, 0.08);
      tone(659.25, 0.08, "square", 0.035, 0.09);
      tone(783.99, 0.14, "square", 0.035, 0.18);
    } else if (name === "step") {
      tone(392, 0.05, "square", 0.02);
    } else if (name === "back") {
      tone(294, 0.05, "square", 0.02);
    } else if (name === "level") {
      [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => tone(note, 0.12, "square", 0.035, index * 0.1));
    } else if (name === "chapter") {
      tone(392, 0.1, "triangle", 0.035);
      tone(523.25, 0.1, "triangle", 0.035, 0.11);
      tone(659.25, 0.22, "triangle", 0.035, 0.22);
    } else if (name === "badge") {
      tone(659.25, 0.06, "triangle", 0.03);
      tone(987.77, 0.12, "triangle", 0.03, 0.07);
    }
  }

  function refresh() {
    const picker = document.getElementById("sound-picker");
    const toggle = document.getElementById("sound-toggle");
    const quest = document.documentElement.dataset.theme === "quest";
    if (picker) picker.hidden = !quest;
    if (toggle) toggle.checked = selected();
  }

  function bind() {
    const toggle = document.getElementById("sound-toggle");
    if (!toggle) return;
    refresh();
    toggle.addEventListener("change", () => {
      try {
        localStorage.setItem(KEY, toggle.checked ? "on" : "off");
      } catch {
        /* session only */
      }
      if (toggle.checked) play("badge");
    });
  }

  window.LorekeeperSound = { play, refresh };
  bind();
})();
