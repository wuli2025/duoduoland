const test = require('node:test');
const assert = require('node:assert/strict');
const { data, engine, config } = require('../scripts/load-demo.js')();
const { scenarios, technicalScenarios } = require('../scripts/eval-ai-scenarios.js');
const { check } = require('../scripts/eval-scenarios.js');
const participants = id => data.people.filter(p => p.sessions[id]).map(p => ({ ...p, session: p.sessions[id] }));
test('三种技术需求各组Top3至少两位方向对口，Top3组合随需求改变', () => {
  const signatures = [];
  for (const scenario of technicalScenarios()) {
    const people = participants(scenario.eventId);
    const rows = engine.mmr(engine.rank(scenario.me, people, { limit: config.llm.candidateCount, lambda: 1 }), 5);
    const result = check(scenario, rows, people, engine, config.synonyms);
    assert.ok(result.pass, scenario.name + JSON.stringify(result));
    signatures.push(rows.slice(0, 3).map(r => r.id).sort().join(','));
  }
  assert.equal(new Set(signatures).size, 3);
});
test('技术同义词与合作约束解析，兼职顾问不能等同全职CTO', () => {
  const intent = engine.parseIntent('在上海找全职 CTO，负责端侧推理和vLLM，To B，接受股权。我能提供客户渠道');
  assert.ok(intent.seekSkills.includes('端侧推理'));
  assert.ok(intent.seekSkills.includes('推理加速'));
  assert.deepEqual(intent.availability, ['全职']);
  assert.deepEqual(intent.cooperation, ['联合创始人']);
  const founder = scenarios()[0].me;
  founder.session.intent = intent;
  const p = participants('ai-agent-night').find(p => p.id === 'person-63');
  const compatible = engine.score(founder, p);
  const advisor = structuredClone(p);
  advisor.profile.availability = ['业余'];
  advisor.profile.cooperation = ['兼职顾问'];
  assert.ok(engine.score(founder, advisor).score < compatible.score - 10);
  assert.ok(engine.matches('LLM', '基座模型', config.synonyms.skills));
  assert.ok(engine.matches('具身智能', '机器人', config.synonyms.skills));
  assert.ok(engine.matches('技术合伙人', 'CTO', config.synonyms.roles));
});
test('工程师的行业偏好参与双向打分，相同技术下优先匹配行业场景', () => {
  const engineer = participants('ai-agent-night').find(p => p.id === 'person-64');
  assert.ok(engineer.session.intent.seekIndustries.includes('法律'));
  const legal = structuredClone(scenarios()[0].me);
  legal.profile.industry = 'LLM · 法律';
  const education = structuredClone(legal);
  education.profile.industry = 'LLM · 教育';
  assert.ok(engine.score(engineer, legal).factors.needAB > engine.score(engineer, education).factors.needAB);
});
test('技术、合作、报酬与入职状态隐藏后均不得影响评分或上游投影', () => {
  const p = structuredClone(participants('ai-agent-night').find(p => p.id === 'person-63'));
  const hidden = ['skills', 'availability', 'cooperation', 'compensation', 'employment'];
  p.versions.find(v => v.id === p.session.versionId).visibleFields = ['name', 'industry', 'bio'];
  const me = technicalScenarios()[0].me;
  const before = engine.score(me, p);
  hidden.forEach(key => p.profile[key] = ['HIDDEN-SENSITIVE']);
  const after = engine.score(me, p);
  assert.deepEqual(before, after);
  assert.doesNotMatch(JSON.stringify(require('../src/core/llm-schema').projection(after.public)), /HIDDEN-SENSITIVE/);
});
test('18位AI人物头像对应p49–p66、职业和合作组合独立、场次集中AI创业', () => {
  const added = data.people.slice(60);
  assert.equal(added.length, 18);
  assert.deepEqual(Array.from(added, p => p.profile.avatar), Array.from({ length: 18 }, (_, i) => 'p' + (49 + i)));
  assert.equal(new Set(added.map(p => p.profile.skills.join(','))).size, 18);
  for (const p of added) {
    assert.ok(p.sessions['ai-agent-night']);
    assert.ok(p.sessions['demo-day']);
    assert.ok(p.sessions['product-stories']);
    assert.ok(!p.sessions['slow-reading']);
    assert.ok(p.profile.compensation.length && p.profile.employment.length);
  }
});
test('真实状态 reading→done / reading→failed，失败显示本地，旧请求不能覆盖新状态', () => {
  const state = require('../src/core/progressive').create();
  const rows = [{ id: 'local' }];
  const first = state.begin(rows);
  assert.equal(state.get().phase, 'reading');
  assert.deepEqual(state.get().rows, []);
  assert.equal(state.get().pending, true);
  state.settle(first, { engine: 'llm', rows: [{ id: 'remote' }] });
  assert.equal(state.get().phase, 'done');
  const second = state.begin(rows);
  assert.equal(state.settle(first, { engine: 'llm', rows: [] }), false);
  state.settle(second, { engine: 'local', rows: [] });
  assert.equal(state.get().phase, 'failed');
  assert.deepEqual(state.get().rows, rows);
  const offline = state.begin(rows, { offline: true });
  state.settle(offline, { engine: 'local' });
  assert.equal(state.get().phase, 'local');
  state.dispose();
  assert.equal(state.settle(offline, { engine: 'llm', rows: [] }), false);
});
