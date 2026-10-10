(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BJ.config.intent = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  return { limit: 16,
    professional: { title: 'seekRoles', industry: 'seekIndustries', skills: 'seekSkills' },
    dating: { interests: 'interests', datingLifestyle: 'lifestyle', datingValues: 'values' },
    labels: { seekRoles: '想认识', seekIndustries: '行业', seekSkills: '技能需求', offer: '能提供', city: '城市',
      interests: '兴趣', lifestyle: '生活方式', values: '看重的价值观' },
    common: '本场参会者常见标签', count: '{tag} · {n} 人', typedCount: '{tag}（{kind}） · {n} 人', empty: '写一句你的期待，或从本场标签中点选。',
    noTags: '本场暂无公开的相关标签', emptyMatch: '先写一句期待，或点选本场参会者标签，再开始匹配。',
    versionWarning: '推荐服务是旧版本，请关闭服务窗口后重新双击 启动演示.bat',
    versionLocal: '本地规则计算（推荐服务版本不一致）',
    modes: [['professional', '职业 / 交朋友'], ['dating', '恋爱交友']],
  };
});
