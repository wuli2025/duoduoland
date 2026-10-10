(function (BJ) {
  BJ.pages.eventDetail = function (ctx, root, id) {
    const { config, ui, service, store, engine } = ctx;
    const item = service.event(id);
    if (!item) return ctx.notFound(root);
    const company = service.company(item.companyId);
    const c = config.copy.events;
    const joined = !!store.get().participations[id];
    const path = "/events/" + item.id;
    const attendees = BJ.attendees(ctx, id, { wall: true });
    root.innerHTML = `<div class="breadcrumb"><a href="#/events">${ui.e(config.copy.common.back)}</a>${ui.icon("chevron")}<span>${ui.e(item.category)}</span></div>
      <div class="event-detail-grid"><div>${ui.media("events", item.image, item.title, "event-detail-cover", true)}
        <h1 class="event-detail-title">${ui.e(item.title)}</h1><div class="event-detail-meta">
          <div>${ui.icon("calendar")}${ui.e(item.date)} — ${ui.e(item.endTime)}</div><div>${ui.icon("pin")}${ui.e(item.city + " · " + item.venue)}</div></div>
        ${ui.tags(item.tags)}<section class="event-detail-article"><h2>${ui.e(c.about)}</h2><p>${ui.e(item.description)}</p></section>
        <section class="event-detail-article"><div class="section-head"><h2>${ui.e(c.attendees)}</h2></div>
          <p class="attendee-counts">${ui.e(attendees.counts)}</p>${attendees.avatars}
          <p class="small muted">${ui.e(attendees.note)}</p><p class="small muted">${ui.e(c.attendanceNote)}</p></section>
        <section class="event-detail-article"><h2>${ui.e(c.agenda)}</h2><div class="event-detail-agenda">${item.agenda.map(([time, description]) => `<b>${ui.e(time)}</b><span>${ui.e(description)}</span>`).join("")}</div></section>
      </div><aside class="panel event-reservation"><div class="eyebrow">${ui.e(c.reservationLabel)}</div><div class="price">${item.price ? "¥" + item.price : ui.e(config.copy.common.free)}</div><p>${ui.e(c.reserveNote)}</p>
        <a class="btn btn-primary btn-block" href="#${path + (joined ? "/match" : "/join")}">${ui.e(joined ? config.copy.common.joined + " · " + c.viewMatches : config.copy.common.join)}${ui.icon("arrow")}</a>
        ${joined ? `<a class="btn btn-secondary btn-block" href="#${path}/join">${ui.e(config.copy.match.edit)}</a>` : ""}
        <hr class="divider"><div class="event-host">${ui.media("logos", company.id, company.name)}<div><b>${ui.e(company.name)}</b><small>${ui.e(c.organizer)} ${ui.icon("verified")}</small></div></div>
        <hr class="divider"><div class="button-row">${ui.icon("lock")}<small class="muted">${ui.e(c.privacyNote)}</small></div>
      </aside></div>`;
    root
      .querySelectorAll("[data-open-person]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            ctx.person.open(button.dataset.openPerson, id)),
      );
  };
})(window.BJ);
