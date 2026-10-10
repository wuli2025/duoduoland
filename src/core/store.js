(function (BJ) {
  BJ.createStore = function (config, data) {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const initial = {
      schema: 1,
      me: clone(data.me),
      city: config.app.defaultCity,
      participations: {
        [config.app.defaultEvent]: clone(data.defaultParticipation),
      },
      greeted: [],
      met: [],
      favorites: [],
      feedback: {},
      applications: {},
      communications: [],
    };
    let state = clone(initial);
    let failed = false;
    let loadError = null;
    try {
      const saved = JSON.parse(
        localStorage.getItem(config.app.storageKey) || "null",
      );
      if (
        saved &&
        saved.schema === 1 &&
        saved.me &&
        saved.me.profile &&
        Array.isArray(saved.me.versions) &&
        saved.me.versions.length &&
        saved.me.versions.every((v) => v.id && Array.isArray(v.visibleFields))
      ) {
        state = Object.assign(state, saved);
        ["greeted", "met", "favorites", "communications"].forEach((key) => {
          if (!Array.isArray(state[key])) state[key] = [];
        });
        ["feedback", "applications", "participations"].forEach((key) => {
          if (
            !state[key] ||
            typeof state[key] !== "object" ||
            Array.isArray(state[key])
          )
            state[key] = {};
        });
      } else if (saved) throw new Error('INVALID_STORAGE_SCHEMA');
    } catch (error) {
      failed = true;
      loadError = error;
      window.dispatchEvent(new CustomEvent('bj:storage-error', { detail: error }));
    }
    if (BJ.datingSettings && data.me.versions.some(v => v.id === 'dating')) BJ.datingSettings.migrate(state, data.me);
    function persist() {
      try {
        localStorage.setItem(config.app.storageKey, JSON.stringify(state));
        return true;
      } catch (error) {
        window.dispatchEvent(new CustomEvent("bj:storage-error", { detail: error }));
        return false;
      }
    }
    function update(mutator) {
      mutator(state);
      const saved = persist();
      window.dispatchEvent(new CustomEvent("bj:state", { detail: state }));
      return saved;
    }
    function toggle(key, id) {
      return update((current) => {
        current[key] = current[key].includes(id)
          ? current[key].filter((x) => x !== id)
          : [...current[key], id];
      });
    }
    return { get: () => state, update, toggle, clone, loadFailed: failed, loadError };
  };
})(window.BJ);
