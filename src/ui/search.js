(function (BJ) {
  BJ.createSearch = function (ctx) {
    const { config, ui, service, engine, data, store } = ctx;
    const c = config.copy.search;
    function open(initial = "") {
      const modal = ctx.overlay.open(
        config.copy.common.command,
        `<div class="command-input">${ui.icon("search")}<input autofocus id="command-query" value="${ui.e(initial)}" placeholder="${ui.e(config.copy.common.command)}" aria-label="${ui.e(config.copy.common.command)}" autocomplete="off"></div>
        <div class="command-hint">${ui.e(c.hint)} <small data-intent-engine>${ui.e(config.llm.intentLabels.local)}</small></div><div class="command-results" role="listbox" aria-label="${ui.e(c.resultsLabel)}"></div><div class="command-footer">${ui.e(c.footer)}</div>`,
        { className: "search-modal" },
      );
      const input = modal.querySelector("input");
      const results = modal.querySelector(".command-results");
      let rows = [];
      let selected = 0;
      let revision = 0;
      let parseTimer;
      function render(parsedIntent) {
        const query = input.value.trim();
        const normalized = query.toLowerCase();
        const parsed = parsedIntent || engine.parseIntent(query, store.get().me.profile);
        const semantic =
          parsed.mode === 'dating' ||
          parsed.seekRoles.length ||
          parsed.seekIndustries.length ||
          parsed.city;
        const requestedCount = query.match(/(\d+)\s*(?:个|位)/);
        const limit = requestedCount
          ? Math.max(
              1,
              Math.min(config.app.searchLimit, Number(requestedCount[1])),
            )
          : config.app.searchLimit;
        const participants = service.directory();
        const initiator = service.me(config.app.defaultEvent);
        const ranked = engine.rank(initiator, participants, {
          queryIntent: parsed,
          limit: participants.length,
        });
        const people = ranked
          .filter((row) => {
            const publicText = Object.values(row.public.profile)
              .flat()
              .join(" ")
              .toLowerCase();
            if (!query) return true;
            return (
              publicText.includes(normalized) ||
              (semantic &&
                (!parsed.seekRoles.length ||
                  parsed.seekRoles.some((role) =>
                    engine.matches(role, publicText, config.synonyms.roles),
                  )) &&
                (!parsed.seekIndustries.length ||
                  parsed.seekIndustries.some((industry) =>
                    engine.matches(
                      industry,
                      publicText,
                      config.synonyms.industries,
                    ),
                  )) &&
                (!parsed.city || row.public.profile.city === parsed.city))
            );
          })
          .slice(0, limit);
        const events = data.events
          .filter(
            (item) =>
              !query ||
              [
                item.title,
                item.category,
                item.tags.join(" "),
                service.company(item.companyId).name,
              ]
                .join(" ")
                .toLowerCase()
                .includes(normalized) ||
              parsed.seekIndustries.some((term) =>
                engine.matches(
                  term,
                  item.tags.join(" "),
                  config.synonyms.industries,
                ),
              ),
          )
          .slice(0, 3);
        const jobs = data.jobs
          .filter(
            (item) =>
              !query ||
              (item.title + service.company(item.companyId).name)
                .toLowerCase()
                .includes(normalized),
          )
          .slice(0, 3);
        rows = [
          ...people.map((row) => ({
            type: 0,
            id: row.id,
            eventId: row.public.eventId,
            title: row.public.profile.name || config.copy.common.anonymous,
            subtitle: row.public.profile.title || "",
            media: ui.avatar(row.public.profile, "avatar-sm"),
          })),
          ...events.map((item) => ({
            type: 1,
            id: item.id,
            title: item.title,
            subtitle: item.date,
            media: ui.icon("calendar"),
          })),
          ...jobs.map((item) => ({
            type: 2,
            id: item.id,
            title: item.title,
            subtitle: item.salary,
            media: ui.icon("briefcase"),
          })),
        ];
        selected = 0;
        let lastGroup = -1;
        results.innerHTML =
          rows
            .map((row, index) => {
              const group =
                row.type !== lastGroup
                  ? `<div class="command-group">${ui.e(c.groups[row.type])}</div>`
                  : "";
              lastGroup = row.type;
              return (
                group +
                `<button class="command-result ${index === selected ? "active" : ""}" role="option" aria-selected="${index === selected}" data-type="${row.type}" data-index="${index}">${row.media}<div><b>${ui.e(row.title)}</b><small>${ui.e(row.subtitle)}</small></div>${ui.icon("arrow")}</button>`
              );
            })
            .join("") || ui.empty(c.noResults, c.initial);
        results
          .querySelectorAll("[data-index]")
          .forEach(
            (button) =>
              (button.onclick = () => choose(Number(button.dataset.index))),
          );
      }
      function choose(index) {
        const row = rows[index];
        if (!row) return;
        ctx.overlay.close();
        if (row.type === 0) ctx.person.open(row.id, row.eventId);
        if (row.type === 1) ctx.router.go("/events/" + row.id);
        if (row.type === 2) ctx.router.go("/jobs/" + row.id);
      }
      input.oninput = () => {
        render();
        modal.querySelector('[data-intent-engine]').textContent = config.llm.intentLabels.local;
        const current = ++revision;
        const query = input.value;
        clearTimeout(parseTimer);
        parseTimer = setTimeout(async () => {
          const parsed = await ctx.llm.parseIntent(query, { ownProfile: store.get().me.profile });
          if (current === revision && input.isConnected) {
            render(parsed.intent);
            modal.querySelector('[data-intent-engine]').textContent = config.llm.intentLabels[parsed.engine];
          }
        }, 450);
      };
      modal.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          choose(selected);
        }
        if (!["ArrowDown", "ArrowUp"].includes(event.key) || !rows.length)
          return;
        event.preventDefault();
        selected =
          (selected + (event.key === "ArrowDown" ? 1 : -1) + rows.length) %
          rows.length;
        results.querySelectorAll("[data-index]").forEach((button, index) => {
          button.classList.toggle("active", index === selected);
          button.setAttribute("aria-selected", index === selected);
          if (index === selected) button.scrollIntoView({ block: "nearest" });
        });
      });
      render();
    }
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    });
    return { open };
  };
})(window.BJ);
