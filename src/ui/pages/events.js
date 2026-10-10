(function (BJ) {
  BJ.pages.events = function (ctx, root) {
    const { config, data, ui, service, store } = ctx;
    const c = config.copy.events;
    const { e, icon } = ui;
    let category = config.copy.common.allCategory;
    let disposeCarousel = () => {};
    function eventCard(item, related = false) {
      const company = service.company(item.companyId);
      const attendees = BJ.attendees(ctx, item.id);
      return `<a class="event-card" href="#/events/${item.id}">
        <div class="event-card-cover-wrap">${ui.media("events", item.image, item.title, "event-card-cover")}
        <span class="event-card-category">${e(item.category)}</span></div>
        <div class="event-card-body"><div class="event-card-date">${e(item.date)}</div>
        <h3>${e(item.title)}</h3><div class="event-card-location">${icon("pin")}${e(item.city + " · " + item.venue)}</div>
        <div class="event-card-company">${ui.media("logos", company.id, company.name)}<span>${e(company.name)}</span>${icon("verified")}</div>
        <div class="event-card-bottom"><div><span title="${e(c.attendanceNote)}">${e(attendees.counts)}</span><strong>${item.price ? "¥" + item.price + " " + c.priceSuffix : e(config.copy.common.free)}</strong></div>${attendees.avatars}</div>
        ${related ? `<div class="event-card-related">${icon("users")}${e(c.related)} ${service.related(item.id)} ${e(config.copy.common.peopleUnit)}</div>` : ""}</div></a>`;
    }
    function rankPreview(item) {
      return `<a href="#/events/${item.id}" class="events-ranking-preview">${ui.media("events", item.image, item.title)}<span class="rank-mark">${e(c.rankingLabel)}</span><h3>${e(item.title)}</h3><small>${e(item.date + " · " + item.venue)}</small></a>`;
    }
    function render() {
      disposeCarousel();
      const available = data.events
        .filter(
          (item) =>
            store.get().city === config.copy.common.allCities ||
            item.city === store.get().city,
        )
        .filter(
          (item) =>
            category === config.copy.common.allCategory ||
            item.category === category ||
            item.tags.includes(category),
        );
      const popular = data.events
        .slice()
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 8);
      const recommended = available
        .slice()
        .sort((a, b) => service.eventRelevance(b) - service.eventRelevance(a));
      root.classList.add("events-page");
      // The carousel opens the page so the rotating cards are visible on first screen.
      root.innerHTML = `
        <section data-event-carousel></section>
        <nav class="events-categories" aria-label="${e(c.categoryLabel)}">${config.app.categories.map(([label, glyph]) => `<button class="events-category ${category === label ? "active" : ""}" data-category="${e(label)}" aria-pressed="${category === label}">${icon(glyph)}${e(label)}</button>`).join("")}</nav>
        <section class="events-section"><div class="section-head"><div><h2>${e(c.featured)}<span class="events-section-label">${e(c.featuredLabel)}</span></h2></div><a class="text-link" href="#/events" data-scroll-recommended>${e(config.copy.common.all)}${icon("arrow")}</a></div>
          ${
            available.length
              ? `<div class="events-grid">${available
                  .slice(0, 4)
                  .map((item) => eventCard(item))
                  .join("")}</div>`
              : ui.empty(
                  undefined,
                  undefined,
                  ui.button(
                    config.copy.common.reset,
                    "data-reset-events",
                    "secondary",
                  ),
                )
          }</section>
        <section class="events-section events-trending"><div class="section-head"><div><div class="eyebrow">${e(c.week)}</div><h2>${e(c.trending)}</h2><p>${e(c.trendingSub)}</p></div>${icon("chart")}</div>
          <div class="events-trending-layout"><div class="events-ranking">${popular.map((item, index) => `<a class="events-rank" href="#/events/${item.id}"><span class="events-rank-number">${index + 1}</span><div><b>${e(item.title)}</b><small>${e(item.category)} · ${item.count} ${e(c.interested)}</small></div></a>`).join("")}</div>${rankPreview(popular[0])}</div></section>
        <section class="events-section" id="events-recommended"><div class="section-head"><div><h2>${e(c.forYou)}</h2><p>${e(c.forYouSub)}</p></div><span class="small muted">${e(c.nextHello)}</span></div>
          ${recommended.length ? `<div class="events-grid">${recommended.map((item) => eventCard(item, true)).join("")}</div>` : ui.empty()}<p class="small muted" style="margin-top:16px">${e(c.localCounts)}</p></section>`;
      disposeCarousel = BJ.mountCarousel(root.querySelector('[data-event-carousel]'), {
        groups: BJ.carousel.sources(data.events, data.heroes), config: config.carousel, ui,
        isBlocked: () => ctx.overlay.isOpen(),
      });
      root.querySelectorAll("[data-category]").forEach(
        (button) =>
          (button.onclick = () => {
            category = button.dataset.category;
            render();
          }),
      );
      root.querySelector("[data-scroll-recommended]").onclick = (event) => {
        event.preventDefault();
        root
          .querySelector("#events-recommended")
          .scrollIntoView({ behavior: "smooth" });
      };
      const reset = root.querySelector("[data-reset-events]");
      if (reset)
        reset.onclick = () => {
          category = config.copy.common.allCategory;
          render();
        };
    }
    render();
    return () => disposeCarousel();
  };
})(window.BJ);
