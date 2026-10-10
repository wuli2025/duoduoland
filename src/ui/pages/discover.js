(function (BJ) {
  BJ.pages.discover = function (ctx, root) {
    const { config, ui, service, engine, store } = ctx;
    const c = config.copy.discover;
    const { e, icon } = ui;
    let tab = 0;
    let topic = "";
    function render() {
      let rows =
        tab >= 2
          ? engine.rank(
              service.me(config.app.defaultEvent),
              service.participants(config.app.defaultEvent),
              { limit: 40 },
            )
          : service.rank(config.app.defaultEvent, { limit: 40 });
      if (tab === 1) {
        const events = Object.keys(store.get().participations);
        rows = rows.filter((row) =>
          events.some((eventId) => service.participants(eventId).some(p => p.id === row.id)),
        );
      }
      if (tab === 2) rows = rows.filter((row) => service.discoveryFlag(row.id, 'interested'));
      if (tab === 3) rows = rows.filter((row) => service.discoveryFlag(row.id, 'viewed'));
      if (topic)
        rows = rows.filter((row) =>
          engine.matches(
            topic,
            Object.values(row.public.profile).flat().join(" "),
            config.synonyms.industries,
          ),
        );
      const interested = service
        .participants(config.app.defaultEvent)
        .filter((person) => person.interested);
      root.innerHTML =
        `<div class="tabs" role="tablist" aria-label="${e(c.tabLabel)}">${c.tabs.map((label, index) => `<button role="tab" aria-selected="${tab === index}" data-discover-tab="${index}" class="${tab === index ? "active" : ""}">${e(label)}</button>`).join("")}</div>
        <div class="discover-layout"><section><div class="discover-result-label"><span>${topic ? "# " + e(topic) : e(c.tabs[tab])}</span><span>${rows.length} ${e(c.friends)}</span></div>
        ${
          rows.length
            ? `<div class="discover-grid">${rows
                .map((row) => {
                  const p = row.public.profile;
                  const greeted = store.get().greeted.includes(row.id);
                  return `<article class="discover-person"><button class="discover-open" data-person="${row.id}" aria-label="${e(config.copy.common.cardOf.replace("{name}", p.name || config.copy.common.anonymous))}">
            ${ui.avatar(p, "avatar-lg")}<span class="discover-person-arrow">${icon("arrow")}</span><h2>${e(p.name || config.copy.common.anonymous)}</h2><p class="discover-person-role">${e(p.title || "")}</p></button>
            <p class="discover-person-bio">${e(p.bio || "")}</p>${ui.tags((p.skills || p.interests || []).slice(0, 3))}<p class="discover-reason">${e(row.reason)}</p>
            <div class="discover-person-bottom"><span>${icon("users")}${e(c.same)}</span>${ui.button(greeted ? config.copy.common.greeted : config.copy.common.greet, `data-person-action="greet" data-id="${row.id}"`, greeted ? "soft" : "secondary", "message")}</div></article>`;
                })
                .join("")}</div>`
            : ui.empty(
                undefined,
                undefined,
                ui.button(
                  config.copy.common.reset,
                  "data-discover-reset",
                  "secondary",
                ),
              )
        }</section>
        <aside class="discover-sidebar"><section class="panel"><h3>${e(c.circles)}</h3><div class="discover-topics">${c.topics.map((value) => `<button data-topic="${e(value)}" class="${topic === value ? "active" : ""}"># ${e(value)}${icon("arrow")}</button>`).join("")}</div></section>
        <section class="panel"><h3>${e(c.want)}<span class="discover-count">${interested.length}</span></h3><div class="discover-interest">${interested
          .map((person) => {
            const p = engine.project(person).profile;
            return `<button data-person="${person.id}">${ui.avatar(p)}<span><b>${e(p.name)}</b><small>${e(p.title)}</small></span>${icon("chevron")}</button>`;
          })
          .join(
            "",
          )}</div></section><section class="discover-note"><span class="eyebrow">${e(c.noteLabel)}</span><h3>${e(c.asideTitle)}</h3><p>${e(c.asideText)}</p><a class="text-link" href="#/me">${e(c.edit)}${icon("arrow")}</a></section></aside></div>`;
      root.querySelectorAll("[data-discover-tab]").forEach(
        (button) =>
          (button.onclick = () => {
            tab = Number(button.dataset.discoverTab);
            render();
          }),
      );
      root.querySelectorAll("[data-topic]").forEach(
        (button) =>
          (button.onclick = () => {
            topic = topic === button.dataset.topic ? "" : button.dataset.topic;
            render();
          }),
      );
      root
        .querySelectorAll("[data-person]")
        .forEach(
          (button) =>
            (button.onclick = () => ctx.person.open(button.dataset.person)),
        );
      ctx.person.bind(root, render);
      const reset = root.querySelector("[data-discover-reset]");
      if (reset)
        reset.onclick = () => {
          tab = 0;
          topic = "";
          render();
        };
    }
    render();
  };
})(window.BJ);
