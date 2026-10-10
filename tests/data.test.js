const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
  const context = { window: {} };
  vm.createContext(context);
  const scripts = [
    "config/app",
    "config/dating",
    "config/fields",
    "config/copy",
    "data/profile",
    "data/events",
    "data/people-catalog",
    "data/people",
    "data/ai-people",
    "data/dating-people",
    "data/job-details",
    "data/jobs",
  ];
  for (const script of scripts) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "../src/" + script + ".js"), "utf8"),
      context,
    );
  }
  return JSON.parse(JSON.stringify(context.window.BJ));
}

test("demo fixtures meet counts and each selected version exists", () => {
  const { data, config } = load();
  assert.equal(Object.keys(data.me.profile).length, 22);
  assert.equal(data.me.versions.length, 5);
  assert.equal(data.people.length, 78);
  assert.equal(data.events.length, 10);
  assert.ok(data.jobs.length >= 15);
  assert.equal(data.companies.length, 8);
  for (const person of data.people) {
    assert.ok(person.versions.length >= 2);
    assert.ok(Object.keys(person.sessions).length > 0);
    for (const session of Object.values(person.sessions)) {
      assert.ok(
        person.versions.some((version) => version.id === session.versionId),
      );
    }
  }
  assert.equal(new Set(data.people.map(p => p.id)).size, 78);
  assert.equal(new Set(data.people.map(p => p.profile.name)).size, 78);
  const avatars = data.people.map(p => p.profile.avatar).filter(Boolean);
  assert.equal(avatars.length, 66);
  assert.equal(new Set(avatars).size, 66);
});

test("all event and job relationships resolve to fictional data", () => {
  const { data } = load();
  for (const item of [...data.events, ...data.jobs]) {
    assert.ok(data.companies.some((company) => company.id === item.companyId));
  }
  for (const job of data.jobs) {
    assert.ok(data.events.some(event => event.id === job.eventId));
    assert.ok(data.people.find(p => p.id === job.recruiterId).sessions[job.eventId]);
    for (const id of [job.recruiterId, ...job.referralIds]) {
      assert.ok(data.people.some((person) => person.id === id));
    }
  }
});

test('66 个头像内容不重复，原49–60号人物为首字占位', () => {
  const { data } = load();
  const crypto = require('node:crypto');
  const hashes = data.people.filter(p => p.profile.avatar).map(person => {
    const image = fs.readFileSync(path.join(__dirname, '../assets/img/avatars', person.profile.avatar + '.jpg'));
    return crypto.createHash('sha256').update(image).digest('hex');
  });
  assert.equal(new Set(hashes).size, 66);
  assert.ok(data.people.slice(48, 60).every(p => p.profile.avatar === ''));
});
