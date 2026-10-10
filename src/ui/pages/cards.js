(function (BJ) {
  BJ.pages.cards = function (ctx, root, requested) {
    const { config, ui, store, engine } = ctx;
    const c = config.copy.cards;
    const common = config.copy.common;
    const { e, icon } = ui;
    const draft = store.clone(store.get().me);
    let current = draft.versions.some((v) => v.id === requested)
      ? requested
      : requested === "base"
        ? "base"
        : draft.versions[0].id;
    let dirty = false;
    let dragged;
    const getVersion = () =>
      draft.versions.find((version) => version.id === current);
    const orderedFields = (version) => [
      ...new Set([
        ...(version.order || []),
        ...config.fields.map((field) => field.key),
      ]),
    ];
    function markDirty() {
      dirty = true;
      const label = root.querySelector(".cards-save-status");
      if (label) label.textContent = c.unsaved;
    }
    function person() {
      if (current === "base") {
        return {
          ...draft,
          versions: [
            {
              id: "base",
              theme: "paper",
              visibleFields: config.fields.map((field) => field.key),
            },
          ],
          session: { versionId: "base" },
        };
      }
      return { ...draft, session: { versionId: current, datingOpen: draft.profile.datingOpen } };
    }
    function preview() {
      const version = getVersion();
      const keys = (
        version ? orderedFields(version) : config.fields.map((f) => f.key)
      ).filter(
        (key) =>
          ![
            "name",
            "avatar",
            "title",
            "company",
            "bio",
            "skills",
            "interests",
            "city",
          ].includes(key),
      );
      return (
        `<div class="cards-preview-head"><span>${icon("eye")}${e(c.preview)}</span><span class="live-label">${e(common.livePreview)}</span></div>` +
        ctx.person.card(person()) +
        (version
          ? `<div class="cards-themes"><span>${e(c.theme)}</span>${config.app.cardThemes.map((theme) => `<button data-theme="${theme.id}" class="${version.theme === theme.id ? "active" : ""}" style="background:${theme.color}" aria-label="${e(theme.label)}" aria-pressed="${version.theme === theme.id}"></button>`).join("")}</div>`
          : "") +
        ctx.person.fields(person(), { keys, hidden: common.versionHidden }) +
        `<p class="cards-preview-note">${icon("lock")}${e(current === "base" ? c.baseHint : c.previewHint)}</p>`
      );
    }
    function updatePreview() {
      root.querySelector(".cards-preview").innerHTML = preview();
      bindThemes();
    }
    function bindThemes() {
      root.querySelectorAll("[data-theme]").forEach(
        (button) =>
          (button.onclick = () => {
            getVersion().theme = button.dataset.theme;
            markDirty();
            updatePreview();
          }),
      );
    }
    function sidebar() {
      const completion = Math.round(
        (config.fields.filter((field) =>
          ui.text(draft.profile[field.key]).trim(),
        ).length /
          config.fields.length) *
          100,
      );
      return `<div class="cards-sidebar-title">${e(c.versions)}</div><button class="cards-version ${current === "base" ? "active" : ""}" data-version="base">${icon("user")}<span>${e(c.base)}</span><small>${completion}%</small></button>
        <hr class="divider">${draft.versions.map((version) => `<button class="cards-version ${current === version.id ? "active" : ""}" data-version="${e(version.id)}">${icon(config.llm.versionIcons[version.id] || 'user')}<span>${e(version.name)}</span><small>${version.visibleFields.length}</small></button>`).join("")}
        ${ui.button(c.new, "data-new-card", "text", "plus")}<div class="cards-sidebar-note">${icon("lock")}<p>${e(c.baseHint)}</p></div>`;
    }
    function editor() {
      if (current === "base")
        return `<div class="cards-editor-heading"><h2>${e(c.base)}</h2><p>${e(c.baseHint)}</p></div><div class="cards-base-fields">${config.fields
          .map(
            (field) =>
              `<label><span>${icon(field.icon)}${e(field.label)}</span>${
                field.options
                  ? `<select data-profile-field="${field.key}">${field.options.map(value => `<option value="${e(value)}" ${String(draft.profile[field.key]) === value ? 'selected' : ''}>${e(field.key === 'datingOpen' ? BJ.datingSettings.format(value === 'true') : value)}</option>`).join('')}</select>`
                  : field.key === "avatar"
                  ? `<select data-profile-field="avatar">${["me", ...Array.from({ length: 18 }, (_, i) => "p" + String(i + 1).padStart(2, "0"))].map((id, index) => `<option value="${id}" ${draft.profile.avatar === id ? "selected" : ""}>${e(index === 0 ? c.ownAvatar : c.sampleAvatar + " " + index)}</option>`).join("")}</select>`
                  : field.key === "bio" || field.key === "experience"
                    ? `<textarea data-profile-field="${field.key}" maxlength="600">${e(ui.text(draft.profile[field.key]))}</textarea>`
                    : `<input data-profile-field="${field.key}" value="${e(BJ.datingSettings.editValue(draft.profile[field.key]))}" maxlength="240" ${field.array ? `placeholder="${e(c.arrayHint)}"` : ""}>`
              }${field.dating ? `<small class="muted">${e(config.dating.copy.hint)}${field.key === 'datingPreference' ? '<br>' + e(config.dating.copy.preferenceHint) : ''}</small>` : ''}</label>`,
          )
          .join("")}</div>`;
      const version = getVersion();
      return `<div class="cards-editor-heading"><div class="button-row space-between"><h2>${e(version.name)}</h2><div class="button-row"><button class="icon-btn" data-rename-card aria-label="${e(c.rename)}">${icon("pen")}</button><button class="icon-btn" data-delete-card aria-label="${e(c.delete)}">${icon("trash")}</button></div></div><p>${e(c.visibility)}</p><small>${e(config.dating.copy.hint)}</small></div>
        <p class="cards-drag-hint">${icon("grip")}${e(c.drag)}</p><div class="cards-fields">${orderedFields(
          version,
        )
          .map((key, index) => {
            const field = config.fields.find((item) => item.key === key);
            if (!field) return "";
            return `<div class="cards-field" draggable="true" data-field="${field.key}"><span class="cards-drag">${icon("grip")}</span><span class="cards-field-name">${e(field.label)}</span><div class="cards-reorder"><button class="icon-btn" data-move="${index}:up" ${index === 0 ? "disabled" : ""} aria-label="${e(c.moveUp + " " + field.label)}">${icon("up")}</button><button class="icon-btn" data-move="${index}:down" ${index === config.fields.length - 1 ? "disabled" : ""} aria-label="${e(c.moveDown + " " + field.label)}">${icon("down")}</button></div><label class="switch"><input type="checkbox" data-visible="${field.key}" ${field.dating && current !== 'dating' ? 'disabled' : ''} aria-label="${e(common.publish + field.label)}" ${version.visibleFields.includes(field.key) ? "checked" : ""}><span></span></label></div>`;
          })
          .join(
            "",
          )}</div><label class="cards-bio-label">${e(c.bio)}<textarea id="version-bio" maxlength="400">${e(version.bio || "")}</textarea></label><p class="cards-field-count">${version.visibleFields.length}/${config.fields.length} ${e(c.visible)}</p>`;
    }
    function save() {
      const saved = store.update((state) => {
        state.me = store.clone(draft);
        Object.values(state.participations).forEach((session) => {
          if (!draft.versions.some((v) => v.id === session.versionId))
            session.versionId = draft.versions[0].id;
        });
      });
      if (saved) {
        dirty = false;
        root.querySelector(".cards-save-status").textContent = common.saved;
        ctx.overlay.toast(common.saved);
      }
    }
    function add() {
      ctx.overlay.prompt(c.namePrompt, "", (name) => {
        const version = store.clone(getVersion() || draft.versions[0]);
        version.id = "custom-" + Date.now();
        version.name = name;
        version.visibleFields = version.visibleFields.filter(k => !config.dating.fields.includes(k));
        draft.versions.push(version);
        current = version.id;
        markDirty();
        render();
      });
    }
    function remove() {
      if (draft.versions.length === 1) {
        ctx.overlay.toast(c.lastVersion);
        return;
      }
      const modal = ctx.overlay.open(
        c.delete,
        `<p>${e(c.deletePrompt)}</p><div class="button-row">${ui.button(c.delete, "data-confirm-delete", "primary", "trash")}${ui.button(common.cancel, "data-cancel-delete", "secondary")}</div>`,
      );
      modal.querySelector("[data-cancel-delete]").onclick = ctx.overlay.close;
      modal.querySelector("[data-confirm-delete]").onclick = () => {
        draft.versions = draft.versions.filter((v) => v.id !== current);
        current = draft.versions[0].id;
        markDirty();
        ctx.overlay.close();
        render();
      };
    }
    function share() {
      const id = current === "base" ? draft.versions[0].id : current;
      const link = c.linkRoot + id;
      const modal = ctx.overlay.open(
        c.shareTitle,
        `<div class="share-qr">${ui.qr()}</div><p>${e(c.shareHint)}</p><div class="share-link"><input readonly value="${e(link)}" aria-label="${e(c.shareLabel)}">${ui.button(common.copy, "data-copy", "primary", "link")}</div>`,
      );
      modal.querySelector("[data-copy]").onclick = async () => {
        const input = modal.querySelector("input");
        input.select();
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText(link);
          else if (!document.execCommand("copy")) throw new Error("clipboard");
          ctx.overlay.toast(common.copied);
        } catch (_) {
          ctx.overlay.toast(common.clipboardManual);
        }
      };
    }
    function reorder(from, to) {
      const version = getVersion();
      const order = orderedFields(version);
      if (from < 0 || to < 0 || from === to || to >= order.length) return;
      const moved = order.splice(from, 1)[0];
      order.splice(to, 0, moved);
      version.order = order;
      markDirty();
      render();
    }
    function bindEditor() {
      root.querySelectorAll("[data-profile-field]").forEach(
        (input) =>
          (input.oninput = () => {
            const field = config.fields.find(
              (f) => f.key === input.dataset.profileField,
            );
            draft.profile[field.key] = BJ.datingSettings.read(field, input.value);
            if (field.key === 'interests') {
              const datingCard = draft.versions.find(v => v.id === 'dating');
              if (datingCard) datingCard.datingProfile = { interests: draft.profile.interests.slice() };
            }
            markDirty();
            updatePreview();
          }),
      );
      root.querySelectorAll("[data-visible]").forEach(
        (input) =>
          (input.onchange = () => {
            const version = getVersion();
            version.visibleFields = input.checked
              ? [...version.visibleFields, input.dataset.visible]
              : version.visibleFields.filter(
                  (key) => key !== input.dataset.visible,
                );
            markDirty();
            updatePreview();
            root.querySelector(".cards-field-count").textContent =
              version.visibleFields.length +
              "/" +
              config.fields.length +
              " " +
              c.visible;
            root.querySelector(
              `.cards-version[data-version="${current}"] small`,
            ).textContent = version.visibleFields.length;
          }),
      );
      const bio = root.querySelector("#version-bio");
      if (bio)
        bio.oninput = () => {
          getVersion().bio = bio.value;
          markDirty();
          updatePreview();
        };
      root.querySelectorAll("[data-move]").forEach(
        (button) =>
          (button.onclick = () => {
            const [index, direction] = button.dataset.move.split(":");
            reorder(
              Number(index),
              Number(index) + (direction === "up" ? -1 : 1),
            );
          }),
      );
      root.querySelectorAll("[data-field]").forEach((row) => {
        row.ondragstart = (event) => {
          dragged = row.dataset.field;
          event.dataTransfer.setData("text/plain", dragged);
          event.dataTransfer.effectAllowed = "move";
          row.classList.add("dragging");
        };
        row.ondragend = () => row.classList.remove("dragging");
        row.ondragover = (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        };
        row.ondrop = (event) => {
          event.preventDefault();
          const order = orderedFields(getVersion());
          reorder(order.indexOf(dragged), order.indexOf(row.dataset.field));
        };
      });
      const rename = root.querySelector("[data-rename-card]");
      if (rename)
        rename.onclick = () =>
          ctx.overlay.prompt(c.rename, getVersion().name, (name) => {
            getVersion().name = name;
            markDirty();
            render();
          });
      const deletion = root.querySelector("[data-delete-card]");
      if (deletion) deletion.onclick = remove;
    }
    function render() {
      root.innerHTML =
        ui.heading(
          "",
          "",
          "",
          `<div class="button-row">${ui.button(c.share, "data-share-card", "secondary", "share")}${ui.button(common.save, "data-save-card", "primary", "check")}</div>`,
        ) +
        `<div class="cards-save-status">${e(dirty ? c.unsaved : common.saved)}</div><div class="cards-layout"><aside class="cards-sidebar">${sidebar()}</aside><section class="cards-editor panel">${editor()}</section><aside class="cards-preview">${preview()}</aside></div>`;
      root.querySelectorAll("[data-version]").forEach(
        (button) =>
          (button.onclick = () => {
            current = button.dataset.version;
            render();
          }),
      );
      root.querySelector("[data-save-card]").onclick = save;
      root.querySelector("[data-new-card]").onclick = add;
      root.querySelector("[data-share-card]").onclick = share;
      bindThemes();
      bindEditor();
    }
    render();
  };
})(window.BJ);
