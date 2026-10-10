(function (BJ) {
  "use strict";
  const config = BJ.config;
  document.title = config.app.title;
  document.querySelector('meta[name="description"]').content = config.app.description;
  const vars = {
    accent: config.app.theme.accent,
    salary: config.app.theme.salary,
    bg: config.app.theme.background,
  };
  Object.entries(vars).forEach(([key, value]) =>
    document.documentElement.style.setProperty("--" + key, value),
  );
  document.documentElement.style.setProperty(
    "--paper-image",
    'url("' + BJ.asset("bg", "paper") + '")',
  );
  const engine = BJ.matcher.create(config);
  const store = BJ.createStore(config, BJ.data);
  const ui = BJ.createUI(config);
  const ctx = { config, data: BJ.data, engine, store, ui };
  ctx.llm = BJ.llmClient.create(config.llm, engine);
  ctx.service = BJ.createService(config, BJ.data, store, engine);
  ctx.overlay = BJ.createOverlays(ctx);
  ctx.person = BJ.createPersonUI(ctx);
  ctx.search = BJ.createSearch(ctx);
  ctx.shell = BJ.createShell(ctx);
  ctx.notFound = (root) => {
    root.innerHTML = ui.empty(
      config.copy.common.notFound,
      "",
      ui.link(config.copy.common.returnHome, "/events"),
    );
  };
  ctx.router = BJ.createRouter((path) => {
    document.getElementById("toasts").replaceChildren();
    ctx.overlay.close();
    const root = ctx.shell.render(path);
    const parts = path.split("/").filter(Boolean);
    if (!parts.length || path === "/events") return BJ.pages.events(ctx, root);
    if (parts[0] === "events" && parts.length === 2)
      return BJ.pages.eventDetail(ctx, root, parts[1]);
    if (parts[0] === "events" && parts[2] === "join")
      return BJ.pages.join(ctx, root, parts[1]);
    if (parts[0] === "events" && parts[2] === "match")
      return BJ.pages.match(ctx, root, parts[1]);
    if (parts[0] === "discover") return BJ.pages.discover(ctx, root);
    if (parts[0] === "jobs") return BJ.pages.jobs(ctx, root, parts[1]);
    if (parts[0] === "me") return BJ.pages.cards(ctx, root, parts[1]);
    if (parts[0] === "live") return BJ.pages.live(ctx, root, parts[1]);
    return ctx.notFound(root);
  });
  window.addEventListener("bj:storage-error", () =>
    ctx.overlay.toast(config.copy.common.storageError),
  );
  window.addEventListener("error", (event) => {
    if (event.error) ctx.overlay.toast(config.copy.common.error);
  });
  BJ.ctx = ctx;
  ctx.router.start();
  if (store.loadFailed) ctx.overlay.toast(config.copy.common.storageError);
})(window.BJ);
