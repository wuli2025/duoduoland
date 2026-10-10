(function (BJ) {
  BJ.createService = function (config, data, store, engine) {
    const event = (id) => data.events.find((item) => item.id === id);
    const company = (id) => data.companies.find((item) => item.id === id);
    const getPerson = (id) => data.people.find((item) => item.id === id);
    const currentSession = (eventId) =>
      store.get().participations[eventId] || {
        ...store.clone(data.defaultParticipation),
        status: "registered",
        versionId: store.get().me.versions[0].id,
      };
    const me = (eventId) => {
      const person = store.get().me, session = currentSession(eventId);
      return { ...person, session: { ...session, intent: engine.resolveIntent(session.intent, session.intentText, person.profile) } };
    };
    const participants = (eventId) =>
      data.people
        .filter((person) => person.sessions[eventId])
        .map((person) => ({ ...person, session: person.sessions[eventId] }));
    const publicPerson = (id, eventId = config.app.defaultEvent) => {
      const person = getPerson(id);
      return person
        ? engine.project({ ...person, session: person.sessions[eventId] || {} })
        : null;
    };
    function attendance(eventId) {
      const people = participants(eventId).map(person => engine.project(person))
        .filter(person => person.visibleFields.length > 0)
        .sort((a, b) => Number(b.status === 'checked_in') - Number(a.status === 'checked_in'));
      return { enrolled: Math.max(event(eventId)?.count || 0, participants(eventId).length),
        checked: people.filter(person => person.status === 'checked_in').length, people };
    }
    function rank(eventId, options = {}) {
      const state = store.get();
      const dislikes = Object.entries(state.feedback)
        .filter(
          ([key, value]) =>
            key.startsWith(eventId + ":") && value.type === "down",
        )
        .map(([key]) => key.slice(eventId.length + 1));
      return engine.rank(me(eventId), participants(eventId), {
        met: state.met,
        greeted: state.greeted,
        ...options,
        exclude: [...dislikes, ...(options.exclude || [])],
      });
    }
    function related(eventId) {
      return rank(eventId, { limit: data.people.length }).filter(
        (row) => row.score >= config.app.relatedThreshold,
      ).length;
    }
    function datingInfo(eventId) {
      const own = me(eventId), query = own.session.intent;
      if (query?.mode !== 'dating') return null;
      const projected = engine.project(own);
      const ready = BJ.dating.ready(projected);
      const count = id => participants(id).filter(p => BJ.dating.eligible(projected, engine.project(p), query)).length;
      const n = ready ? count(eventId) : 0;
      return { ready, count: n, alternatives: ready && n < config.matching.topK ? data.events
        .filter(item => item.id !== eventId).map(item => ({ id: item.id, title: item.title, count: count(item.id) }))
        .filter(item => item.count > n).sort((a, b) => b.count - a.count).slice(0, 3) : [] };
    }
    function eventRelevance(item) {
      const person = me(item.id);
      const profile = engine.project(person).profile;
      const text = Object.values(profile).flat().join(" ");
      return (
        item.tags.filter((tag) =>
          engine.matches(tag, text, config.synonyms.industries),
        ).length *
          10 +
        related(item.id)
      );
    }
    function careerProjection() {
      const person = store.get().me;
      const version = person.versions.find(v => v.id === 'career') ||
        person.versions.find(v => v.name === config.copy.jobs.careerVersion);
      return { versionId: version && version.id,
        ...engine.project({ ...person, session: { versionId: version && version.id } }) };
    }
    function referralSameEvent(job, personId) {
      return !!(job.eventId && store.get().participations[job.eventId] &&
        getPerson(personId)?.sessions[job.eventId]);
    }
    function discoveryFlag(id, key) {
      return ['interested', 'viewed'].includes(key) && !!getPerson(id)?.[key];
    }
    function directory() {
      return data.people.map(person => {
        const eventId = person.sessions[config.app.defaultEvent] ? config.app.defaultEvent : Object.keys(person.sessions)[0];
        return { ...publicPerson(person.id, eventId), eventId };
      });
    }
    function jobFit(job) {
      const profile = careerProjection().profile;
      const text = [
        profile.skills,
        profile.projects,
        profile.experience,
        profile.industry,
        profile.title,
      ]
        .flat()
        .join(" ");
      const items = job.requirements.map((requirement) => ({
        label: requirement,
        met: engine.matches(requirement, text, { ...config.synonyms.industries, ...config.synonyms.roles, ...config.synonyms.offers }),
      }));
      const matched = items.filter((item) => item.met).length;
      return {
        items,
        matched,
        score: items.length ? Math.round(matched / items.length * 100) : 0,
      };
    }
    return {
      event,
      company,
      getPerson,
      me,
      participants,
      attendance,
      commonTags: (id, mode) => BJ.intentTools.tags(participants(id).map(p => engine.project(p)), mode),
      datingInfo,
      rank,
      related,
      eventRelevance,
      jobFit,
      careerProjection,
      referralSameEvent,
      discoveryFlag,
      directory,
      currentSession,
      publicPerson,
    };
  };
})(window.BJ);
