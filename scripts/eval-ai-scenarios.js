// DEMO DATA — fixed AI matching thresholds; do not relax to fit results.
function person(id, profile, intent) {
  return { id, profile, versions: [{ id: 'public', visibleFields: Object.keys(profile) }],
    session: { versionId: 'public', publicIntent: true, openToChat: true, status: 'checked_in', intent } };
}
function scenarios() {
  const founderProfile = { name: 'AI应用测试创始人', title: 'AI 应用创始人', industry: 'LLM · 企业服务',
    skills: ['LLM', '产品验证'], city: '上海', cooperation: ['联合创始人', '早期员工'],
    markets: ['To B', 'To C'], availability: ['全职'], compensation: ['股权', '薪资'] };
  const intent = { seekRoles: ['工程师'], seekIndustries: ['LLM', 'Agent'],
    offer: ['项目', '客户渠道', '融资经验'], city: '上海', availability: ['全职'],
    cooperation: ['联合创始人', '早期员工'] };
  const founder = { name: '寻找技术合伙人的 AI 应用创业者', eventId: 'ai-agent-night',
    expected: '工程师', top: 5, minimum: 3, mutualMinimum: 3,
    me: person('ai-eval-founder', founderProfile, intent) };
  const engineer = { name: '想加入早期 AI 项目的大模型工程师', eventId: 'demo-day',
    expected: '创始人', top: 5, minimum: 3, mutualMinimum: 3,
    me: person('ai-eval-engineer', { name: '大模型测试工程师', title: '大模型工程师', industry: 'LLM · Agent',
      skills: ['LLM', 'RAG 知识库', 'Agent 编排'], city: '上海', cooperation: ['早期员工', '联合创始人'],
      markets: ['To B'], availability: ['全职'], compensation: ['股权', '薪资'], employment: ['已离职'] },
    { seekRoles: ['创始人'], seekIndustries: ['LLM', 'Agent'], offer: ['技术', 'RAG原型', '推理部署'], city: '',
      cooperation: ['早期员工', '联合创始人'], availability: ['全职'] }) };
  return [founder, engineer];
}
function technicalScenarios() {
  return ['端侧推理', 'RAG 知识库', '多模态视频生成'].map(skill => {
    const base = scenarios()[0];
    base.name = '技术需求切换：' + skill;
    base.technical = skill;
    base.top = 3;
    base.minimum = 2;
    delete base.mutualMinimum;
    base.me.session.intent.seekSkills = [skill];
    return base;
  });
}
module.exports = { scenarios, technicalScenarios };
