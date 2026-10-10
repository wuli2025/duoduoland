const test = require('node:test');
const assert = require('node:assert/strict');
const carousel = require('../src/core/carousel');
const {data} = require('../scripts/load-demo')();

test('轮播索引无限循环，空集合和单张活动也安全', () => {
  assert.equal(carousel.wrap(-1, 3), 2);
  assert.equal(carousel.wrap(3, 3), 0);
  assert.equal(carousel.wrap(-10, 3), 2);
  assert.equal(carousel.wrap(1, 0), 0);
  const state = carousel.create({featured: ['a', 'b', 'c'], week: [], ranking: ['x']});
  assert.equal(state.move(-1).index, 2);
  assert.equal(state.move(1).index, 0);
  state.go(2);
  assert.equal(state.select('week').index, 0);
  assert.deepEqual(state.move(1).slides, []);
  assert.equal(state.select('ranking').slides[0], 'x');
  assert.equal(state.move(1).index, 0);
  assert.equal(state.select('unknown').tab, 'ranking');
});
test('精选来自真实编辑推荐，本周使用上海周边界，榜单按报名数且不修改原数据', () => {
  const original = JSON.stringify(data.events);
  const groups = carousel.sources(data.events, data.heroes, new Date('2026-10-09T12:00:00Z'));
  assert.deepEqual(Array.from(groups.featured, s => s.id), Array.from(data.heroes, s => s.eventId));
  assert.deepEqual(Array.from(groups.week, s => s.id), ['ai-agent-night', 'founders-brunch']);
  assert.equal(groups.ranking[0].id, 'global-forum');
  assert.ok(groups.ranking.every((s, i, rows) => !i || rows[i - 1].count >= s.count));
  assert.equal(JSON.stringify(data.events), original);
  const boundary = carousel.sources(data.events, data.heroes, new Date('2026-10-11T16:01:00Z'));
  assert.equal(boundary.week.length, 5);
  assert.ok(!boundary.week.some(s => s.id === 'founders-brunch'));
  assert.equal(carousel.sources(data.events, data.heroes, new Date('2027-01-01')).week.length, 0);
});
