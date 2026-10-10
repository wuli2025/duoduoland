(function (root, factory) {
  if (typeof module !== "undefined" && module.exports)
    module.exports = factory(require('./dating'), require('./intent-tools'));
  else root.BJ.matcher = factory(root.BJ.dating, root.BJ.intentTools);
})(typeof window !== "undefined" ? window : globalThis, function (dating, intents) {
  "use strict";
  const blankIntent = () => ({
    seekRoles: [],
    seekIndustries: [],
    offer: [],
    city: "",
  });
  const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  const flatten = (value) => list(value).map(String).join(" ");
  const bounded = (n) => Math.max(0, Math.min(1, n));
  const extraIntentKeys = ['seekSkills', 'cooperation', 'markets', 'availability', 'compensation', 'employment'];
  const cleanIntent = (value) => ({
    seekRoles: list(value && value.seekRoles),
    seekIndustries: list(value && value.seekIndustries),
    offer: list(value && value.offer),
    city: String((value && value.city) || ""),
    ...dating.intent(value || {}),
    ...Object.fromEntries(extraIntentKeys.filter(key => value && value[key] !== undefined)
      .map(key => [key, list(value[key])])),
  });

  // Every scoring, similarity and explanation path starts at this projection.
  // A missing version fails closed: no implicit access to the base profile.
  function project(person) {
    if (person && person.public) return project(person.public);
    person = person || {};
    const projectionKeys = ['id', 'profile', 'visibleFields', 'intent', 'status', 'openToChat', 'cardType'];
    const projected = !person.versions && Array.isArray(person.visibleFields) &&
      person.intent && typeof person.intent === 'object' && person.profile &&
      typeof person.profile === 'object' && !Array.isArray(person.profile) &&
      Object.keys(person).every(key => projectionKeys.includes(key));
    if (projected) return {
      id: person.id,
      profile: Object.fromEntries(Object.entries(person.profile).filter(([key]) => person.visibleFields.includes(key) && (!dating.cfg.fields.includes(key) || person.cardType === 'dating'))),
      ...(person.cardType === 'dating' ? { cardType: 'dating' } : {}),
      visibleFields: person.visibleFields.slice(), intent: cleanIntent(person.intent),
      status: person.status, openToChat: person.openToChat === true,
    };
    const session = person.session || {};
    const version = (person.versions || []).find(
      (v) => v.id === session.versionId,
    );
    const profile = {};
    (version ? version.visibleFields : []).filter(key => !dating.cfg.fields.includes(key) || version.id === 'dating').forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(person.profile || {}, key)) {
        profile[key] =
          key === "bio" && typeof version.bio === "string"
            ? version.bio
            : version.id === 'dating' && version.datingProfile?.[key] !== undefined ? version.datingProfile[key] : person.profile[key];
        if (key === 'datingOpen') profile[key] = person.profile.datingOpen === true && session.datingOpen === true;
      }
    });
    return {
      id: person.id,
      profile,
      ...(version?.id === 'dating' ? { cardType: 'dating' } : {}),
      visibleFields: Object.keys(profile),
      intent:
        session.publicIntent === true
          ? cleanIntent(session.intent)
          : blankIntent(),
      status: session.status,
      openToChat: session.openToChat === true,
    };
  }

  function create(config) {
    const cfg = config.matching;
    const lex = config.synonyms;
    const templates = config.reasons;
    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[\s·、，,：:]/g, "");
    function contains(text, word) {
      const source = String(text || "").toLowerCase();
      const alias = String(word).toLowerCase();
      if (/^[a-z]{1,3}$/.test(alias)) {
        return new RegExp("(^|[^a-z])" + alias + "([^a-z]|$)").test(source);
      }
      return normalize(source).includes(normalize(alias));
    }
    function concepts(text, dict) {
      return Object.entries(dict)
        .filter(([key, aliases]) =>
          [key].concat(aliases).some((alias) => contains(text, alias)),
        )
        .map(([key]) => key);
    }
    function parseIntent(text, own = {}) {
      const source = String(text || "");
      const romantic = dating.parse(source, own.profile || own);
      if (romantic) return { ...blankIntent(), ...romantic };
      let boundary = source.length;
      let separatorLength = 0;
      lex.offerSeparators.forEach((separator) => {
        const index = source.indexOf(separator);
        if (index >= 0 && index < boundary) {
          boundary = index;
          separatorLength = separator.length;
        }
      });
      const seek = source.slice(0, boundary).split(new RegExp(lex.intentClauses || '[，,；;。]'))
        .filter(clause => !lex.intentNegation || !new RegExp(lex.intentNegation, 'i').test(clause)).join('，');
      const offer = separatorLength
        ? source.slice(boundary + separatorLength)
        : "";
      return {
        seekRoles: concepts(seek, lex.roles),
        seekIndustries: concepts(seek, lex.industries),
        offer: concepts(offer, lex.offers),
        city: lex.cities.find((city) => contains(seek, city)) || "",
        ...(() => {
          const extended = {};
          const skills = concepts(seek, lex.skills || {});
          if (skills.length) extended.seekSkills = skills;
          for (const [key, values] of Object.entries(lex.preferences || {})) {
            const found = values.filter(value => contains(seek, value));
            if (found.length) extended[key] = found;
          }
          for (const rule of lex.intentRules || []) {
            if (new RegExp(rule.pattern, 'i').test(seek))
              extended[rule.field] = [...new Set([...(extended[rule.field] || []), ...rule.values])];
          }
          return extended;
        })(),
      };
    }
    const profileText = (profile) =>
      Object.entries(profile)
        .filter(
          ([key]) => !["avatar", "contact", "website", "name", ...dating.cfg.fields].includes(key),
        )
        .map(([, value]) => flatten(value))
        .join(" ");
    function matches(term, text, dictionary) {
      const canonical = Object.keys(dictionary).find(
        (key) =>
          normalize(key) === normalize(term) ||
          dictionary[key].some((v) => normalize(v) === normalize(term)),
      );
      return (
        canonical ? [canonical].concat(dictionary[canonical]) : [term]
      ).some((alias) => contains(text, alias));
    }
    function need(intent, profile) {
      const text = profileText(profile);
      const roles = list(intent.seekRoles);
      const industries = list(intent.seekIndustries);
      const technical = list(intent.seekSkills);
      const hasPreferences = extraIntentKeys.slice(1).some(key => list(intent[key]).length);
      if (!roles.length && !industries.length && !technical.length && !hasPreferences) return cfg.fallbackNeed;
      const roleText = [profile.title, profile.company].filter(Boolean).join(" ");
      const roleHit = roles.length ? roles.filter((role) =>
        matches(role, roleText, lex.roles)).length / roles.length : 0;
      const industryHit = industries.filter((term) =>
        matches(term, text, lex.industries),
      ).length;
      const industryScore = industries.length
        ? industryHit / industries.length
        : 0;
      const cityFactor =
        intent.city && profile.city && intent.city !== profile.city ? 0.6 : 1;
      let relevance = roles.length && industries.length
          ? 0.65 * roleHit + 0.35 * industryScore
          : roles.length
            ? roleHit
            : industries.length ? industryScore : cfg.fallbackNeed;
      if (technical.length) {
        const coverage = technical.filter(term => matches(term, flatten(profile.skills), lex.skills || {})).length / technical.length;
        relevance = (1 - cfg.technicalWeight) * relevance + cfg.technicalWeight * coverage;
      }
      let compatibility = 1;
      for (const key of extraIntentKeys.slice(1)) {
        const wanted = list(intent[key]);
        if (!wanted.length) continue;
        const offered = list(profile[key]);
        compatibility *= !offered.length ? cfg.unknownPreference :
          wanted.some(term => offered.some(value => normalize(term) === normalize(value))) ? 1 : cfg.conflictingPreference;
      }
      return bounded(relevance * compatibility * cityFactor);
    }
    function tokens(profile) {
      const text = profileText(profile);
      return new Set(
        [
          ...concepts(text, lex.roles),
          ...concepts(text, lex.industries),
          ...list(profile.skills).map(normalize),
          ...list(profile.interests).map(normalize),
          profile.city,
          profile.company,
        ].filter(Boolean),
      );
    }
    function jaccard(a, b) {
      const union = new Set([...a, ...b]);
      if (!union.size) return 0;
      return [...a].filter((value) => b.has(value)).length / union.size;
    }
    function common(a, b) {
      const left = {};
      const right = {};
      Object.keys(a).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(b, key)) {
          left[key] = a[key];
          right[key] = b[key];
        }
      });
      return jaccard(tokens(left), tokens(right));
    }
    function complement(a, b) {
      function direction(source, target) {
        const seeks = target.intent.seekRoles;
        if (!seeks.length) return 0;
        return seeks.filter((seek) => source.intent.offer.some((offer) =>
          contains(seek, offer) || cfg.complementPairs.some(([resource, role]) =>
            contains(offer, resource) && contains(seek, role)))) .length / seeks.length;
      }
      return (direction(a, b) + direction(b, a)) / 2;
    }
    function reason(a, b, factors, ownIntent) {
      const pa = project(a);
      const pb = project(b);
      const text = profileText(pb.profile);
      const wanted = cleanIntent(ownIntent || (a.session && a.session.intent));
      const role = wanted.seekRoles.find((value) =>
        matches(value, text, lex.roles),
      );
      const publicRole = concepts(pa.profile.title || '', lex.roles)[0];
      const requestedSkill = list(pb.profile.skills).find(skill => list(wanted.seekSkills)
        .some(term => matches(term, skill, lex.skills || {})));
      const topic = requestedSkill || list(pb.profile.skills)[0] || pb.profile.industry ||
        pb.intent.offer[0] || pb.profile.experience || pb.profile.bio;
      const values = {
        role: role || templates.person,
        myRole: publicRole || templates.person,
        topic: topic || templates.topic,
        name: pb.profile.name || templates.person,
        detail: pb.profile.experience || pb.profile.industry || topic || templates.topic,
      };
      let template = templates.fallback;
      if (
        factors.needAB >= cfg.mutualThreshold &&
        factors.needBA >= cfg.mutualThreshold &&
        role
      )
        template = templates.mutual;
      else if (factors.needAB >= cfg.mutualThreshold && topic)
        template = templates.need;
      else if (factors.common > cfg.commonThreshold && topic) template = templates.common;
      const variants = list(template);
      const hash = [...String(b.id)].reduce((n, ch) => n + ch.charCodeAt(0), 0);
      template = variants[hash % variants.length];
      const fill = (value) =>
        value.replace(/\{(\w+)\}/g, (_, key) => values[key] || "");
      return {
        reason: fill(template),
        icebreaker: topic
          ? fill(templates.icebreaker)
          : templates.icebreakerFallback,
      };
    }
    function score(a, b, options = {}) {
      let pa = project(a);
      let pb = project(b);
      // The initiating person can privately express a search. The recipient's
      // private intent never contributes to a score or generated explanation.
      const ownIntent = cleanIntent(
        options.queryIntent || (a.session || {}).intent || a.intent,
      );
      if (ownIntent.mode === 'dating') return dating.eligible(pa, pb, ownIntent) ? dating.score(pa, pb, ownIntent, options) :
        { id: b.id, public: pb, score: 0, eligible: false, reason: dating.cfg.copy.blocked, factors: {} };
      pa = dating.professional(pa); pb = dating.professional(pb);
      const base = cfg.weights;
      const preference =
        options.preference == null ? 0.5 : bounded(options.preference);
      const weights = Object.assign({}, base, options.weights);
      if (options.preference != null) {
        weights.needAB += (preference - 0.5) * 0.2;
        weights.complement += (preference - 0.5) * 0.1;
        weights.common -= (preference - 0.5) * 0.2;
        weights.needBA -= (preference - 0.5) * 0.1;
      }
      const factors = {
        needAB: need(ownIntent, pb.profile),
        needBA: need(pb.intent, pa.profile),
        complement: complement({ ...pa, intent: ownIntent }, pb),
        common: common(pa.profile, pb.profile),
        reach: bounded(
          (pb.status === "checked_in"
            ? 0.75
            : pb.status === "registered"
              ? 0.45
              : 0.1) + (pb.openToChat ? 0.25 : 0),
        ),
        quality: bounded(
          Object.values(pb.profile).filter((v) => flatten(v).trim()).length /
            cfg.qualityFields,
        ),
        fresh:
          list(options.met).includes(b.id) ||
          list(options.greeted).includes(b.id)
            ? 0.15
            : 1,
      };
      const boost =
        1 + cfg.mutualBoost * Math.min(factors.needAB, factors.needBA);
      const weightTotal = Object.values(weights).reduce((sum, n) => sum + Math.max(0, n), 0);
      const raw =
        Object.keys(factors).reduce(
          (sum, key) => sum + Math.max(0, weights[key] || 0) * factors[key],
          0,
        ) *
        boost / (weightTotal || 1) / cfg.boostCeiling;
      return Object.assign(
        {
          id: b.id,
          public: pb,
          interaction: { greeted: list(options.greeted).includes(b.id), met: list(options.met).includes(b.id) },
          score: Math.round(cfg.scoreCeiling * Math.pow(bounded(raw), cfg.scoreCurve)),
          factors,
          boost,
        },
        reason(a, b, factors, ownIntent),
      );
    }
    function similarity(a, b) {
      return jaccard(tokens(project(a).profile), tokens(project(b).profile));
    }
    function mmr(rows, count = cfg.topK, lambda = cfg.mmrLambda) {
      const pool = rows.slice();
      const selected = [];
      const tokenSets = new Map(rows.map(row => [row,
        tokens(project(row.public || row.person).profile)]));
      while (pool.length && selected.length < count) {
        let best = 0;
        let highest = -Infinity;
        pool.forEach((row, index) => {
          const sim = selected.length
            ? Math.max(
                ...selected.map((item) => jaccard(tokenSets.get(row), tokenSets.get(item))),
              )
            : 0;
          const value = (lambda * row.score) / 100 - (1 - lambda) * sim;
          if (value > highest) {
            highest = value;
            best = index;
          }
        });
        selected.push(pool.splice(best, 1)[0]);
      }
      // Diversity chooses membership; displayed ranks always follow final scores.
      return selected.sort((a, b) => b.score - a.score || rows.indexOf(a) - rows.indexOf(b));
    }
    function rank(a, people, options = {}) {
      const exclude = new Set(options.exclude || []);
      const query = intents.guard(options.queryIntent || a.session?.intent || a.intent || {}, a.session?.intentText, a.profile);
      options = { ...options, queryIntent: query };
      const romantic = query.mode === 'dating';
      const eligible = people
        .filter((b) => b.id !== a.id && !exclude.has(b.id))
        .filter(
          (b) =>
            !options.checkedOnly || (b.session || {}).status === "checked_in",
        );
      options.onRead?.(eligible.length);
      const scored = eligible.filter(b => !romantic || dating.eligible(project(a), project(b), query))
        .map((b) => score(a, b, options))
        .filter(
          (row) =>
            !options.mutualOnly ||
            Math.min(row.factors.needAB, row.factors.needBA) >=
              cfg.mutualThreshold,
        );
      const selected = mmr(
        scored,
        options.limit == null ? cfg.topK : options.limit,
        options.lambda == null ? cfg.mmrLambda : options.lambda,
      );
      return romantic ? dating.variety(project(a), selected.filter(row => dating.eligible(project(a), row.public, query))) : selected;
    }
    return {
      resolveIntent: intents.guard,
      parseIntent,
      score,
      reason,
      rank,
      mmr,
      similarity,
      project,
      matches,
    };
  }
  return { create, project, blankIntent };
});
