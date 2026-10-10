(function (BJ) {
  BJ.pages.join = function (ctx, root, eventId) {
    const { config, store, service, engine, ui } = ctx;
    const event = service.event(eventId);
    if (!event) return ctx.notFound(root);
    const c = config.copy.join;
    const common = config.copy.common;
    const { e, icon } = ui;
    const draft = store.clone(service.me(eventId).session);
    const editor = BJ.createIntentEditor(ctx, root, eventId, draft, changed);
    function changed() {
      clearTimeout(intentTimer); intentController?.abort();
      root.querySelector(".join-parsed-tags").innerHTML = tagList();
      bindTags(); updatePreview(); consent(); editor.refresh();
    }
    let step = 0;
    let micTimer;
    let intentTimer;
    let intentController;
    let intentEngine = 'local';
    if (!draft.intent) draft.intent = engine.parseIntent(draft.intentText, store.get().me.profile);
    function consent() {
      const host = root.querySelector('[data-dating-consent]');
      if (!host) return;
      host.hidden = draft.intent.mode !== 'dating';
      const ready = BJ.dating.ready(engine.project({ ...store.get().me, session: draft }));
      host.innerHTML = `<b>${e(config.dating.copy.consent)}</b><p>${e(ready ? config.dating.copy.enabled : config.dating.copy.hint)}</p>
        <div class="button-row">${ui.button(config.dating.copy.enable, 'data-enable-dating', 'primary')}${ui.button(config.dating.copy.decline, 'data-decline-dating', 'secondary')}</div>
        <small>${e(BJ.datingSettings.format(store.get().me.profile.datingPreference))} · <a href="#/me/base">${e(config.dating.copy.edit)}</a></small>`;
      host.querySelector('[data-enable-dating]').onclick = () => {
        store.update(state => BJ.datingSettings.enable(state.me, draft, BJ.data.me));
        consent(); updatePreview();
      };
      host.querySelector('[data-decline-dating]').onclick = () => {
        draft.datingOpen = false;
        consent(); updatePreview();
        host.querySelector('p').textContent = config.dating.copy.blocked;
      };
    }
    function preview() {
      const person = { ...store.get().me, session: draft };
      const intent = draft.publicIntent
        ? (draft.intent.mode === 'dating' ? [config.dating.copy.modeLabel, draft.intent.targetGender, draft.intent.ageRange.join('–') + '岁', ...draft.intent.interests, ...(draft.intent.lifestyle || []), ...(draft.intent.values || [])]
          : [...draft.intent.seekRoles, ...draft.intent.seekIndustries, ...(draft.intent.seekSkills || [])]).join(
            " · ",
          )
        : c.privateIntent;
      return (
        `<div class="join-preview-label">${icon("eye")}<span>${e(c.preview)}</span><span class="live-label">${e(common.livePreview)}</span></div>` +
        ctx.person.card(person, { intent }) +
        ctx.person.fields(person, {
          keys: draft.versionId === 'dating' ? config.dating.fields : ["experience", "education", "contact"],
          hidden: common.versionHidden,
        })
      );
    }
    function updatePreview() {
      root.querySelector(".join-preview").innerHTML = preview();
    }
    const tagList = () => editor.parsed();
    function bindTags() {
      root.querySelectorAll("[data-remove-key]").forEach(
        (button) =>
          (button.onclick = () => {
            const key = button.dataset.removeKey;
            if (key === "city") draft.intent.city = "";
            else
              draft.intent[key].splice(Number(button.dataset.removeIndex), 1);
            root.querySelector(".join-parsed-tags").innerHTML = tagList();
            bindTags();
            updatePreview();
            editor.refresh();
          }),
      );
    }
    function stepContent() {
      if (step === 0)
        return `<h2>${e(c.version)}</h2><p class="join-step-hint">${e(c.versionHint)}</p>
        <div class="join-version-list">${store
          .get()
          .me.versions.map(
            (version) =>
              `<button class="join-version ${draft.versionId === version.id ? "active" : ""}" data-version="${e(version.id)}" aria-pressed="${draft.versionId === version.id}"><span class="join-version-symbol">${icon(config.llm.versionIcons[version.id] || 'user')}</span><span><b>${e(version.name)}</b><small>${e(c.fieldCount.replace("{visible}", version.visibleFields.length).replace("{total}", config.fields.length))}</small></span><span class="radio-mark">${draft.versionId === version.id ? icon("check") : ""}</span></button>`,
          )
          .join("")}</div>
        ${ui.button(c.newVersion, "data-new-version", "text", "plus")}`;
      if (step === 1)
        return `<h2>${e(c.intent)}</h2><p class="join-step-hint">${e(c.intentHint)}</p>
        <div class="join-textarea"><textarea id="intent-text" aria-label="${e(c.intent)}" maxlength="800">${e(draft.intentText || "")}</textarea><button class="icon-btn join-mic" aria-label="${e(c.micLabel)}" data-mic>${icon("mic")}</button><div class="join-wave" hidden><i></i><i></i><i></i><i></i><i></i></div></div>
        <div class="join-templates"><span>${e(c.templates)}</span>${config.templates.map(([label], index) => `<button data-template="${index}">${e(label)}</button>`).join("")}</div>
        <div class="join-parsed"><div class="section-head"><h3>${e(c.parsed)}</h3>${ui.button(c.addTag, "data-add-tag", "text", "plus")}</div><small class="muted" data-intent-engine>${e(config.llm.intentLabels[intentEngine])}</small><div class="join-parsed-tags">${tagList()}</div></div><section class="intent-picker" data-common-tags></section><div class="dating-consent" data-dating-consent></div>`;
      return `<h2>${e(c.steps[2])}</h2><p class="join-step-hint">${e(c.versionHint)}</p>
        <label class="join-privacy"><div><b>${e(c.publicIntent)}</b><p>${e(c.publicHint)}</p></div><input type="checkbox" name="publicIntent" ${draft.publicIntent ? "checked" : ""}></label>
        <label class="join-privacy"><div><b>${e(c.openToChat)}</b><p>${e(c.openHint)}</p></div><input type="checkbox" name="openToChat" ${draft.openToChat ? "checked" : ""}></label>
        <div class="join-privacy-note">${icon("lock")}<p>${e(config.copy.info.privacy[1])}</p></div><div class="dating-consent" data-dating-consent></div>`;
    }
    function addTag() {
      const modal = ctx.overlay.open(
        c.addTag,
        `<form class="prompt-form"><label>${e(c.parsed)}<select name="key">${Object.entries(
          c.labels,
        )
          .map(([key, label]) => `<option value="${key}">${e(label)}</option>`)
          .join(
            "",
          )}</select><input name="tag" required maxlength="30" autofocus aria-label="${e(c.addTag)}"></label><div class="button-row"><button class="btn btn-primary" type="submit">${e(common.confirm)}</button></div></form>`,
      );
      modal.querySelector("form").onsubmit = (event) => {
        event.preventDefault();
        const key = modal.querySelector("select").value;
        const value = modal.querySelector("input").value.trim();
        if (!value) return;
        if (key === "city") draft.intent.city = value;
        else {
          if (!draft.intent[key]) draft.intent[key] = [];
          if (!draft.intent[key].includes(value)) draft.intent[key].push(value);
        }
        ctx.overlay.close();
        render();
      };
    }
    function render() {
      clearTimeout(intentTimer);
      intentController?.abort();
      root.innerHTML =
        `<div class="breadcrumb"><a href="#/events/${eventId}">${icon("back")} ${e(event.title)}</a></div>` +
        `<p class="version-warning" data-version-warning hidden></p>` +
        `<div class="join-layout"><section class="join-editor panel"><div class="join-steps">${c.steps.map((label, index) => `<button class="${index === step ? "active" : index < step ? "done" : ""}" data-step="${index}" ${index === step ? 'aria-current="step"' : ""}><span>${index < step ? icon("check") : index + 1}</span>${e(label)}</button>`).join("")}</div>
        <div class="join-step-content">${stepContent()}</div><div class="join-actions">${step ? ui.button(common.previous, "data-previous", "secondary", "back") : "<span></span>"}${ui.button(step === 2 ? c.finish : common.next, "data-next", "primary", "arrow")}</div></section>
        <aside class="join-preview">${preview()}</aside></div>`;
      root.querySelectorAll("[data-step]").forEach(
        (button) =>
          (button.onclick = () => {
            step = Number(button.dataset.step);
            render();
          }),
      );
      root.querySelectorAll("[data-version]").forEach(
        (button) =>
          (button.onclick = () => {
            draft.versionId = button.dataset.version;
            render();
          }),
      );
      root.querySelector("[data-next]").onclick = () => {
        if (step < 2) {
          step++;
          render();
          return;
        }
        store.update((state) => {
          state.participations[eventId] = store.clone(draft);
        });
        ctx.router.go("/events/" + eventId + "/match");
      };
      const previous = root.querySelector("[data-previous]");
      if (previous)
        previous.onclick = () => {
          step--;
          render();
        };
      const newVersion = root.querySelector("[data-new-version]");
      if (newVersion)
        newVersion.onclick = () =>
          ctx.overlay.prompt(config.copy.cards.namePrompt, "", (name) => {
            const version = store.clone(store.get().me.versions[0]);
            version.id = "custom-" + Date.now();
            version.name = name;
            store.update((state) => state.me.versions.push(version));
            draft.versionId = version.id;
            render();
          });
      const textarea = root.querySelector("#intent-text");
      if (textarea) {
        let revision = 0;
        const update = () => {
          draft.intentText = textarea.value;
          draft.intent = engine.parseIntent(textarea.value, store.get().me.profile);
          intentEngine = 'local';
          root.querySelector('[data-intent-engine]').textContent = config.llm.intentLabels[intentEngine];
          root.querySelector(".join-parsed-tags").innerHTML = tagList();
          bindTags();
          updatePreview();
          consent(); editor.refresh();
          const current = ++revision;
          const source = textarea.value;
          const baseline = JSON.stringify(draft.intent);
          clearTimeout(intentTimer);
          intentController?.abort();
          intentController = new AbortController();
          const signal = intentController.signal;
          intentTimer = setTimeout(async () => {
            const parsed = await ctx.llm.parseIntent(source, { ownProfile: store.get().me.profile, signal });
            if (current !== revision || !textarea.isConnected || JSON.stringify(draft.intent) !== baseline) return;
            draft.intent = parsed.intent;
            intentEngine = parsed.engine;
            root.querySelector('[data-intent-engine]').textContent = config.llm.intentLabels[intentEngine];
            root.querySelector('.join-parsed-tags').innerHTML = tagList();
            bindTags();
            updatePreview();
            consent(); editor.refresh(); editor.version();
          }, 450);
        };
        textarea.oninput = update;
        root.querySelectorAll("[data-template]").forEach(
          (button) =>
            (button.onclick = () => {
              textarea.value =
                config.templates[Number(button.dataset.template)][1];
              update();
            }),
        );
        root.querySelector("[data-add-tag]").onclick = addTag;
        root.querySelector("[data-mic]").onclick = () => {
          const wave = root.querySelector(".join-wave");
          wave.hidden = false;
          ctx.overlay.toast(c.mic);
          clearTimeout(micTimer);
          micTimer = setTimeout(() => {
            wave.hidden = true;
          }, 2200);
        };
        bindTags();
      }
      root.querySelectorAll('input[type="checkbox"]').forEach(
        (input) =>
          (input.onchange = () => {
            draft[input.name] = input.checked;
            updatePreview();
          }),
      );
      consent(); editor.refresh(); editor.version();
    }
    render();
    ctx.llm.checkVersion().then(() => { if(root.isConnected) editor.version(); });
    return () => { clearTimeout(micTimer); clearTimeout(intentTimer); intentController?.abort(); };
  };
})(window.BJ);
