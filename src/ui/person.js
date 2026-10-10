(function (BJ) {
  BJ.createPersonUI = function (ctx) {
    const { config, ui, engine, store, service } = ctx;
    const { e, icon } = ui;
    const c = config.copy.common;
    function card(person, options = {}) {
      const projected = engine.project(person), p = projected.profile;
      const version = (person.versions || []).find(
        (v) => v.id === (person.session || {}).versionId,
      );
      const theme =
        config.app.cardThemes.find((t) => t.id === ((version || {}).theme || (projected.cardType === 'dating' ? 'sage' : ''))) ||
        config.app.cardThemes[0];
      return `<article class="person-card" style="--card-bg:${theme.color}">
        <div class="person-card-brand"><b>${e(config.app.brand)}</b><span>${e(c.cardGreeting)}</span></div>
        ${ui.avatar(p, "avatar-lg")}
        <h2>${e(p.name || c.anonymous)}</h2>
        <div class="person-card-role">${e([p.title, p.company, p.city].filter(Boolean).join(" · "))}</div>
        ${ui.tags((p.skills || p.interests || []).slice(0, 4))}
        ${p.bio ? `<p class="person-card-bio">${e(p.bio)}</p>` : ""}
        ${options.intent ? `<div class="person-card-bio"><small>${e(config.copy.join.intent)}</small><p>${e(options.intent)}</p></div>` : ""}
        <div class="person-card-foot"><span>${e(c.privacy)}</span>${icon("arrow")}</div>
      </article>`;
    }
    function fields(person, options = {}) {
      const projected = engine.project(person), p = projected.profile;
      const wanted = options.keys || (projected.cardType === 'dating' ? ['city', 'interests', ...config.dating.fields] : [
        "industry",
        "experience",
        "education",
        "contact",
        ...['cooperation', 'markets', 'availability', 'compensation', 'employment']
          .filter(key => p[key] !== undefined),
      ]);
      const ordered = wanted
        .map((key) => config.fields.find((field) => field.key === key))
        .filter(Boolean);
      return `<div class="public-fields">${ordered.map((field) => `<div class="public-field"><span>${e(field.label)}</span><span>${p[field.key] !== undefined ? e(ui.text(p[field.key])) : `<span class="locked">${icon("lock")}${e(options.hidden || c.hidden)}</span>`}</span></div>`).join("")}</div>`;
    }
    function actions(personId) {
      const state = store.get();
      return `<div class="button-row person-actions">
        ${ui.button(state.greeted.includes(personId) ? c.greeted : c.greet, `data-person-action="greet" data-id="${personId}"`, "primary", "message")}
        ${ui.button(state.met.includes(personId) ? c.metDone : c.met, `data-person-action="met" data-id="${personId}"`, "secondary", "check")}
        <button class="icon-btn ${state.favorites.includes(personId) ? "is-saved" : ""}" data-person-action="favorite" data-id="${personId}" aria-label="${e(state.favorites.includes(personId) ? c.collected : c.collect)}" aria-pressed="${state.favorites.includes(personId)}">${icon("bookmark")}</button></div>`;
    }
    function act(action, id) {
      const mapping = { greet: "greeted", met: "met", favorite: "favorites" };
      const key = mapping[action];
      if (!key) return;
      if (action === "greet") {
        if (!store.get().greeted.includes(id))
          store.update((state) => state.greeted.push(id));
        ctx.overlay.toast(c.greetToast);
      } else store.toggle(key, id);
    }
    function bind(root, callback) {
      root.querySelectorAll("[data-person-action]").forEach(
        (button) =>
          (button.onclick = (event) => {
            event.stopPropagation();
            act(button.dataset.personAction, button.dataset.id);
            if (callback) callback();
          }),
      );
    }
    function open(id, eventId = config.app.defaultEvent) {
      const person = service.publicPerson(id, eventId);
      if (!person) return;
      const p = engine.project(person).profile;
      const result = engine.score(service.me(eventId), person);
      const modal = ctx.overlay.open(
        p.name || c.anonymous,
        card(person) +
          `<div class="person-modal-reason"><h3>${e(config.copy.match.reason)}</h3><p>${e(result.reason)}</p></div>` +
          fields(person) +
          actions(id),
      );
      bind(modal, () => {
        modal.querySelector(".person-actions").outerHTML = actions(id);
        bind(modal, () => open(id, eventId));
      });
    }
    return { card, fields, actions, bind, act, open };
  };
})(window.BJ);
