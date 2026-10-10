(function (BJ) {
  BJ.attendees = function (ctx, eventId, { wall = false } = {}) {
    const { service, config, ui } = ctx;
    const c = config.copy.events;
    const attendance = service.attendance(eventId);
    const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key]);
    const limit = wall ? config.app.attendeeWallLimit : config.app.attendeeCardLimit;
    const people = attendance.people.slice(0, limit);
    const rest = attendance.people.length - people.length;
    const avatars = people.map(person => {
      const title = [person.profile.name || config.copy.common.anonymous, person.profile.title].filter(Boolean).join(' · ');
      const image = ui.avatar(person.profile);
      return wall
        ? `<button class="attendee-avatar" data-open-person="${ui.e(person.id)}" title="${ui.e(title)}" aria-label="${ui.e(title)}">${image}<span class="attendee-tooltip">${ui.e(title)}</span></button>`
        : `<span class="attendee-mini" title="${ui.e(title)}">${image}</span>`;
    }).join('');
    return {
      counts: fill(c.attendance, attendance),
      note: attendance.enrolled > attendance.people.length ? fill(c.publicAttendees, { count: attendance.people.length }) : '',
      avatars: wall ? `<div class="attendee-wall">${avatars}${rest > 0
        ? `<span class="attendee-more" title="${ui.e(fill(c.moreAttendees, { count: rest }))}">+${rest}</span>` : ''}</div>`
        : `<span class="attendee-stack">${avatars}</span>`,
    };
  };
})(window.BJ);
