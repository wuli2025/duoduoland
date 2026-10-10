const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('../scripts/load-demo.js');
const { scenarios, check } = require('../scripts/eval-scenarios.js');
const { data, config, engine } = load();
const eventId = config.app.defaultEvent;
const me = { ...data.me, session: require('./professional-session') };
const participants = id => data.people.filter(p => p.sessions[id]).map(p => ({ ...p, session: p.sessions[id] }));
test('默认 Top5 至少四个不同分数、无 100、理由唯一且包含对方公开证据', () => {
  const rows = engine.rank(me, participants(eventId));
  assert.ok(new Set(rows.map(r => r.score)).size >= 4);
  assert.ok(rows.every(r => r.score >= 70 && r.score <= 97));
  assert.equal(new Set(rows.map(r => r.reason)).size, 5);
  for (const row of rows) {
    assert.ok(require('../src/core/llm-schema').grounded(row.reason, row.public));
    assert.equal(row.person, undefined);
    assert.doesNotMatch(JSON.stringify(row), /@example.com|versions|sessions/);
  }
});
test('coverage、reach 与私有查询意图正确参与打分和理由', () => {
  const person = participants(eventId)[0];
  const single = engine.score(me, person, { queryIntent: { seekRoles: ['投资人'] } });
  const multiple = engine.score(me, person, { queryIntent: { seekRoles: ['投资人', '律师'] } });
  assert.equal(single.factors.needAB, 1);
  assert.equal(multiple.factors.needAB, 0.5);
  assert.match(single.reason, /陈屿/);
  const a = structuredClone(me);
  a.session.intent = { seekRoles: ['律师'], offer: [] };
  assert.equal(engine.score(a, person, { queryIntent: { seekRoles: ['投资人'] } }).reason, single.reason);
  const closed = { ...person, session: { ...person.session, openToChat: false } };
  assert.ok(engine.score(me, closed).factors.reach < single.factors.reach);
});
test('招呼与见面后总分和 fresh 立即下降', () => {
  const person = participants(eventId)[0];
  for (const key of ['met', 'greeted']) {
    const row = engine.score(me, person, { [key]: [person.id] });
    assert.equal(row.factors.fresh, 0.15);
    assert.ok(row.score < engine.score(me, person).score);
  }
});
for (const scenario of scenarios()) test('本地匹配画像：' + scenario.name, () => {
  const people = participants(scenario.eventId);
  const recalled = engine.rank(scenario.me, people, { limit: 12, lambda: 1 });
  const result = check(scenario, engine.mmr(recalled, 5), people, engine, config.synonyms);
  assert.ok(result.pass, JSON.stringify(result));
});
test('主题参会者、隐私版本、签到和空意图有真实差异', () => {
  const sessions = data.people.flatMap(p => Object.values(p.sessions));
  assert.ok(sessions.some(s => !s.publicIntent));
  assert.ok(sessions.some(s => !s.openToChat));
  assert.ok(sessions.some(s => s.status === 'registered'));
  assert.ok(sessions.some(s => !s.intent.seekRoles.length && !s.intent.offer.length));
  for (const p of data.people) assert.equal(new Set(p.versions.map(v => v.visibleFields.join(','))).size, p.versions.length);
  const capital = participants('deeptech-capital');
  assert.ok(capital.filter(p => /创始人|投资|基金|主理人|卖家/.test(p.profile.title)).length / capital.length > 0.65);
  assert.ok(participants('slow-reading').every(p => ['casual', 'dating'].includes(p.session.versionId)));
  assert.ok(participants('indie-live').every(p => ['casual', 'dating'].includes(p.session.versionId)));
});
