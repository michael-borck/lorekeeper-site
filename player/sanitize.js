/* Pack HTML sanitizer. Lesson prose may contain formatting, never active content. */
(function () {
  const ALLOWED_TAGS = new Set([
    "a", "abbr", "blockquote", "br", "caption", "code", "col", "colgroup", "dd", "del",
    "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3",
    "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre",
    "q", "s", "small", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td",
    "tfoot", "th", "thead", "tr", "u", "ul",
  ]);
  const VOID_TAGS = new Set(["br", "col", "hr", "img"]);
  const ALLOWED_ATTRS = {
    a: new Set(["href", "title"]),
    abbr: new Set(["title"]),
    col: new Set(["span"]),
    colgroup: new Set(["span"]),
    del: new Set(["cite"]),
    dfn: new Set(["title"]),
    img: new Set(["src", "alt", "title", "width", "height", "loading"]),
    ins: new Set(["cite"]),
    q: new Set(["cite"]),
    td: new Set(["colspan", "headers", "rowspan"]),
    th: new Set(["colspan", "headers", "rowspan", "scope"]),
  };
  const DANGEROUS_TAGS = new Set([
    "script", "style", "iframe", "frame", "frameset", "object", "embed", "link", "meta",
    "base", "form", "input", "button", "select", "textarea", "svg", "math", "template",
  ]);

  function safeUrl(value, attributeName) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(?:mailto:|tel:)/i.test(raw)) return raw;
    if (attributeName === "src" && /^data:image\/(?:png|jpeg|jpg|gif|webp|avif);/i.test(raw)) return raw;
    if (/^(?:java|vbs|data|blob|file|about|javascript):/i.test(raw)) return "";
    try {
      const url = new URL(raw, "https://lorekeeper.invalid/");
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return raw;
    } catch {
      return "";
    }
  }

  function sanitizeNode(node, out) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        out.appendChild(document.createTextNode(child.nodeValue || ""));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = child.nodeName.toLowerCase();
      if (DANGEROUS_TAGS.has(tag)) continue;

      if (!ALLOWED_TAGS.has(tag)) {
        sanitizeNode(child, out);
        continue;
      }

      const element = document.createElement(tag);
      for (const name of ALLOWED_ATTRS[tag] || []) {
        if (!child.hasAttribute(name)) continue;
        const value = child.getAttribute(name) || "";
        if (name === "href" || name === "src" || name === "cite") {
          const safe = safeUrl(value, name);
          if (!safe) continue;
          element.setAttribute(name, safe);
        } else {
          element.setAttribute(name, value);
        }
      }
      if (tag === "img") element.setAttribute("loading", element.getAttribute("loading") || "lazy");
      if (tag === "a") {
        element.setAttribute("rel", "noreferrer noopener");
        element.setAttribute("target", "_blank");
      }
      if (!VOID_TAGS.has(tag)) sanitizeNode(child, element);
      out.appendChild(element);
    }
  }

  function sanitizeHtml(html) {
    if (!html || typeof html !== "string") return "";
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const out = document.createElement("body");
    sanitizeNode(parsed.body, out);
    return out.innerHTML;
  }

  window.LorekeeperSanitize = {
    html: sanitizeHtml,
  };
})();
