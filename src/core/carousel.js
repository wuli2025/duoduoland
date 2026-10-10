(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BJ.carousel = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const wrap = (index, length) => length ? ((index % length) + length) % length : 0;
  function sources(events, heroes, now = new Date()) {
    // Activity dates are Shanghai calendar dates; do not depend on the visitor's timezone.
    const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
    const monday = new Date(today + 'T00:00:00Z');
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const start = monday.toISOString().slice(0, 10);
    monday.setUTCDate(monday.getUTCDate() + 6);
    const end = monday.toISOString().slice(0, 10);
    return {
      featured: heroes.map(hero => {
        const event = events.find(item => item.id === hero.eventId);
        return event && {...event, coverGroup: 'bg', cover: hero.image};
      }).filter(Boolean),
      week: events.filter(item => item.startDate >= start && item.startDate <= end)
        .slice().sort((a, b) => a.startDate.localeCompare(b.startDate) || a.date.localeCompare(b.date)),
      ranking: events.slice().sort((a, b) => b.count - a.count),
    };
  }
  function create(groups, initial = 'featured') {
    let tab = initial, index = 0;
    const get = () => ({tab, index, slides: groups[tab] || []});
    return {get, select(next) { if (Object.hasOwn(groups, next)) {tab = next; index = 0;} return get(); },
      move(delta) {index = wrap(index + delta, get().slides.length); return get();},
      go(next) {index = wrap(next, get().slides.length); return get();}};
  }
  return {wrap, sources, create};
});
