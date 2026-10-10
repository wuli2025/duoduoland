(function (BJ) {
  BJ.createUI = function (config) {
    const e = (value) =>
      String(value == null ? "" : value).replace(
        /[&<>"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[char],
      );
    const icon = BJ.icon;
    const text = (value) => BJ.datingSettings.format(value);
    const safeKey = (value) =>
      /^[a-z0-9-]+$/i.test(value || "") ? value : "missing";
    function media(group, key, name = "", className = "", eager = false) {
      const initial = group === "avatars" ? [...(name || "")][0] || "" : "";
      if (group === 'avatars' && !key) return `<span class="media avatars avatar ${e(className)}" role="img" aria-label="${e(name)}"><span class="media-fallback">${e(initial)}</span></span>`;
      return `<span class="media ${e(group)} ${e(className)}" role="img" aria-label="${e(name)}">
        <span class="media-fallback" aria-hidden="true">${e(initial)}</span>
        <img src="${e(BJ.asset(group, safeKey(key)))}" alt="" ${eager || group === 'avatars' ? 'loading="eager"' : 'loading="lazy"'} decoding="async">
      </span>`;
    }
    // Hide images until load succeeds, so missing files never flash broken icons.
    document.addEventListener(
      "load",
      (event) => {
        if (event.target.matches && event.target.matches(".media img"))
          event.target.parentElement.classList.add("loaded");
      },
      true,
    );
    document.addEventListener(
      "error",
      (event) => {
        if (event.target.matches && event.target.matches(".media img")) {
          event.target.parentElement.classList.add("failed");
          event.target.parentElement.classList.remove("loaded");
        }
      },
      true,
    );
    const avatar = (profile, size = "") =>
      media(
        "avatars",
        profile.avatar,
        profile.name || config.copy.common.anonymous,
        "avatar " + size,
      );
    const tags = (values) =>
      `<div class="tags">${(values || []).map((value) => `<span class="tag">${e(value)}</span>`).join("")}</div>`;
    const button = (label, attrs = "", style = "primary", glyph = "") =>
      `<button type="button" class="btn btn-${style}" ${attrs}>${glyph ? icon(glyph) : ""}<span>${e(label)}</span></button>`;
    const link = (label, path, style = "primary", glyph = "") =>
      `<a class="btn btn-${style}" href="#${e(path)}">${glyph ? icon(glyph) : ""}<span>${e(label)}</span></a>`;
    function empty(
      title = config.copy.common.empty,
      hint = config.copy.common.emptyHint,
      action = "",
    ) {
      return `<div class="empty-state">${icon("compass")}<h3>${e(title)}</h3><p>${e(hint)}</p>${action}</div>`;
    }
    // Pages no longer show slogan eyebrows/subtitles; only a functional title
    // (when given) and the page actions are rendered.
    function heading(eyebrow, title, subtitle, action = "") {
      if (!title && !action) return "";
      return `<header class="page-heading compact"><div>${title ? `<h1>${e(title)}</h1>` : ""}</div>${action}</header>`;
    }
    function select(name, label, values, current = "") {
      return `<label class="select-wrap"><span class="sr-only">${e(label)}</span><select name="${e(name)}" aria-label="${e(label)}">
        <option value="">${e(label)}</option>${values.map((value) => `<option value="${e(value)}" ${value === current ? "selected" : ""}>${e(value)}</option>`).join("")}
      </select>${icon("down")}</label>`;
    }
    function qr() {
      let rectangles = "";
      for (let y = 0; y < 25; y++) {
        for (let x = 0; x < 25; x++) {
          const finder = [
            [0, 0],
            [18, 0],
            [0, 18],
          ].find(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7);
          const on = finder
            ? x === finder[0] ||
              x === finder[0] + 6 ||
              y === finder[1] ||
              y === finder[1] + 6 ||
              (x >= finder[0] + 2 &&
                x <= finder[0] + 4 &&
                y >= finder[1] + 2 &&
                y <= finder[1] + 4)
            : (x * 13 + y * 7 + x * y) % 5 < 2;
          if (on)
            rectangles += `<rect x="${x + 2}" y="${y + 2}" width="1" height="1"/>`;
        }
      }
      return `<svg class="demo-qr" viewBox="0 0 29 29" role="img" aria-label="${e(config.copy.common.qrLabel)}"><rect width="29" height="29" fill="white"/><g fill="#171817">${rectangles}</g></svg>`;
    }
    return {
      e,
      icon,
      text,
      media,
      avatar,
      tags,
      button,
      link,
      empty,
      heading,
      select,
      qr,
    };
  };
})(window.BJ);
