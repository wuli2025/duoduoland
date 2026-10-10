// Reduce repeated profile text after the authoritative privacy whitelist runs.
function compact(payload, shorten = true) {
  const person = value => {
    const { profile: p } = value;
    const romantic = payload.intent.mode === 'dating';
    const fields = romantic ? ['name', 'city', 'interests', 'bio', ...require('../src/config/dating').fields] : shorten ? ['name', 'title', 'industry', 'city', 'skills', 'interests', 'bio',
      'cooperation', 'markets', 'availability', 'compensation', 'employment']
      : Object.keys(p);
    if (!romantic && !p.skills?.length) fields.push('experience');
    return { id: value.id, profile: Object.fromEntries(fields.filter(k => p[k] !== undefined).map(k => [k, p[k]])),
      intent: value.intent };
  };
  return { eventId: payload.eventId, intent: payload.intent,
    me: person(payload.me), candidates: payload.candidates.map(person),
    local: payload.local.map(({ id, score }) => ({ id, score })) };
}
module.exports = { compact };
