(function (BJ) {
  BJ.pages.jobs = function (ctx, root, requested) {
    const { config, data, ui, service, store, engine } = ctx;
    const c = config.copy.jobs;
    const { e, icon } = ui;
    let query = "";
    let city =
      store.get().city === config.copy.common.allCities ? "" : store.get().city;
    let sort = 0;
    let filters = {};
    function jobRow(job) {
      const company = service.company(job.companyId);
      const recruiter = engine.project(
        service.publicPerson(job.recruiterId, job.eventId),
      ).profile;
      const fit = service.jobFit(job);
      return `<article class="jobs-row"><button class="jobs-row-open" data-job="${job.id}" aria-label="${e(config.copy.common.view + " " + job.title)}">
        <div class="jobs-row-main"><div class="jobs-row-title"><h3>${e(job.title)}</h3><span>${e(job.city + " · " + job.district)}</span><strong>${e(job.salary)}</strong></div>
        ${ui.tags([job.experience, job.education, ...job.requirements.slice(0, 2)])}
        <div class="jobs-recruiter">${ui.avatar(recruiter, "avatar-sm")}<span>${e(recruiter.name)} · ${e(job.recruiterTitle)}</span>${job.online ? `<span class="online-dot"></span><small>${e(c.online)}</small>` : ""}</div></div>
        <div class="jobs-company">${ui.media("logos", company.id, company.name)}<div><h4>${e(company.name)}</h4><p>${e(company.industry + " · " + company.stage + " · " + company.size)}</p></div></div></button>
        <div class="jobs-row-bottom"><div class="jobs-benefits">${job.benefits.map((value) => `<span>${e(value)}</span>`).join("")}</div><div class="jobs-fit"><span>${e(c.fit)} <b>${fit.score}%</b></span>${job.referralIds.some(id => service.referralSameEvent(job, id)) ? `<button data-job="${job.id}">${icon("users")}${e(c.referral)}</button>` : ""}</div></div></article>`;
    }
    function openJob(id) {
      const job = data.jobs.find((item) => item.id === id);
      if (!job) return;
      const company = service.company(job.companyId);
      const fit = service.jobFit(job);
      const applied = !!store.get().applications[id];
      const modal = ctx.overlay.open(
        job.title,
        `<div class="jobs-detail-top"><span>${e(job.city + " · " + company.name)}</span><strong>${e(job.salary)}</strong></div>
        ${ui.tags([job.experience, job.education, company.stage])}<section class="jobs-detail-section"><h3>${e(c.jd)}</h3><ol>${job.description.map((line) => `<li>${e(line)}</li>`).join("")}</ol></section>
        <section class="jobs-detail-section"><div class="section-head"><h3>${e(c.requirements)}</h3><b class="jobs-fit-score">${fit.score}%</b></div><p>${fit.matched}/${fit.items.length} ${e(c.satisfied)}</p><div class="jobs-requirements">${fit.items.map((item) => `<div>${icon(item.met ? "check" : "minus")}<span>${e(item.label)}</span><small>${item.met ? "" : e(c.unmet)}</small></div>`).join("")}</div></section>
        <section class="jobs-detail-section"><h3>${e(c.contacts)}</h3><div class="jobs-referrals">${
          job.referralIds
            .map((id) => {
              const person = service.publicPerson(id, job.eventId);
              const p = engine.project(person).profile;
              const sameEvent = service.referralSameEvent(job, id);
              return `<button data-referral="${id}">${ui.avatar(p)}<span><b>${e(p.name)}</b><small>${e(p.title)} · ${sameEvent ? c.sameEvent : c.secondDegree}</small></span>${icon("arrow")}</button>`;
            })
            .join("") || `<p class="muted small">${e(c.noReferral)}</p>`
        }</div></section>
        <div class="jobs-detail-actions">${ui.button(c.chat, "data-job-chat", "secondary", "message")}${ui.button(applied ? c.applied : c.apply, `data-job-apply ${applied ? "disabled" : ""}`, "primary", "arrow")}</div>`,
        { className: "jobs-drawer" },
      );
      modal.querySelector("[data-job-chat]").onclick = () => {
        if (!store.get().communications.includes(id))
          store.update((state) => state.communications.push(id));
        ctx.overlay.toast(c.chatToast);
      };
      modal.querySelector("[data-job-apply]").onclick = () => {
        const me = store.get().me;
        const version =
          me.versions.find((v) => v.id === "career") ||
          me.versions.find((v) => v.name === c.careerVersion);
        if (!version) {
          ctx.overlay.toast(c.missingVersion);
          return;
        }
        const snapshot = service.careerProjection().profile;
        store.update((state) => {
          state.applications[id] = {
            date: new Date().toISOString(),
            versionId: version.id,
            profile: store.clone(snapshot),
          };
        });
        modal.querySelector("[data-job-apply] span").textContent = c.applied;
        modal.querySelector("[data-job-apply]").disabled = true;
        ctx.overlay.toast(c.applyToast);
      };
      modal
        .querySelectorAll("[data-referral]")
        .forEach(
          (button) =>
            (button.onclick = () => ctx.person.open(button.dataset.referral, job.eventId)),
        );
    }
    function results() {
      const normalized = query.trim().toLowerCase();
      let jobs = data.jobs.filter(
        (job) =>
          (!city ||
            city === config.copy.common.allCities ||
            job.city === city) &&
          (!normalized ||
            [
              job.title,
              service.company(job.companyId).name,
              ...job.requirements,
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalized)) &&
          Object.entries(filters).every(
            ([key, value]) => !value || job[key] === value,
          ),
      );
      if (sort === 2) jobs = jobs.filter((job) => job.referralIds.length);
      jobs.sort((a, b) =>
        sort === 1
          ? b.published - a.published
          : service.jobFit(b).score - service.jobFit(a).score,
      );
      root.querySelector(".jobs-total").innerHTML =
        `<b>${jobs.length}</b> ${e(c.total)}` +
        (jobs.length < data.jobs.length ? e(c.ofAll.replace("{count}", data.jobs.length)) : "");
      root.querySelector(".jobs-list").innerHTML = jobs.length
        ? jobs.map(jobRow).join("")
        : ui.empty(
            undefined,
            undefined,
            ui.button(config.copy.common.reset, "data-reset-jobs", "secondary"),
          );
      root
        .querySelectorAll("[data-job]")
        .forEach(
          (button) => (button.onclick = () => openJob(button.dataset.job)),
        );
      const reset = root.querySelector("[data-reset-jobs]");
      if (reset)
        reset.onclick = () => {
          query = "";
          city = "";
          filters = {};
          sort = 0;
          render();
        };
    }
    function render() {
      root.innerHTML =
        `<section class="jobs-search-panel"><form class="jobs-search-form"><div class="jobs-search-input">${icon("search")}<input id="jobs-query" aria-label="${e(c.placeholder)}" placeholder="${e(c.placeholder)}" value="${e(query)}"></div>${ui.select(
          "job-city",
          config.copy.common.allCities,
          config.app.cities.filter(
            (item) => item !== config.copy.common.allCities,
          ),
          city,
        )}<button class="btn btn-primary" type="submit">${e(c.search)}${icon("arrow")}</button></form>
        <div class="jobs-filters">${config.jobFilters.map((filter) => ui.select(filter.key, filter.label, filter.values, filters[filter.key])).join("")}${ui.button(config.copy.common.reset, "data-clear-filters", "text")}</div></section>
        <div class="jobs-results-heading"><div class="tabs" role="tablist" aria-label="${e(c.sortLabel)}">${c.sorts.map((label, index) => `<button role="tab" aria-selected="${sort === index}" data-job-sort="${index}" class="${sort === index ? "active" : ""}">${e(label)}</button>`).join("")}</div><span class="jobs-total"></span></div>
        <section class="jobs-list" aria-label="${e(c.listLabel)}"></section>`;
      root.querySelector("form").onsubmit = (event) => {
        event.preventDefault();
        query = root.querySelector("#jobs-query").value;
        results();
      };
      root.querySelector("#jobs-query").oninput = (event) => {
        query = event.target.value;
        results();
      };
      root.querySelector('[name="job-city"]').onchange = (event) => {
        city = event.target.value;
        results();
      };
      root.querySelectorAll(".jobs-filters select").forEach(
        (select) =>
          (select.onchange = () => {
            filters[select.name] = select.value;
            results();
          }),
      );
      root.querySelectorAll("[data-job-sort]").forEach(
        (button) =>
          (button.onclick = () => {
            sort = Number(button.dataset.jobSort);
            render();
          }),
      );
      root.querySelector("[data-clear-filters]").onclick = () => {
        filters = {};
        query = "";
        city = "";
        render();
      };
      results();
    }
    render();
    if (requested) openJob(requested);
  };
})(window.BJ);
