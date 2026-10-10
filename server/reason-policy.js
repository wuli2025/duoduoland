const schema = require('../src/core/llm-schema');
const policy = require('../src/config/reason-policy');
const matching = require('../src/config/matching');
const synonyms = require('../src/config/synonyms');
const reasons = require('../src/config/reasons');
const engine = require('../src/core/matcher').create({ matching, synonyms, reasons });
const length = value => [...value].length;
function fit(templates, variables, limit) {
  for (const template of templates) {
    const fixed = template.replace('{topic}', '').replace('{name}', variables.name || '');
    if (length(variables.topic) > limit - length(fixed)) continue;
    const value = template.replace('{name}', variables.name || '').replace('{topic}', variables.topic);
    if (schema.wording(value)) return value;
  }
}
function repair(payload, candidate, used = new Set()) {
  if (payload.intent.mode === 'dating') return require('../src/core/dating').reasons(payload.me, candidate);
  const local = engine.score(payload.me, candidate, { queryIntent: payload.intent });
  const generated = { reason: schema.text(local.reason), icebreaker: schema.text(local.icebreaker) };
  if (length(generated.reason) <= policy.reasonLimit && length(generated.icebreaker) <= policy.questionLimit &&
      /[？?]$/.test(generated.icebreaker) && !used.has(generated.reason) &&
      schema.grounded(generated.reason, candidate) && schema.wording(generated.reason) && schema.wording(generated.icebreaker)) return generated;
  const p = candidate.profile;
  const topics = [...(p.skills || []), p.industry, ...candidate.intent.offer,
    ...['cooperation', 'markets', 'availability', 'compensation', 'employment'].flatMap(k => p[k] || [])]
    .filter(v => v && schema.wording(v));
  const names = [...new Set([p.name || '', [p.name, p.title].filter(Boolean).join('·'),
    [p.name, p.city, p.title].filter(Boolean).join('·')])];
  for (const name of names) for (const topic of topics) {
    // Keep the complete evidence. A shorter template may fit a longer skill.
    const reason = fit(policy.templates, { name, topic }, policy.reasonLimit);
    if (!reason || used.has(reason) || !schema.grounded(reason, candidate)) continue;
    const icebreaker = fit(policy.questionTemplates, { topic }, policy.questionLimit) || policy.genericQuestion;
    return { reason, icebreaker };
  }
  schema.fail('NO_SAFE_REASON');
}
module.exports = { repair, policy };
