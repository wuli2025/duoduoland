(function (BJ) {
  BJ.pages.match = function (ctx, root, eventId) {
    const { config, ui, service, store, engine } = ctx;
    const event = service.event(eventId);
    if (!event) return ctx.notFound(root);
    const c = config.copy.match;
    const { e, icon } = ui;
    let rows = [];
    let selected = 0;
    let excluded = new Set();
    let disposed = false;
    const progress = BJ.progressive.create();
    const processUI = BJ.createMatchProcess(ctx, progress);
    let requestTimer;
    let requestController;
    const filters = { preference: 0.5, checkedOnly: false, mutualOnly: false };
    const query = () => service.me(eventId).session.intent;
    const romantic = () => query()?.mode === 'dating';
    const fit = row => row.fitReason ? `<div class="dating-fit"><b>${e(BJ.dating.title(row.public, query()))}</b>${e(row.fitReason)}</div>` : '';
    const heading = () => progress.get().pending ? config.llm.process.title
      : rows.length ? c.title.replace('{count}', rows.length) : c.emptyTitle;
    // Settled results survive greetings, feedback and page revisits; only an
    // intent/filter change, "换一批" or "重新计算" asks the model again.
    const memo = BJ.matchMemo || (BJ.matchMemo = new Map());
    const memoKey = () => JSON.stringify([eventId, service.me(eventId).session.intent,
      engine.project(service.me(eventId)), service.participants(eventId).map(p => engine.project(p)), filters, [...excluded].sort()]);
    function recompute(reset = false, bypassCache = false) {
      if (reset) excluded = new Set();
      const previous = rows[selected]?.id;
      clearTimeout(requestTimer);
      requestController?.abort();
      const offline = location.protocol === 'file:' || !config.llm.enabled || (romantic() && ctx.llm.compatibility().mismatch);
      if (BJ.intentTools.empty(query())) { progress.begin([], {offline:true}); rows=[]; return; }
      const remembered = !offline && !bypassCache && memo.get(memoKey());
      if (remembered) {
        progress.restore(remembered);
        rows = remembered.rows;
        selected = Math.max(0, rows.findIndex(row => row.id === previous));
        return;
      }
      const version = progress.begin([], { offline });
      const recalled = service.rank(eventId, {
        ...filters, exclude: [...excluded], limit: config.llm.candidateCount, lambda: 1,
        onRead: count => progress.read(version, count),
      });
      const picked = engine.mmr(recalled, config.matching.topK);
      const local = romantic() ? BJ.dating.variety(engine.project(service.me(eventId)), picked) : picked;
      if (offline) {
        progress.begin(local, { offline: true });
        rows = local;
        selected = Math.max(0, rows.findIndex(row => row.id === previous));
        return;
      }
      progress.recall(version, recalled, local);
      rows = [];
      if (!recalled.length) {
        progress.settle(version, { engine: 'local', error: 'NO_CANDIDATES' });
        return;
      }
      requestController = new AbortController();
      const signal = requestController.signal;
      requestTimer = setTimeout(async () => {
        const me = service.me(eventId);
        let result;
        try {
          result = await ctx.llm.rerank(engine.project(me), me.session.intent, recalled,
            config.matching.topK, eventId, { signal, bypassCache, onRequest: info => {
              if (progress.request(version, info)) renderStatus();
            } });
        } catch (error) {
          result = { engine: 'local', error: BJ.llmClient.errorCode(error) };
        }
        if (result.error) BJ.llmClient.diagnostic({ code: result.error }, { eventId, phase: progress.get().phase });
        if (disposed || !progress.settle(version, result)) return;
        if (['done', 'cached'].includes(progress.get().phase)) memo.set(memoKey(), progress.get());
        rows = progress.get().rows;
        selected = Math.max(0, rows.findIndex(row => row.id === previous));
        renderResults(true);
      }, config.llm.debounceMs);
    }
    function renderStatus() {
      const state = progress.get();
      root.querySelector('.page-heading h1').textContent = heading();
      const label = root.querySelector('[data-engine]');
      const info = service.datingInfo(eventId);
      label.textContent = info && !info.ready ? config.dating.copy.blocked : processUI.label();
      if (BJ.intentTools.empty(query())) label.textContent = config.intent.emptyMatch;
      else if (romantic() && ctx.llm.compatibility().mismatch) label.textContent = config.intent.versionLocal;
      const warning = root.querySelector('[data-version-warning]');
      warning.hidden = !ctx.llm.compatibility().mismatch;
      warning.textContent = config.intent.versionWarning;
      label.dataset.phase = state.phase;
      const host = root.querySelector('.match-thinking-host');
      host.hidden = !state.pending;
      host.innerHTML = processUI.content();
      root.querySelector('.match-layout').hidden = state.pending;
      root.querySelector('[data-shuffle]').disabled = state.pending;
      const action = root.querySelector('[data-engine-action]');
      action.innerHTML = ['done', 'cached', 'failed'].includes(state.phase)
        ? ui.button(state.phase === 'failed' ? config.llm.process.retry : config.llm.process.recalculate,
          'data-recalculate', 'secondary', 'refresh') : '';
      const retry = action.querySelector('[data-recalculate]');
      if (retry) retry.onclick = () => { recompute(false, true); renderResults(); };
      const summary = root.querySelector('[data-dating-summary]');
      if (info) root.querySelector('.match-count').textContent = config.dating.copy.countNote.replace('{n}', info.count).replace('{shown}', rows.length);
      summary.hidden = !info;
      if (info) summary.innerHTML = info.ready ? `<p>${e(config.dating.copy.count.replace('{n}', info.count))}</p>${info.alternatives.length ? `<small>${e(config.dating.copy.otherEvents)}</small><div class="dating-alternatives">${info.alternatives.map(item => `<a href="#/events/${e(item.id)}">${e(item.title)} · ${e(config.dating.copy.eventCount.replace('{n}', item.count))}</a>`).join('')}</div>` : ''}`
        : `<p>${e(config.dating.copy.consent)}</p><a href="#/events/${e(eventId)}/join">${e(config.dating.copy.enable)}</a>`;
    }
    function details() {
      const row = rows[selected];
      if (!row) return "";
      const feedback = store.get().feedback[eventId + ":" + row.id];
      return `${ctx.person.card(row.public)}<div class="match-detail-content">
        <h3>${e(c.why)}</h3><div class="match-factors">${(romantic() ? config.dating.factorLabels : c.factors).map(([key, label]) => `<div class="match-factor"><span>${e(label)}</span><div class="match-factor-track"><i style="width:${Math.round(row.factors[key] * 100)}%"></i></div><b>${Math.round(row.factors[key] * 100)}</b></div>`).join("")}</div>
        <p class="match-explanation">${e(row.reason)}</p>
        ${fit(row)}
        <div class="match-icebreaker"><span>${icon("message")}${e(c.icebreaker)}</span><p>「${e(row.icebreaker)}」</p></div>
        ${ctx.person.fields(row.public)}${ctx.person.actions(row.id)}
        <div class="match-feedback"><span>${e(c.feedback)}</span><div>${ui.button(c.useful, 'data-feedback="up"', feedback && feedback.type === "up" ? "accent" : "text")}${ui.button(c.inaccurate, 'data-feedback="down"', "text")}</div></div></div>`;
    }
    function list() {
      if (!rows.length)
        return ui.empty(
          romantic() ? config.dating.copy.modeLabel : excluded.size ? c.exhausted : undefined,
          romantic() ? (service.datingInfo(eventId).ready ? config.dating.copy.count.replace('{n}', 0) : config.dating.copy.blocked) : config.copy.common.emptyHint,
          ui.button(
            excluded.size ? c.restart : config.copy.common.reset,
            "data-reset-matches",
            "secondary",
          ),
        );
      return rows
        .map((row, index) => {
          const p = row.public.profile;
          return `<button class="match-row ${index === selected ? "active" : ""}" data-person-id="${e(row.id)}" data-person-index="${index}" aria-pressed="${index === selected}" style="animation-delay:${index * 70}ms">
          <span class="match-rank">0${index + 1}</span>${ui.avatar(p)}<div class="match-person-info"><h3>${e(p.name || config.copy.common.anonymous)}</h3><p>${e([p.title, p.company].filter(Boolean).join(" · "))}</p><small>${row.public.status === "checked_in" ? '<span class="online-dot"></span>' + e(c.checked) : e(c.registered)}</small></div>
          <div class="match-score"><b>${row.score}<small>%</small></b><span>${e(c.score)}</span></div><div class="match-row-reason">${e(row.reason)}</div>
          ${fit(row)}
        </button>`;
        })
        .join("");
    }
    function updateSelection() {
      root.querySelectorAll("[data-person-index]").forEach((button, index) => {
        button.classList.toggle("active", selected === index);
        button.setAttribute("aria-pressed", String(selected === index));
      });
      root.querySelector(".match-detail").innerHTML = details();
      bindDetails();
    }
    function bindDetails() {
      ctx.person.bind(root.querySelector(".match-detail"), () => renderResults());
      root.querySelectorAll("[data-feedback]").forEach(
        (button) =>
          (button.onclick = () => {
            const row = rows[selected];
            const key = eventId + ":" + row.id;
            if (button.dataset.feedback === "up") {
              store.update((state) => {
                state.feedback[key] = { type: "up" };
              });
              ctx.overlay.toast(c.thanks);
              updateSelection();
              return;
            }
            const modal = ctx.overlay.open(
              c.feedbackTitle,
              `<div class="stacked">${c.feedbackReasons.map((reason, index) => ui.button(reason, `data-reason="${index}"`, "secondary")).join("")}</div>`,
            );
            modal.querySelectorAll("[data-reason]").forEach(
              (option) =>
                (option.onclick = () => {
                  store.update((state) => {
                    state.feedback[key] = {
                      type: "down",
                      reason: c.feedbackReasons[Number(option.dataset.reason)],
                    };
                  });
                  ctx.overlay.close();
                  ctx.overlay.toast(c.feedbackSaved);
                  renderResults();
                }),
            );
          }),
      );
    }
    function renderResults(smooth = false) {
      renderStatus();
      const previous = new Map([...root.querySelectorAll('[data-person-id]')]
        .map(el => [el.dataset.personId, el.getBoundingClientRect().top]));
      const focused = document.activeElement?.dataset.personId;
      root.querySelector(".match-list").innerHTML = progress.get().pending ? "" : list();
      root.querySelector(".match-detail").innerHTML = details();
      root.querySelectorAll("[data-person-index]").forEach(
        (button) =>
          (button.onclick = () => {
            selected = Number(button.dataset.personIndex);
            updateSelection();
          }),
      );
      const reset = root.querySelector("[data-reset-matches]");
      if (reset)
        reset.onclick = () => {
          filters.checkedOnly = false;
          filters.mutualOnly = false;
          root
            .querySelectorAll(".match-filter-check input")
            .forEach((input) => {
              input.checked = false;
            });
          recompute(true);
          renderResults();
        };
      bindDetails();
      if (smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.querySelectorAll('[data-person-id]').forEach(el => {
          const oldTop = previous.get(el.dataset.personId);
          el.animate([{ transform: `translateY(${oldTop == null ? 8 : oldTop - el.getBoundingClientRect().top}px)`, opacity: 0.7 },
            { transform: 'translateY(0)', opacity: 1 }], { duration: config.llm.transitionMs, easing: 'ease-out' });
        });
      }
      if (focused) [...root.querySelectorAll('[data-person-id]')]
        .find(el => el.dataset.personId === focused)?.focus({ preventScroll: true });
    }
    function render() {
      root.innerHTML =
        `<div class="breadcrumb"><a href="#/events/${eventId}">${icon("back")} ${e(event.title)}</a></div>` +
        ui.heading(
          c.eyebrow,
          heading(),
          c.subtitle,
          `<div class="match-header-actions"><div class="button-row">${ui.button(c.change, "data-shuffle", "secondary", "refresh")}${ui.link(c.edit, "/events/" + eventId + "/join", "secondary", "pen")}</div></div>`,
        ) +
        `<p class="version-warning" data-version-warning hidden></p><div class="match-meta"><span data-engine aria-live="polite"></span><span data-engine-action></span></div><div class="dating-summary" data-dating-summary hidden></div><div class="match-thinking-host"></div><div class="match-toolbar" ${romantic() ? 'hidden' : ''}><div class="match-preference"><label for="match-preference">${e(c.preference)}</label><div><span>${e(c.peer)}</span><input id="match-preference" type="range" min="0" max="100" value="50"><span>${e(c.resource)}</span></div></div>
          <label class="match-filter-check"><input type="checkbox" name="checkedOnly">${e(c.checkin)}</label><label class="match-filter-check"><input type="checkbox" name="mutualOnly">${e(c.mutual)}</label></div>
        <div class="match-layout"><div><div class="match-list"></div><p class="match-keyboard">${e(c.keyboard)}</p><p class="match-count">${e(c.countNote.replace("{count}", service.participants(eventId).length))}</p></div><aside class="match-detail"></aside></div>`;
      root.querySelector("[data-shuffle]").onclick = () => {
        rows.forEach((row) => excluded.add(row.id));
        recompute();
        renderResults();
      };
      root.querySelector("#match-preference").oninput = (event) => {
        filters.preference = Number(event.target.value) / 100;
        recompute(true);
        renderResults();
      };
      root.querySelectorAll(".match-filter-check input").forEach(
        (input) =>
          (input.onchange = () => {
            filters[input.name] = input.checked;
            recompute(true);
            renderResults();
          }),
      );
      renderResults();
    }
    function keyboard(event) {
      if (
        ctx.overlay.isOpen() ||
        !rows.length ||
        event.ctrlKey ||
        event.metaKey ||
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
      )
        return;
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        selected =
          (selected + (event.key === "ArrowDown" ? 1 : -1) + rows.length) %
          rows.length;
        updateSelection();
      }
      if (["h", "m"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        ctx.person.act(
          event.key.toLowerCase() === "h" ? "greet" : "met",
          rows[selected].id,
        );
        renderResults();
      }
    }
    recompute();
    render();
    ctx.llm.checkVersion().then(() => { if (!disposed) { if(romantic() && ctx.llm.compatibility().mismatch) { recompute(); renderResults(); } else renderStatus(); } });
    const clock = setInterval(() => processUI.tick(root), config.llm.clockRefreshMs);
    document.addEventListener('keydown', keyboard);
    return () => {
      disposed = true;
      clearInterval(clock);
      clearTimeout(requestTimer);
      requestController?.abort();
      progress.dispose();
      document.removeEventListener("keydown", keyboard);
    };
  };
})(window.BJ);
