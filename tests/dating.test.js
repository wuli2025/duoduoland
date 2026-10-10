const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('../scripts/load-demo');
const dating = require('../src/core/dating');
const settings = require('../src/core/dating-settings');
const schema = require('../src/core/llm-schema');
const { scenarios, check } = require('../scripts/eval-dating-scenarios');
const demo = load(), { data, engine } = demo;
const cases = scenarios(demo);
const members = id => data.people.filter(p => p.sessions[id]).map(p => ({ ...p, session: p.sessions[id] }));
const own = engine.project(cases[0].me), query = cases[0].me.session.intent;
const candidate = engine.project(members('ai-agent-night').find(p => p.id === 'person-24'));

test('恋爱词、目标性别、相仿/年长/年幼年龄与兴趣解析，不污染职业角色', () => {
  for (const [text, gender, range] of [['找男朋友，年龄相仿，喜欢户外', '男', [25,35]],
    ['想认识女生，比我大一点', '女', [31,35]], ['找女朋友，比我小一点', '女', [25,29]],
    ['相亲，想找25-32岁的男性', '男', [25,32]]]) {
    const q = engine.parseIntent(text, data.me.profile);
    assert.equal(q.mode, 'dating'); assert.equal(q.targetGender, gender); assert.deepEqual(q.ageRange, range);
    assert.deepEqual(q.seekRoles, []); assert.deepEqual(q.seekIndustries, []);
  }
  assert.deepEqual(engine.parseIntent('想找男朋友，喜欢徒步', data.me.profile).interests, ['户外']);
  assert.equal(engine.parseIntent('交朋友，一起户外徒步').mode, undefined);
  assert.equal(engine.parseIntent('不想恋爱，找工程师').mode, undefined);
  assert.equal(engine.parseIntent('不想找男朋友，只交朋友').mode, undefined);
  assert.equal(engine.parseIntent('找面向对象编程工程师').mode, undefined);
  assert.equal(engine.parseIntent('找一个对象').mode, 'dating');
  const impossible = engine.parseIntent('找男朋友，35-25岁', data.me.profile);
  assert.equal(dating.eligible(own, candidate, impossible), false);
});
test('78人的交友敏感字段默认隔离，24位明确开放者男女各半，头像资料完整', () => {
  assert.equal(data.people.length, 78);
  const open = data.people.filter(p => p.profile.datingOpen);
  assert.equal(open.length, 24);
  for (const g of ['男','女']) assert.equal(open.filter(p => p.profile.gender === g).length, 12);
  for (const p of data.people) {
    assert.ok(['男','女','不公开'].includes(p.profile.gender)); assert.ok(Number.isInteger(p.profile.birthYear));
    for (const v of p.versions.filter(v => v.id !== 'dating')) assert.ok(dating.cfg.fields.every(k => !v.visibleFields.includes(k)));
    if (p.profile.datingOpen) { assert.equal(p.profile.relationshipStatus, '单身'); assert.ok(dating.age(p.profile) >= 24 && dating.age(p.profile) <= 36); }
  }
  assert.equal(data.me.profile.datingOpen, false);
  assert.ok(dating.cfg.fields.every(k => !data.me.versions.find(v => v.id === 'dating').visibleFields.includes(k)));
});
test('双向硬条件：任意未同意/未公开/非单身/性别/年龄/偏好不符都不能入选', () => {
  assert.ok(dating.eligible(own, candidate, query));
  const mutations = [p => p.profile.datingOpen = false, p => p.profile.relationshipStatus = '已婚',
    p => p.profile.relationshipStatus = '恋爱中', p => p.profile.gender = '女', p => p.profile.gender = '不公开',
    p => p.profile.birthYear = 1980, p => p.profile.birthYear = 2010,
    p => p.profile.datingPreference.genders = ['男'], p => p.profile.datingPreference.ageRange = [31,35],
    p => delete p.cardType, ...dating.cfg.required.map(key => p => p.visibleFields = p.visibleFields.filter(k => k !== key))];
  for (const mutate of mutations) {
    const bad = structuredClone(candidate); mutate(bad);
    assert.equal(engine.rank(own, [bad], { queryIntent: query }).length, 0);
    assert.throws(() => schema.request({ me: own, intent: query, candidates: [bad] }), /DATING_NOT_ELIGIBLE|INVALID_DATING/);
  }
  const me = structuredClone(own); me.profile.datingOpen = false;
  assert.equal(engine.rank(me, [candidate], { queryIntent: query }).length, 0);
  const original = members('ai-agent-night').find(p => p.id === candidate.id);
  assert.equal(engine.rank(cases[0].me, [{ ...original, session: { ...original.session, datingOpen: false } }]).length, 0);
});
test('旧存储迁移默认不授权；一键开启仅授权当前场次，拒绝后没有结果', () => {
  const state = { me: structuredClone(data.me), participations: { old: { versionId: 'tech',
    intentText: '想找个男朋友，年龄相仿，最好也喜欢户外', intent: { seekRoles: [], seekIndustries: ['户外'], offer: [], city: '' } } } };
  dating.cfg.fields.forEach(k => delete state.me.profile[k]); state.me.versions = state.me.versions.filter(v => v.id !== 'dating');
  settings.migrate(state, data.me);
  assert.equal(state.me.profile.datingOpen, false); assert.equal(state.participations.old.datingOpen, false);
  assert.equal(state.participations.old.intent.mode, 'dating');
  assert.deepEqual(state.participations.old.intent.ageRange, [25,35]);
  const session = { intent: query }; settings.enable(state.me, session, data.me);
  assert.ok(dating.ready(engine.project({ ...state.me, session })));
  assert.equal(state.participations.old.datingOpen, false);
  session.datingOpen = false;
  assert.equal(engine.rank({ ...state.me, session }, members('ai-agent-night')).length, 0);
});
for (const scenario of cases) test('本地交友评测：' + scenario.name, () => {
  const rows = engine.rank(scenario.me, members(scenario.eventId));
  assert.deepEqual(check(scenario, rows, demo).pass, true);
  if (scenario.eventId === 'ai-agent-night') assert.equal(rows.length, 2);
});
test('人数不足按实际双向条件推荐活动；未开放者永不入选', () => {
  const me = structuredClone(cases[0].me);
  const state = { me, participations: { 'ai-agent-night': me.session } };
  const service = demo.createService(demo.config, data, { get: () => state, clone: structuredClone }, engine);
  const info = service.datingInfo('ai-agent-night');
  assert.equal(info.count, 2); assert.equal(info.alternatives[0].id, 'city-walk');
  assert.ok(info.alternatives.every((v,i,a) => !i || a[i-1].count >= v.count));
  const ids = engine.rank(me, members('city-walk'), { limit: 78 }).map(r => r.id);
  assert.ok(data.people.filter(p => !p.profile.datingOpen).every(p => !ids.includes(p.id)));
});
test('职业评分与排序不受交友字段改变影响，职业结果没有fitReason', () => {
  const me = { ...data.me, session: data.defaultParticipation }, before = engine.rank(me, members('ai-agent-night'));
  const people = structuredClone(members('ai-agent-night'));
  people.forEach(p => Object.assign(p.profile, { gender: '不公开', birthYear: 1928, relationshipStatus: '已婚', datingOpen: false,
    datingLifestyle: ['完全不同'], datingValues: ['不同'], datingPreference: { genders: [], ageRange: [] } }));
  const after = engine.rank(me, people);
  assert.deepEqual(after.map(r => [r.id,r.score,r.reason]), before.map(r => [r.id,r.score,r.reason]));
  assert.ok(after.every(r => !('fitReason' in r)));
  const payload = schema.request({ me, intent: me.session.intent, candidates: [candidate] });
  assert.ok(dating.cfg.fields.every(k => !(k in payload.candidates[0].profile)));
});
test('共同兴趣与明确兴趣要求影响交友评分，薪资职位不产生优势', () => {
  const yes = structuredClone(candidate), no = structuredClone(candidate);
  no.profile.interests = ['音乐']; no.profile.title = '总裁'; no.profile.salary = '千万';
  assert.ok(engine.score(own, yes, { queryIntent: query }).score > engine.score(own, no, { queryIntent: query }).score);
  const changed = structuredClone(yes); changed.profile.title = '总裁'; changed.profile.income = '千万';
  // Non-public extra fields do not change the accepted projection shape or score.
  assert.equal(engine.score(own, changed, { queryIntent: query }).score, engine.score(own, yes, { queryIntent: query }).score);
  const before = engine.score(own, yes, { queryIntent: query });
  const greeted = engine.score(own, yes, { queryIntent: query, greeted: [yes.id] });
  assert.ok(greeted.score < before.score && greeted.factors.fresh < before.factors.fresh);
  const conflict = structuredClone(yes); conflict.intent.targetGender = '男';
  assert.ok(engine.score(own, conflict, { queryIntent: query }).factors.mutual < before.factors.mutual);
});
