const fs = require('node:fs');
const path = require('node:path');
module.exports = function report(record) {
  const lines = ['# 匹配评估 · 第6轮', '', `时间：${record.date}；超时：${record.timeoutMs}ms；召回：${record.candidateCount}人。`, '',
    '10个画像与3项技术需求切换。阈值事先固定：AI画像Top5至少3位对口且双向匹配；技术切换各Top3至少2位方向对口且三组人选组合不同。', '',
    '双向=needAB和needBA均≥0.4。隐私检查逐一排除不在公开投影中的字段值；公开与隐藏字段重复值不误判。失败/超时不计作模型通过。', '',
    '本轮理由证据只允许完整行业、技能、offer或合作条件；兴趣/简介/经历不能单独放行。姓名仍须出现，输出称呼统一为“你”。服务端逐条回退不合格理由并记录，分数仍来自模型；按完整证据预算生成回退句和完整破冰问句；无法修复或仍重复时只移除该候选人，下方报告回退及移除数量。前轮报告归档match-eval-round5.md。', ''];
  const table = rows => ['| 姓名 | 角色 | 分数 | 双向因子 | 理由 |', '| --- | --- | ---: | --- | --- |',
    ...rows.map(r => `| ${r.public.profile.name} | ${r.public.profile.title || '未公开'} | ${r.score} | ${r.factors.needAB.toFixed(2)} / ${r.factors.needBA.toFixed(2)} | ${r.reason.replace(/\|/g, '／')} |`), ''];
  for (const entry of record.scenarios) {
    lines.push(`## ${entry.name}`, '', `活动：${entry.eventId}；意图：${JSON.stringify(entry.intent)}`, '',
      `### 本地Top5（${entry.localMs}ms）`, '', ...table(entry.local),
      `期望：${entry.localCheck.expectation}；命中${entry.localCheck.hit}；双向${entry.localCheck.mutual}；隐私${entry.localCheck.privacy}；措辞${entry.localCheck.wording}；降序${entry.localCheck.ordered}；通过${entry.localCheck.pass}。`, '');
    if (entry.remote) lines.push(`### 大模型融合Top5（${entry.llmMs}ms；缓存${entry.cacheMs}ms / ${entry.cache}）`, '', ...table(entry.remote),
      `期望：${entry.remoteCheck.expectation}；命中${entry.remoteCheck.hit}；双向${entry.remoteCheck.mutual}；隐私${entry.remoteCheck.privacy}；措辞${entry.remoteCheck.wording}；降序${entry.remoteCheck.ordered}；通过${entry.remoteCheck.pass}。`,
      `本次全部候选中移除${entry.dropped?.length || 0}条；理由回退${entry.reasonRepairs?.length || 0}条（${(entry.reasonRepairs || []).map(r => r.code).join('、') || '无'}）。`, '');
    else lines.push(`大模型未完成：${entry.error || '离线评估'}；保留本地结果。`, '');
    if (entry.remote) lines.push(`严格公开证据检查${entry.evidenceCheck}；称呼检查${entry.addressCheck}。`, '');
  }
  const summary = (entries, key) => `${entries.filter(e => e[key]?.pass).length}/${entries.length}`;
  const droppedCount = record.scenarios.reduce((n, e) => n + (e.dropped?.length || 0), 0);
  const users = record.scenarios.filter(e => !e.technical);
  const switches = record.scenarios.filter(e => e.technical);
  const signatures = key => new Set(switches.map(e => (e[key] || []).slice(0, 3).map(r => r.id).sort().join(','))).size;
  lines.push('## 汇总', '', `- 无法修复而移除的候选：${droppedCount}条（按每次召回计数）。`, `- 10画像：本地${summary(users, 'localCheck')}；大模型${summary(users, 'remoteCheck')}。`,
    `- 技术切换：本地${summary(switches, 'localCheck')}；大模型${summary(switches, 'remoteCheck')}。`,
    `- 三组Top3组合数量：本地${signatures('local')}，大模型${signatures('remote')}（期望3）。`,
    `- 理由措辞检查：本地${record.scenarios.filter(e => e.localCheck.wording).length}/${record.scenarios.length}；大模型最终展示${record.scenarios.filter(e => e.remoteCheck?.wording).length}/${record.scenarios.length}。`,
    `- 严格证据与称呼检查：${record.scenarios.filter(e => e.evidenceCheck && e.addressCheck).length}/${record.scenarios.length}。`,
    `- 13项质量评测共130次候选的理由回退：${record.scenarios.reduce((n, e) => n + (e.reasonRepairs?.length || 0), 0)}条，其中禁用措辞${record.scenarios.flatMap(e => e.reasonRepairs || []).filter(r => r.code === 'REASON_WORDING_FALLBACK').length}条；延迟对照另计。`,
    `- 总通过率：本地${summary(record.scenarios, 'localCheck')}（${(record.scenarios.filter(e => e.localCheck.pass).length / record.scenarios.length * 100).toFixed(1)}%）；大模型${summary(record.scenarios, 'remoteCheck')}（${(record.scenarios.filter(e => e.remoteCheck?.pass).length / record.scenarios.length * 100).toFixed(1)}%）。`, '');
  lines.push('## 实测延迟', '', '第2轮真实重排约36–44秒（历史报告已归档为match-eval-round2.md）。本轮另用相同默认用户和78人数据池顺序测量对照/优化两种参数：', '',
    '| 参数 | 首次调用ms | 缓存ms | 结果 | 回退/移除 |', '| --- | ---: | ---: | --- | --- |');
  for (const row of record.latency) lines.push(`| ${row.variant} | ${row.elapsedMs} | ${row.cacheMs ?? '—'} | ${row.error || '成功 / ' + row.cache} | ${row.reasonRepairs?.length ?? '未记录'} / ${row.dropped?.length ?? '未记录'} |`);
  const successful = record.scenarios.filter(e => e.remote);
  if (successful.length) lines.push('', `本轮13项中成功${successful.length}项；首次调用平均${Math.round(successful.reduce((n, e) => n + e.llmMs, 0) / successful.length)}ms；缓存平均${Math.round(successful.reduce((n, e) => n + e.cacheMs, 0) / successful.length)}ms。`);
  lines.push('', '对照试验共享模型、数据与low推理强度，采用第2轮输出长度规则及完整公开输入；优化组缩短输入/输出并限制tokens。顺序测量仍受网络/上游负载影响，不把单次差异当作保证。缓存仅存内存，键包含活动、自己的公开投影/意图、候选公开投影、模型及提示词；隐私、候选或意图变化会失效。', '',
    '复测：node scripts/eval-match.js；确定性验证：node --test tests。', '');
  fs.writeFileSync(path.join(__dirname, '../docs/match-eval.md'), lines.join('\n'));
};
