(function (BJ) {
  BJ.createOverlays = function (ctx) {
    const { ui, config } = ctx;
    const host = document.getElementById("overlays");
    let previousFocus;
    let onClose;
    function toast(message) {
      const host = document.getElementById("toasts");
      while (host.childElementCount >= 2) host.firstElementChild.remove();
      const item = document.createElement("div");
      item.className = "toast";
      item.innerHTML = ui.icon("check") + `<span>${ui.e(message)}</span>`;
      document.getElementById("toasts").append(item);
      setTimeout(() => item.remove(), 3500);
    }
    function close() {
      if (!host.childElementCount) return;
      host.replaceChildren();
      document.body.classList.remove("has-modal");
      if (onClose) onClose();
      onClose = null;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
    function open(title, content, options = {}) {
      close();
      previousFocus = document.activeElement;
      onClose = options.onClose;
      host.innerHTML = `<div class="modal-backdrop"><section class="modal ${options.className || ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header"><h2 id="modal-title">${ui.e(title)}</h2><button class="icon-btn" data-modal-close aria-label="${ui.e(config.copy.common.close)}">${ui.icon("close")}</button></header>
        <div class="modal-body">${content}</div></section></div>`;
      document.body.classList.add("has-modal");
      host.querySelector("[data-modal-close]").onclick = close;
      host.querySelector(".modal-backdrop").onclick = (event) => {
        if (event.target === event.currentTarget) close();
      };
      requestAnimationFrame(() => {
        const target =
          host.querySelector("[autofocus]") ||
          host.querySelector("button, input, a, textarea");
        if (target) target.focus();
      });
      return host.querySelector(".modal");
    }
    function prompt(title, value, accept) {
      const modal = open(
        title,
        `<form class="prompt-form"><label>${ui.e(title)}<input name="value" value="${ui.e(value)}" maxlength="24" required autofocus></label><div class="form-error" role="alert"></div><div class="button-row"><button type="submit" class="btn btn-primary">${ui.e(config.copy.common.confirm)}</button>${ui.button(config.copy.common.cancel, "data-cancel", "secondary")}</div></form>`,
      );
      modal.querySelector("[data-cancel]").onclick = close;
      modal.querySelector("form").onsubmit = (event) => {
        event.preventDefault();
        const name = modal.querySelector("input").value.trim();
        if (!name) {
          modal.querySelector(".form-error").textContent =
            config.copy.common.invalidName;
          return;
        }
        close();
        accept(name);
      };
    }
    document.addEventListener("keydown", (event) => {
      if (!host.childElementCount) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...host.querySelectorAll(
          'button, a, input, textarea, select, [tabindex="0"]',
        ),
      ].filter(
        (element) => !element.disabled && element.getClientRects().length,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    return {
      open,
      close,
      toast,
      prompt,
      isOpen: () => host.childElementCount > 0,
    };
  };
})(window.BJ);
