const test = require("node:test");
const assert = require("node:assert/strict");
const matcher = require("../src/core/matcher.js");
const matching = require("../src/config/matching.js");
const synonyms = require("../src/config/synonyms.js");
const reasons = require("../src/config/reasons.js");
const engine = matcher.create({ matching, synonyms, reasons });
const copy = (value) => JSON.parse(JSON.stringify(value));

function person(id, profile, intent = {}, visible = Object.keys(profile)) {
  return {
    id,
    profile,
    versions: [{ id: "public", visibleFields: visible }],
    session: {
      versionId: "public",
      status: "checked_in",
      publicIntent: true,
      openToChat: true,
      intent: {
        seekRoles: [],
        seekIndustries: [],
        offer: [],
        city: "",
        ...intent,
      },
    },
  };
}
function fixture() {
  return [
    person(
      "a",
      {
        name: "林知夏",
        title: "产品经理",
        industry: "Agent",
        city: "上海",
        skills: ["Agent", "产品策略"],
      },
      { seekRoles: ["投资人"], seekIndustries: ["Agent"], offer: ["项目"] },
    ),
    person(
      "b",
      {
        name: "陈屿",
        title: "基金合伙人",
        industry: "Agent",
        city: "上海",
        skills: ["早期投资"],
      },
      { seekRoles: ["产品经理"], seekIndustries: ["Agent"], offer: ["资金"] },
    ),
  ];
}

test("双向意图在基础加权分之上得到精确加成", () => {
  const [a, b] = fixture();
  const result = engine.score(a, b);
  const noBoost = matcher
    .create({ matching: { ...matching, mutualBoost: 0 }, synonyms, reasons })
    .score(a, b);
  assert.equal(result.factors.needAB, 1);
  assert.equal(result.factors.needBA, 1);
  assert.equal(result.boost, 1.15);
  assert.ok(result.score > noBoost.score);
  assert.match(result.reason, /也希望认识/);
});

test("隐私字段不改变评分、质量、相似度或推荐理由", () => {
  const [a, b] = fixture();
  b.profile.education = "隐藏学校";
  b.profile.contact = "secret@example.com";
  b.profile.goals = "秘密项目";
  const before = engine.score(a, b);
  const similarity = engine.similarity(a, b);
  b.profile.education = "Agent 投资人 产品经理 上海";
  b.profile.contact = "VC 供应链";
  b.profile.goals = "人工智能 大模型 技术";
  const after = engine.score(a, b);
  assert.deepEqual(before.factors, after.factors);
  assert.equal(before.score, after.score);
  assert.equal(before.reason, after.reason);
  assert.equal(before.icebreaker, after.icebreaker);
  assert.equal(engine.similarity(a, b), similarity);
  assert.equal(after.public.profile.contact, undefined);
  assert.doesNotMatch(
    JSON.stringify(after.public) + after.reason,
    /secret|隐藏|秘密/,
  );
});

test("双方隐藏字段均不参与 common；隐藏角色无法被意图命中", () => {
  const [a, b] = fixture();
  b.versions[0].visibleFields = ["name"];
  assert.equal(engine.score(a, b).factors.needAB, 0);
  assert.equal(engine.score(a, b).factors.common, 0);
  a.profile.secret = "基金 Agent";
  b.profile.secret = "基金 Agent";
  assert.equal(engine.score(a, b).factors.common, 0);
});

test("对方未公开的意图不改变任何评分或理由", () => {
  const [a, b] = fixture();
  b.session.publicIntent = false;
  const before = engine.score(a, b);
  b.session.intent = {
    seekRoles: ["设计师"],
    seekIndustries: ["设计"],
    offer: ["秘密资金"],
    city: "北京",
  };
  const after = engine.score(a, b);
  assert.deepEqual(before.factors, after.factors);
  assert.equal(before.reason, after.reason);
  assert.deepEqual(after.public.intent, matcher.blankIntent());
});

test("missing selected version fails closed, without base-profile fallback", () => {
  const [a, b] = fixture();
  b.session.versionId = "missing";
  assert.deepEqual(engine.project(b).profile, {});
  const result = engine.score(a, b);
  assert.equal(result.factors.needAB, 0);
  assert.equal(result.factors.quality, 0);
  assert.doesNotMatch(result.reason, /基金|陈屿/);
});

test("版本专属简介只有在 bio 公开时才进入投影", () => {
  const b = person("b", { name: "朋友", bio: "基础简介" });
  b.versions[0].bio = "专属简介";
  assert.equal(engine.project(b).profile.bio, "专属简介");
  b.versions[0].visibleFields = ["name"];
  assert.equal(engine.project(b).profile.bio, undefined);
});

test("MMR selects a diverse candidate instead of a near-identical second candidate", () => {
  const a = person("one", { title: "投资人", industry: "Agent", city: "上海" });
  const b = person("two", { title: "投资人", industry: "Agent", city: "上海" });
  const c = person("three", {
    title: "设计师",
    industry: "设计",
    city: "杭州",
  });
  const rows = [
    { id: "one", score: 95, person: a },
    { id: "two", score: 94, person: b },
    { id: "three", score: 88, person: c },
  ];
  assert.deepEqual(
    engine.mmr(rows, 2, 0.75).map((row) => row.id),
    ["one", "three"],
  );
  assert.deepEqual(
    engine.mmr(rows, 2, 1).map((row) => row.id),
    ["one", "two"],
  );
  assert.equal(rows.length, 3);
});

test("两组推荐权重产生不同结果", () => {
  const a = person(
    "me",
    { title: "产品经理", industry: "设计", city: "上海" },
    { seekRoles: ["投资人"] },
  );
  const investor = person("investor", {
    title: "投资人",
    industry: "金融",
    city: "北京",
  });
  const peer = person("peer", {
    title: "产品经理",
    industry: "设计",
    city: "上海",
  });
  const zeros = Object.fromEntries(
    Object.keys(matching.weights).map((key) => [key, 0]),
  );
  const needsEngine = matcher.create({
    matching: { ...matching, weights: { ...zeros, needAB: 1 } },
    synonyms,
    reasons,
  });
  const commonEngine = matcher.create({
    matching: { ...matching, weights: { ...zeros, common: 1 } },
    synonyms,
    reasons,
  });
  const needs = needsEngine.rank(a, [investor, peer], { limit: 1 });
  const common = commonEngine.rank(a, [investor, peer], { limit: 1 });
  assert.equal(needs[0].id, "investor");
  assert.equal(common[0].id, "peer");
});

test("空意图提供有限且稳定的兜底推荐", () => {
  const [a, b] = fixture();
  a.session.intent = engine.parseIntent("");
  const results = engine.rank(a, [a, b]);
  assert.equal(results.length, 1);
  assert.ok(Number.isFinite(results[0].score));
  assert.ok(results[0].score >= 0 && results[0].score <= 100);
  assert.deepEqual(engine.parseIntent(null), matcher.blankIntent());
  assert.deepEqual(engine.rank(a, []), []);
});

test("关键词和同义词正确解析；提供内容不会被当作寻找角色", () => {
  const intent = engine.parseIntent(
    "在上海找 VC、懂消费电子量产的朋友。我能提供：Agent 产品落地经验",
  );
  assert.deepEqual(intent.seekRoles, ["投资人", "供应链专家"]);
  assert.deepEqual(intent.seekIndustries, ["AI 硬件"]);
  assert.ok(intent.offer.includes("产品经验"));
  assert.equal(intent.city, "上海");
  assert.ok(!intent.seekRoles.includes("产品经理"));
  assert.ok(
    !engine.parseIntent("找 chapter 作者").seekRoles.includes("招聘者"),
  );
});

test("换批、签到与双向筛选严格生效并排除自己", () => {
  const [a, b] = fixture();
  const c = copy(b);
  c.id = "c";
  c.session.status = "registered";
  const d = copy(b);
  d.id = "d";
  d.session.intent = matcher.blankIntent();
  assert.deepEqual(
    engine
      .rank(a, [a, b, c, d], { checkedOnly: true, mutualOnly: true })
      .map((row) => row.id),
    ["b"],
  );
  assert.equal(
    engine.rank(a, [a, b, c, d], { exclude: ["b", "c", "d"] }).length,
    0,
  );
});

test("见面与互加降低 fresh 因子", () => {
  const [a, b] = fixture();
  assert.equal(engine.score(a, b).factors.fresh, 1);
  assert.equal(engine.score(a, b, { met: ["b"] }).factors.fresh, 0.15);
  assert.equal(engine.score(a, b, { greeted: ["b"] }).factors.fresh, 0.15);
});

test("资源互补通过配置对齐表计算", () => {
  const [a, b] = fixture();
  a.session.intent.offer = ["产品经验"];
  assert.equal(engine.score(a, b).factors.complement, 1);
  b.session.intent.offer = [];
  assert.equal(engine.score(a, b).factors.complement, 0.5);
});
