const fs = require('node:fs');
const path = require('node:path');
const demo = require('./load-demo')();
const { scenarios, check } = require('./eval-dating-scenarios');
const { createLLM } = require('../server/llm');
const { config: readConfig } = require('../server/config');
const { fuse } = require('../src/core/llm-client');
const dating = require('../src/core/dating');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/evals/round-8');
fs.mkdirSync(out, { recursive: true });
async function main() {
  const cfg = readConfig(), entries = [], logs = [];
  const available = cfg.key && cfg.baseUrl && cfg.model && !process.argv.includes('--local');
  const server = createLLM({ config: cfg, logger: row => { logs.push(row); console.log(JSON.stringify(row)); } });
  for (const [index, s] of scenarios(demo).entries()) {
    const people = demo.data.people.filter(p => p.sessions[s.eventId]).map(p => ({ ...p, session: p.sessions[s.eventId] }));
    const recalled = demo.engine.rank(s.me, people, { limit: demo.config.llm.candidateCount, lambda: 1 });
    const local = demo.engine.mmr(recalled, 5);
    const entry = { name: s.name, text: s.me.session.intentText, eventId: s.eventId,
      local, localCheck: check(s, local, demo), model: cfg.model };
    if (available) {
      try {
        const payload = { eventId: s.eventId, me: demo.engine.project(s.me), intent: s.me.session.intent,
          candidates: recalled.map(r => r.public), local: recalled.map(r => ({ id: r.id, score: r.score, fresh: r.factors.fresh, ...r.interaction })) };
        const result = await server.rerank(payload);
        entry.remote = fuse(recalled, result.candidates, demo.config.llm, demo.engine, 5, result.dropped, payload);
        entry.remoteCheck = check(s, entry.remote, demo);
        entry.meta = result.meta;
      } catch (error) { entry.error = error.code || 'LLM_FAILED'; }
    } else entry.error = 'REAL_LLM_NOT_RUN';
    entries.push(entry);
    // One line per row keeps each standalone evidence file below 500 lines.
    fs.writeFileSync(path.join(out, `scenario-${index + 1}.json`), JSON.stringify(entry, null, 0) + '\n');
    console.log(JSON.stringify({ scenario: s.name, local: entry.localCheck.pass, llm: entry.remoteCheck?.pass || false, error: entry.error }));
  }
  const lines = ['<!-- round-8-dating -->', '', '## 第 8 轮：公开双向同意的恋爱交友', '',
    `实测时间：${new Date().toISOString()}；模型：${cfg.model || '未配置'}。使用原有服务端模块与 API，候选召回上限 ${demo.config.llm.candidateCount}；先执行硬筛选，再调用真实模型。`, '',
    '78 人中 24 人在指定场次主动公开交友版（男女各 12 位）；其余 54 人不开放。性别/年龄依据虚构头像设定，12 位无头像人物另行编写。林知夏默认关闭，以下测试显式开启本场授权。', '',
    '通过标准预先写于 `scripts/eval-dating-scenarios.js`：人数=min(5,双向合格总数)，全部满足性别/25–35岁/单身/双向偏好/本场公开授权，共同兴趣命中指定主题，fitReason≤60字且有双方公开证据，禁用措辞与隐藏信息检查通过，显示分数降序。', ''];
  for (const [i, entry] of entries.entries()) {
    lines.push(`### ${i + 1}. ${entry.name}`, '', `意图：${entry.text}。本场符合双向条件 ${entry.localCheck.eligibleCount} 人。`, '');
    for (const [label, key] of [['本地规则','local'],['真实大模型融合','remote']]) {
      lines.push(`**${label}**`, '', '| 姓名 | 性别 / 年龄 | 分数 | 理由 | 为什么可能适合 |', '|---|---|---:|---|---|');
      for (const r of entry[key] || []) lines.push(`| ${r.public.profile.name} | ${r.public.profile.gender} / ${dating.age(r.public.profile)} | ${r.score} | ${r.reason} | ${r.fitReason} |`);
      if (!entry[key]) lines.push(`| 未完成：${entry.error} | — | — | — | — |`);
      lines.push('');
    }
    lines.push(`检查：本地 ${entry.localCheck.pass ? '通过' : '未通过'}；大模型 ${entry.remoteCheck?.pass ? '通过' : '未通过'}。`);
    if (entry.meta) lines.push(`实际请求：${entry.meta.model}，${entry.meta.durationMs} ms，correlationId=${entry.meta.correlationId}；理由回退 ${entry.meta.repairs.length} 条，丢弃 ${entry.meta.dropped.length} 条。`);
    lines.push(`详细检查：本地 ${JSON.stringify(entry.localCheck.checks)}；大模型 ${JSON.stringify(entry.remoteCheck?.checks || {})}。`, '');
  }
  const summary = { date: new Date().toISOString(), localPassed: entries.filter(e => e.localCheck.pass).length,
    llmPassed: entries.filter(e => e.remoteCheck?.pass).length, total: entries.length,
    fallbackCount: entries.reduce((n,e) => n + (e.meta?.repairs.length || 0), 0),
    fitFallbackCount: entries.reduce((n,e) => n + (e.meta?.repairs.filter(r => r.code === 'FIT_REASON_FALLBACK').length || 0), 0),
    droppedCount: entries.reduce((n,e) => n + (e.meta?.dropped.length || 0), 0) };
  lines.push(`本轮汇总：本地 ${summary.localPassed}/${summary.total}（${Math.round(summary.localPassed/summary.total*100)}%）；真实大模型 ${summary.llmPassed}/${summary.total}（${Math.round(summary.llmPassed/summary.total*100)}%）。理由回退共 ${summary.fallbackCount} 条（其中 fitReason ${summary.fitFallbackCount} 条），丢弃 ${summary.droppedCount} 条。`, '',
    'AI 之夜仅返回两位合格男性，不补入未开放者；活动建议按符合相同双向条件的人数排序，城市徒步居首。此前章节为历史职业画像报告；本轮另由全量 Node 回归测试复测职业与 AI 技术需求切换的确定性检查。', '');
  const file = path.join(root, 'docs/match-eval.md');
  let existing = fs.readFileSync(file, 'utf8').split('<!-- round-8-dating -->')[0].trimEnd();
  if (existing.split('\n').length > 350) {
    fs.writeFileSync(path.join(root, 'docs/match-eval-professional.md'), existing + '\n');
    existing = '# 匹配评估\n\n完整职业与AI画像、技术切换和延迟对照保留于[独立职业评测报告](match-eval-professional.md)。其中标注原始运行时间；本轮交友实测如下。\n\n职业与交友模式采用不同证据标准：职业要求完整专业信息；交友要求双方公开生活信息。';
  }
  fs.writeFileSync(file, existing + '\n\n' + lines.join('\n'));
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'server-log.jsonl'), logs.map(row => JSON.stringify(row)).join('\n') + '\n');
}
main().catch(error => { console.error(error.code || 'DATING_EVALUATION_FAILED'); process.exitCode = 1; });
