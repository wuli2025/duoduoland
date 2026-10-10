(function (BJ) {
  BJ.createRouter = function (render) {
    let cleanup;
    function path() {
      try {
        return decodeURIComponent(location.hash.slice(1) || "/events");
      } catch (_) {
        return "/404";
      }
    }
    function run() {
      if (typeof cleanup === "function") cleanup();
      cleanup = render(path());
      window.scrollTo(0, 0);
    }
    function go(value) {
      if (path() === value) run();
      else location.hash = value;
    }
    window.addEventListener("hashchange", run);
    return { start: run, go, path, refresh: run };
  };
})(window.BJ);
