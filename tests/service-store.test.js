const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('../scripts/load-demo.js');
function setup(saved = null, failWrite = false) {
  const events = [];
  const app = load({ localStorage: {
    getItem: () => saved,
    setItem: () => { if (failWrite) throw new Error('QUOTA'); },
  }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } } });
  app.context.window.dispatchEvent = event => events.push(event);
  const store = app.createStore(app.config, app.data);
  return { ...app, events, store, service: app.createService(app.config, app.data, store, app.engine) };
}
test('职位要求与福利独立，分数极差大于一个档位，空要求得零', () => {
  const { data, service } = setup();
  assert.equal(new Set(data.jobs.map(j => j.requirements.join(','))).size, 16);
  assert.equal(new Set(data.jobs.map(j => j.benefits.join(','))).size, 16);
  const scores = data.jobs.map(j => service.jobFit(j).score);
  assert.ok(Math.max(...scores) - Math.min(...scores) > 20);
  assert.equal(service.jobFit({ requirements: [] }).score, 0);
});
test('jobFit 与投递快照用同一求职版，隐藏字段不产生已满足项', () => {
  const { store, service } = setup();
  const job = { requirements: ['独有保密经历'] };
  store.get().me.profile.experience = '独有保密经历';
  assert.equal(service.jobFit(job).score, 100);
  store.get().me.versions.find(v => v.id === 'career').visibleFields = ['name'];
  assert.equal(service.jobFit(job).score, 0);
  assert.equal(service.careerProjection().profile.experience, undefined);
  store.get().me.versions = store.get().me.versions.filter(v => v.id !== 'career');
  assert.equal(service.careerProjection().versionId, undefined);
  assert.equal(service.jobFit(job).score, 0);
});
test('同场内推限定职位活动；任意别场报名不算同场', () => {
  const { store, service } = setup();
  assert.equal(service.referralSameEvent({ eventId: 'ai-agent-night' }, 'person-03'), true);
  assert.equal(service.referralSameEvent({ eventId: 'deeptech-capital' }, 'person-01'), false);
  assert.equal(service.referralSameEvent({}, 'person-03'), false);
  store.get().participations['deeptech-capital'] = {};
  assert.equal(service.referralSameEvent({ eventId: 'deeptech-capital' }, 'person-01'), true);
  assert.equal(service.publicPerson('person-01').versions, undefined);
});
test('损坏 JSON 与错误 schema 通过 loadFailed 和 detail 报告', () => {
  for (const saved of ['{broken', '{"schema":99}']) {
    const { store, events } = setup(saved);
    assert.equal(store.loadFailed, true);
    assert.ok(store.loadError);
    assert.equal(events[0].type, 'bj:storage-error');
    assert.equal(events[0].detail, store.loadError);
  }
  assert.equal(setup().store.loadFailed, false);
});
test('写入失败保留内存操作并携带错误 detail', () => {
  const { store, events } = setup(null, true);
  assert.equal(store.update(state => state.greeted.push('person-01')), false);
  assert.ok(store.get().greeted.includes('person-01'));
  assert.equal(events.find(e => e.type === 'bj:storage-error').detail.message, 'QUOTA');
});
module.exports = { setup };
test('全局搜索目录包含 78 人，但每人只提供选中场次的公开投影', () => {
  const { service, data } = setup();
  const people = service.directory();
  assert.equal(people.length, 78);
  assert.ok(people.some(p => /跨境/.test(p.profile.title)));
  for (const p of people) {
    assert.equal(p.versions, undefined);
    assert.equal(p.sessions, undefined);
    assert.ok(data.people.find(person => person.id === p.id).sessions[p.eventId]);
  }
});

test('UI 动态字符串转义 HTML 与属性，防止档案内容执行代码', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const app = load({ document: { addEventListener: () => {} } });
  app.context.window.BJ.icon = () => '';
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/ui/components.js'), 'utf8'), app.context);
  const ui = app.context.window.BJ.createUI(app.config);
  assert.equal(ui.e('<script>"&\'</script>'), '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
  assert.doesNotMatch(ui.tags(['<img src=x onerror=alert(1)>']), /<img/);
});
