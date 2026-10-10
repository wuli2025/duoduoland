(function (BJ) {
  BJ.pages.live = function (ctx, root, id) {
    const { config, data, ui, service, store } = ctx;
    const event = service.event(id);
    if (!event) return ctx.notFound(root);
    const c = config.copy.live;
    const { e, icon } = ui;
    let tick = 0;
    const baseline = data.live;
    root.className = "live-page";
    function renderFeed() {
      const feed = root.querySelector(".live-feed-items");
      feed.innerHTML = [0, 1, 2]
        .map(
          (offset, index) =>
            `<div class="live-feed-row"><span class="live-feed-dot"></span><p>${e(c.activity[(tick + offset) % c.activity.length])}</p><small>${index ? index + " " + c.minutesAgo : c.now}</small></div>`,
        )
        .join("");
    }
    root.innerHTML = `<div class="live-container"><header class="live-header"><a href="#/events" class="brand">${e(config.app.brand)}</a><div><span class="live-red-dot"></span><span>LIVE</span><span class="live-header-event">${e(event.title)}</span></div><div class="button-row"><button class="icon-btn" data-fullscreen aria-label="${e(c.fullscreen)}">${icon("expand")}</button><a class="live-exit" href="#/events/${event.id}">${e(c.exit)}${icon("arrow")}</a></div></header>
      <div class="live-layout"><section class="live-main"><div class="live-eyebrow">${e(c.eyebrow)}</div><h1>${e(c.intro)}<strong>${baseline.meetings + store.get().met.length}<span>${e(c.unit)}</span></strong>${e(c.title)}</h1><p class="live-subtitle">${e(c.subtitle)}</p>
        <div class="live-metrics">${[baseline.checked, baseline.intentRate, baseline.satisfaction].map((value, index) => `<div><strong>${e(value)}</strong><span>${e(c.metrics[index])}</span></div>`).join("")}</div>
        <div class="live-feed"><div class="live-section-title"><span>${e(c.feed)}</span><span class="live-pulse-dot"></span></div><div class="live-feed-items" aria-live="off"></div></div>
      </section><aside class="live-aside"><section class="live-demand"><div class="live-section-title">${e(c.demand)}${icon("users")}</div>${baseline.demands.map(([label, number], index) => `<div class="live-demand-item"><div><span>${e(label)}</span><b>${number}</b></div><div class="live-demand-track"><i style="width:${(number / 68) * 100}%;opacity:${1 - index * 0.18}"></i></div></div>`).join("")}</section>
        <section class="live-scan"><div class="live-qr-wrap">${ui.qr()}<span>${e(config.copy.common.demo)}</span></div><h2>${e(c.scan)}</h2><p>${e(c.scanHint)}</p>${ui.link(config.copy.events.top, "/events/" + id + "/match", "accent", "arrow")}</section></aside></div>
      <footer class="live-footer"><span>${e(c.demo)}</span><span>${e(c.footer)}</span></footer></div>`;
    renderFeed();
    root.querySelector("[data-fullscreen]").onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (_) {
        ctx.overlay.toast(c.fullscreenError);
      }
    };
    const timer = setInterval(() => {
      tick++;
      renderFeed();
    }, 4500);
    return () => {
      clearInterval(timer);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  };
})(window.BJ);
