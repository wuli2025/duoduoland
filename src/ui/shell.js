(function (BJ) {
  BJ.createShell = function (ctx) {
    const { config, ui, store } = ctx;
    const { e, icon } = ui;
    function render(path) {
      const app = config.app;
      const c = config.copy.shell;
      const active = path.startsWith("/events")
        ? "/events"
        : "/" + path.split("/")[1];
      const header = `<header class="site-header"><div class="container site-header-inner">
        <a class="brand" href="#/events" aria-label="${e(app.brand)} ${e(c.home)}">${e(app.brand)}</a>
        <nav class="main-nav" aria-label="${e(c.navigation)}">${app.nav.map((item) => `<a class="${active === item.path ? "active" : ""}" ${active === item.path ? 'aria-current="page"' : ""} href="#${item.path}">${e(item.label)}</a>`).join("")}</nav>
        <div class="header-tools"><label class="header-city">${icon("pin")}<select aria-label="${e(c.city)}" id="global-city">${app.cities.map((city) => `<option ${store.get().city === city ? "selected" : ""}>${e(city)}</option>`).join("")}</select></label>
        <button class="header-search" data-search aria-label="${e(config.copy.common.command)}">${icon("search")}<span>${e(config.copy.common.search)}</span><kbd>⌘ K</kbd></button>
        <button class="icon-btn notification" data-info="notifications" aria-label="${e(c.notifications)}">${icon("bell")}</button>
        <a class="header-avatar" href="#/me" aria-label="${e(c.cards)}">${ui.avatar(store.get().me.profile)}</a></div>
        </div></header>`;
      const footer = `<footer class="site-footer"><div class="container">
        <div class="footer-grid"><div class="footer-brand"><a class="brand" href="#/events">${e(app.brand)}</a><p>${e(app.tagline)}</p></div>
        ${app.footer.map((column) => `<div class="footer-column"><h4>${e(column.title)}</h4>${column.links.map(([label, target]) => (target.startsWith("/") ? `<a href="#${target}">${e(label)}</a>` : `<button data-info="${target}">${e(label)}</button>`)).join("")}</div>`).join("")}</div>
        <div class="footer-bottom"><span>© 2026 ${e(app.brand)} &nbsp; ${e(c.footerEnglish)}</span><span>${e(c.footerLabel)}</span></div>
        </div></footer>`;
      document.getElementById("app").innerHTML = path.startsWith("/live/")
        ? '<main id="main" tabindex="-1"></main>'
        : header +
          '<main id="main" class="container page-main" tabindex="-1"></main>' +
          footer;
      document
        .querySelectorAll("[data-search]")
        .forEach((button) => (button.onclick = () => ctx.search.open()));
      document.querySelectorAll("[data-info]").forEach(
        (button) =>
          (button.onclick = () => {
            const info = config.copy.info[button.dataset.info];
            ctx.overlay.open(
              info[0],
              `<p>${e(info[1])}</p>${button.dataset.info === "notifications" ? `<div class="button-row">${ui.link(config.copy.events.top, "/events/" + app.defaultEvent + "/match")}</div>` : ""}`,
            );
          }),
      );
      const city = document.getElementById("global-city");
      if (city)
        city.onchange = () => {
          store.update((state) => {
            state.city = city.value;
          });
          ctx.router.refresh();
        };
      return document.getElementById("main");
    }
    return { render };
  };
})(window.BJ);
