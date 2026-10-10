// DEMO DATA — acceptance profiles and thresholds fixed before evaluation.
const specs = [
  ['找投资的硬件创业者', 'deeptech-capital', '硬件创始人', 'AI 硬件', ['投资人'], ['AI 硬件'], ['项目', '技术'], '投资人', 5, 3],
  ['找设计师的独立开发者', 'design-workshop', '独立开发者', 'Agent', ['设计师'], ['设计'], ['技术'], '设计师', 3, 2],
  ['找工作的应届生', 'ai-agent-night', '算法应届生', 'Agent', ['招聘者'], ['Agent'], ['技术'], '招聘者', 5, 2],
  ['想交朋友的设计师', 'slow-reading', '设计师', '设计', [], ['阅读'], ['阅读', '摄影'], '阅读', 5, 3],
  ['找客户的律师', 'founders-brunch', '创业法律师', '法律', ['创始人'], [], ['法律咨询'], '创始人', 5, 3],
  ['找供应链的新消费主理人', 'global-forum', '新消费创始人', '新消费', ['供应链专家'], ['新消费'], ['项目'], '供应链专家', 5, 2],
  ['招聘的 HR', 'ai-agent-night', 'HR 总监', 'Agent', ['工程师'], ['Agent'], ['岗位'], '工程师', 5, 3],
  ['找联合创始人的工程师', 'founders-brunch', '全栈工程师', 'Agent', ['创始人', '产品经理'], ['Agent'], ['技术'], '创始人', 5, 2],
];
function scenarios() {
  return specs.map((s, i) => {
    const profile = { name: '测试用户' + (i + 1), title: s[2], industry: s[3], city: '上海',
      skills: [s[3], ...s[6]], interests: i === 3 ? ['阅读', '摄影'] : [], bio: s[0] };
    const intent = { seekRoles: s[4], seekIndustries: s[5], offer: s[6], city: '上海' };
    return { name: s[0], eventId: s[1], expected: s[7], top: s[8], minimum: s[9],
      me: { id: 'eval-' + i, profile, versions: [{ id: 'public', visibleFields: Object.keys(profile) }],
        session: { versionId: 'public', publicIntent: true, openToChat: true, status: 'checked_in', intent } } };
  }).concat(require('./eval-ai-scenarios.js').scenarios());
}
function check(scenario, rows, people, engine, synonyms) {
  const hit = rows.slice(0, scenario.top).filter(row => {
    const p = row.public.profile;
    const text = scenario.expected === '阅读' ? (p.interests || []).join(' ') : [p.title, p.company].join(' ');
    const role = engine.matches(scenario.expected, text, scenario.expected === '阅读' ? synonyms.industries : synonyms.roles);
    return role && (!scenario.technical || engine.matches(scenario.technical, (p.skills || []).join(' '), synonyms.skills));
  }).length;
  const privacy = rows.every(row => {
    const person = people.find(p => p.id === row.id);
    const publicText = JSON.stringify(row.public);
    const hidden = Object.entries(person.profile).filter(([key]) => !row.public.visibleFields.includes(key))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value])
      .filter(value => typeof value === 'string' && value.length >= 2 && !publicText.includes(value));
    return hidden.every(value => !row.reason.includes(value) && !row.icebreaker.includes(value));
  });
  const mutual = rows.filter(row => Math.min(row.factors.needAB, row.factors.needBA) >= 0.4 &&
    engine.matches(scenario.expected, row.public.profile.title, synonyms.roles) &&
    /LLM|Agent|AI|大模型/.test(row.public.profile.industry || '')).length;
  const wording = rows.every(row => require('../src/core/llm-schema').wording(row.reason));
  const ordered = rows.every((row, i) => !i || rows[i - 1].score >= row.score);
  return { hit, mutual, pass: hit >= scenario.minimum && privacy && wording && ordered &&
      (!scenario.mutualMinimum || mutual >= scenario.mutualMinimum), privacy, wording, ordered,
    expectation: `Top${scenario.top} 的${scenario.technical || ''}${scenario.expected}数量 ≥ ${scenario.minimum}` +
      (scenario.mutualMinimum ? `，Top5双向对口AI人选 ≥ ${scenario.mutualMinimum}` : '') };
}
module.exports = { scenarios, check };
